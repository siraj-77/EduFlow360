import { instant } from '../../../testing/instant.js';
import { describe, expect, it } from 'vitest';
import { ActivateOfflineLicence } from './activate-offline-licence.js';
import type { LicenceEnvelopeRecord } from '../domain/repositories/license-repository.js';
import type { ILicencePayloadCache } from '../domain/ports/licence-payload-cache.js';
import type { ValidateLicenceCertificate, LicenceVerdict } from './validate-licence-certificate.js';
import type { LicencePayload } from '../domain/services/licence-payload.js';

/**
 * `ActivateOfflineLicence` — half of `PLT-304` (the story; the other half is
 * the route and the registries).
 *
 * ## What the story is actually for
 *
 * A school at an air-gapped site cannot reach an activation server. The
 * exchange is manual: the vendor emails a `.lic` file, an administrator
 * uploads it, and the school runs. The acceptance criterion says the file
 * "activates the school exactly as the online path would, with identical
 * validation rigour" — and the rigour already exists, because
 * `ValidateLicenceCertificate` is the same code the boot refresh runs. This
 * use-case is the other half: turn a validated certificate into a STORED row
 * and a REFRESHED cache, so the next request through `EntitlementGuard`
 * answers differently.
 *
 * ## Why the school binding is checked here and not in the validator
 *
 * The validator judges a certificate on its own terms — was it signed, is it
 * in date, does it parse. Whether it belongs to THIS deployment is a
 * different question with a different answer available only here: the
 * deployment knows its own `SCHOOL_ID` and the certificate names its own.
 * A valid certificate for another school must be refused, or uploading a
 * licence intended for anyone would unlock anything.
 */

const AT = instant('2026-10-11T09:00:00.000Z');

const payload = (): LicencePayload => ({
  product: 'EduFlow360',
  edition: 'Deluxe',
  schoolId: 'sch_this_school',
  schoolName: 'This School',
  activationDate: instant('2026-09-01T00:00:00.000Z'),
  expiryDate: instant('2027-08-31T23:59:59.000Z'),
  allowedModules: ['academics', 'finance'],
  limits: {},
  features: { ai_chatbot: true },
});

/** The envelope as the controller received it — the `.lic` file, parsed. */
const envelope = (): Record<string, unknown> => ({
  certificate: {
    product: 'EduFlow360',
    edition: 'Deluxe',
    school_id: 'sch_this_school',
    school_name: 'This School',
    activation_date: '2026-09-01T00:00:00Z',
    expiry_date: '2027-08-31T23:59:59Z',
    allowed_modules: ['academics', 'finance'],
    limits: {},
    features: { ai_chatbot: true },
  },
  canonicalisationVersion: 1,
  keyId: 'primary-2026',
  signature: 'base64-signature',
});

/** A fake repository recording what was stored. */
class FakeLicenceRepository {
  readonly stored: LicenceEnvelopeRecord[] = [];
  existing: LicenceEnvelopeRecord | null = null;

  async findEnvelopeForValidation(): Promise<LicenceEnvelopeRecord | null> {
    return this.existing;
  }

  async activate(
    record: Omit<LicenceEnvelopeRecord, 'licenceId'> & { licenceId?: string },
  ): Promise<{ licenceId: string }> {
    this.stored.push({ licenceId: 'stored-row', ...record });
    return { licenceId: 'stored-row' };
  }

  async stampValidatedAt(): Promise<void> {
    return undefined;
  }
}

/** A fake validator answering whatever verdict the test wants. */
class FakeValidator {
  constructor(private readonly verdict: LicenceVerdict) {}

  validate(): LicenceVerdict {
    return this.verdict;
  }
}

/** A fake cache recording what was remembered. */
class FakeCache implements Pick<ILicencePayloadCache, 'current' | 'remember'> {
  readonly states: unknown[] = [];
  current(): unknown {
    return this.states.at(-1) ?? null;
  }
  remember(state: unknown): void {
    this.states.push(state);
  }
}

const useCaseWith = (options: { verdict?: LicenceVerdict; schoolId?: string; now?: Date }) =>
  new ActivateOfflineLicence({
    licenses: new FakeLicenceRepository(),
    validator: new FakeValidator(
      options.verdict ?? { outcome: 'valid', payload: payload() },
    ) as unknown as ValidateLicenceCertificate,
    cache: new FakeCache(),
    clock: { now: () => options.now ?? AT },
    schoolId: options.schoolId ?? 'sch_this_school',
  });

describe('ActivateOfflineLicence — a certificate meant for this deployment', () => {
  it('stores it, refreshes the cache, and answers activated', async () => {
    const useCase = useCaseWith({});

    const result = await useCase.activate({ certificate: envelope() });

    expect(result.outcome).toBe('activated');
    expect((result as { outcome: string }).outcome).toBe('activated');
  });

  it('stores the WHOLE envelope, because the boot refresh re-validates from it', async () => {
    // A row that kept only the payload would leave the next refresh unable
    // to verify a signature it no longer had.
    const useCase = useCaseWith({});
    const blob = envelope();

    await useCase.activate({ certificate: blob });

    // The fake records the stored record: the envelope travels intact.
    const stored = (useCase as unknown as { deps: { licenses: FakeLicenceRepository } }).deps
      .licenses.stored[0];
    expect(stored?.certificate).toEqual(blob.certificate);
    expect(stored?.signature).toBe('base64-signature');
    expect(stored?.canonicalisationVersion).toBe(1);
  });

  it('fills the cache immediately, so the entitlement guard changes on the NEXT request', async () => {
    // `PLT-303`'s AC: "immediate feature unlock". The cache write is what
    // makes it immediate — no restart, no second request to trigger it.
    const useCase = useCaseWith({});
    const cache = (useCase as unknown as { deps: { cache: FakeCache } }).deps.cache;

    await useCase.activate({ certificate: envelope() });

    expect(cache.current()).toMatchObject({ outcome: 'valid' });
  });
});

describe('ActivateOfflineLicence — refusals', () => {
  it('refuses a certificate the validator already refused, and stores nothing', async () => {
    for (const verdict of [
      { outcome: 'invalid-signature' } as LicenceVerdict,
      { outcome: 'schema-error', reason: 'x' } as LicenceVerdict,
      { outcome: 'expired', payload: payload() } as LicenceVerdict,
      { outcome: 'unsupported-scheme', version: 2 } as LicenceVerdict,
    ]) {
      const useCase = useCaseWith({ verdict });
      const stored = (useCase as unknown as { deps: { licenses: FakeLicenceRepository } }).deps
        .licenses;

      await useCase.activate({ certificate: envelope() });

      expect(stored.stored).toEqual([]);
    }
  });

  it('refuses a certificate for a DIFFERENT school', async () => {
    // The binding this story exists for: a validly-signed certificate names
    // its school, and uploading a licence issued for anyone else must not
    // unlock anything.
    const useCase = useCaseWith({ schoolId: 'sch_someone_else' });

    const result = await useCase.activate({ certificate: envelope() });

    expect(result.outcome).toBe('school-mismatch');
    expect(
      (useCase as unknown as { deps: { licenses: FakeLicenceRepository } }).deps.licenses.stored,
    ).toEqual([]);
  });

  it('answers refused with the validator own reason, so the admin sees why', async () => {
    const useCase = useCaseWith({
      verdict: { outcome: 'schema-error', reason: 'edition is missing' },
    });

    const result = await useCase.activate({ certificate: envelope() });

    expect(result).toEqual({ outcome: 'refused', reason: 'schema-error' });
  });
});
