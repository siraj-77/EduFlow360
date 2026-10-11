import { describe, expect, it } from 'vitest';
import { instant } from '../../../testing/instant.js';
import { RefreshCachedLicence } from './refresh-cached-licence.js';
import type { ValidateLicenceCertificate, LicenceVerdict } from './validate-licence-certificate.js';
import type { LicenceCacheState } from '../domain/ports/licence-payload-cache.js';
import type {
  ILicenseRepository,
  LicenceEnvelopeRecord,
} from '../domain/repositories/license-repository.js';

/**
 * `RefreshCachedLicence` — the boot-time read that fills the cache
 * (`PLT-301` T2).
 *
 * ## Why this exists rather than the guard reading the database
 *
 * `PLT-302`'s guard runs on every request and must answer in microseconds;
 * `ADR-011` and `ADR-009` between them say a certificate is read once at
 * boot (the `License` model's `lastValidatedAt` and the `PLT-305` grace
 * countdown both start from it). This use-case is the seam: a repository
 * port for "what licence does this deployment hold", a validator that
 * already exists, and one write to the cache.
 *
 * ## Why the failure branches are the interesting ones
 *
 * Nine states reach the cache, and this suite pins the ones that could fail
 * open: a revoked licence must not be treated as active, a REVOKED status is
 * filtered in the REPOSITORY (not here) so a revoked row is absent, and an
 * unreadable or absent licence records `absent` rather than leaving the
 * cache null — a null cache would make `PLT-302` unanswerable, while an
 * `absent` state makes it a decided refusal.
 */

const AT = instant('2026-10-11T09:00:00.000Z');

/** A fake that hands back whatever the test sets. */
class FakeLicenceRepository implements ILicenseRepository {
  row: LicenceEnvelopeRecord | null = null;
  readFailure: Error | null = null;

  async findEnvelopeForValidation(): Promise<LicenceEnvelopeRecord | null> {
    if (this.readFailure !== null) throw this.readFailure;
    return this.row;
  }

  async stampValidatedAt(): Promise<void> {
    return undefined;
  }
}

/** A fake that answers whatever verdict the test wants, without a keypair. */
class FakeValidator {
  constructor(private readonly verdict: LicenceVerdict) {}

  validate(): LicenceVerdict {
    return this.verdict;
  }
}

/** The use-case with the fake deps, in the shape it expects. */
const useCaseWith = (deps: {
  licenses: FakeLicenceRepository;
  verdict: LicenceVerdict;
  now: Date;
}) =>
  new RefreshCachedLicence({
    licenses: deps.licenses,
    validator: new FakeValidator(deps.verdict) as unknown as ValidateLicenceCertificate,
    clock: { now: () => deps.now },
  });

class RecordingCache {
  readonly states: LicenceCacheState[] = [];

  current(): LicenceCacheState | null {
    return this.states.at(-1) ?? null;
  }

  remember(state: LicenceCacheState): void {
    this.states.push(state);
  }
}

const envelopeRow = (): LicenceEnvelopeRecord => ({
  certificate: {
    product: 'EduFlow360',
    edition: 'Deluxe',
    school_id: 'sch_om_muscat_01',
    school_name: 'Muscat International Academy',
    activation_date: '2026-09-01T00:00:00Z',
    expiry_date: '2027-08-31T23:59:59Z',
    allowed_modules: ['academics'],
    limits: {},
    features: {},
  },
  canonicalisationVersion: 1,
  keyId: 'primary-2026',
  signature: 'base64-signature',
});

describe('RefreshCachedLicence — the successful refresh', () => {
  it('validates the envelope and caches a VALID state', async () => {
    const licenses = new FakeLicenceRepository();
    licenses.row = envelopeRow();
    const cache = new RecordingCache();
    const useCase = useCaseWith({
      licenses,
      verdict: {
        outcome: 'valid',
        payload: {
          product: 'EduFlow360',
          edition: 'Deluxe',
          schoolId: 'sch_om_muscat_01',
          schoolName: 'Muscat International Academy',
          activationDate: instant('2026-09-01T00:00:00.000Z'),
          expiryDate: instant('2027-08-31T23:59:59.000Z'),
          allowedModules: ['academics'],
          limits: {},
          features: {},
        },
      } as LicenceVerdict,
      now: AT,
    });

    await useCase.refresh(cache);

    expect(cache.current()).toEqual({
      outcome: 'valid',
      payload: expect.objectContaining({ schoolId: 'sch_om_muscat_01' }),
      validatedAt: AT,
    });
  });
});

describe('RefreshCachedLicence — what the cache is told', () => {
  it('records an expired certificate as EXPIRED, never as valid', async () => {
    const licenses = new FakeLicenceRepository();
    licenses.row = envelopeRow();
    const cache = new RecordingCache();
    const useCase = useCaseWith({
      licenses,
      verdict: {
        outcome: 'expired',
        payload: {} as never,
        validatedAt: AT,
      } as unknown as LicenceVerdict,
      now: AT,
    });

    await useCase.refresh(cache);

    expect(cache.current()?.outcome).toBe('expired');
  });

  it('records an invalid signature as INVALID-SIGNATURE, with no payload leak', async () => {
    // A tampered certificate's payload must not reach the cache: the state
    // carries the reason and nothing else, so a guard reading it cannot be
    // tricked into serving entitlements from forged material.
    const licenses = new FakeLicenceRepository();
    licenses.row = envelopeRow();
    const cache = new RecordingCache();
    const useCase = useCaseWith({
      licenses,
      verdict: { outcome: 'invalid-signature' } as LicenceVerdict,
      now: AT,
    });

    await useCase.refresh(cache);

    expect(cache.current()).toEqual({ outcome: 'invalid-signature', validatedAt: AT });
  });

  it('records a missing licence as ABSENT, so the guard has a decided answer', async () => {
    // A null cache would make PLT-302 unanswerable on a fresh deployment;
    // `absent` makes it a refusal the health endpoint can name.
    const licenses = new FakeLicenceRepository();
    const cache = new RecordingCache();
    const useCase = useCaseWith({ licenses, verdict: { outcome: 'invalid-signature' }, now: AT });

    await useCase.refresh(cache);

    expect(cache.current()).toEqual({
      outcome: 'absent',
      reason: 'no licence row',
      validatedAt: AT,
    });
  });

  it('records an unreadable licence as ABSENT with the reason', async () => {
    // A repository failure must not crash boot (`ADR-009`: "never a crash,
    // never a silent bypass") and must not look like a valid certificate.
    const licenses = new FakeLicenceRepository();
    licenses.readFailure = new Error('connection refused');
    const cache = new RecordingCache();
    const useCase = useCaseWith({ licenses, verdict: { outcome: 'invalid-signature' }, now: AT });

    await useCase.refresh(cache);

    const state = cache.current();
    expect(state?.outcome).toBe('absent');
    expect(state?.outcome === 'absent' && state.reason).toContain('connection refused');
  });
});
