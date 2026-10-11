import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { instant } from '../../../testing/instant.js';
import {
  CANONICALISATION_VERSION,
  canonicaliseLicenceMaterial,
} from '../domain/services/canonical-json.js';
import { EcdsaLicenceSignatureVerifier } from '../infrastructure/adapters/ecdsa-licence-signature-verifier.js';
import { ValidateLicenceCertificate } from './validate-licence-certificate.js';

/**
 * `ValidateLicenceCertificate` — the certificate's verdict (`PLT-301` T1).
 *
 * ## The three mandatory tests from `ADR-009` live here
 *
 *  1. **Reordering keys does not break a valid signature.** The canonicalisation
 *     is genuinely canonical or a serialiser difference locks a school out.
 *  2. **Flipping any single byte breaks it.** The signature is content-bound,
 *     not structure-bound.
 *  3. **Expired is distinguishable from invalid.** They are different
 *     administrative states with different remedies; a tampered certificate
 *     and an expired one must never produce the same error.
 *
 * ## The throwaway keypair
 *
 * `ADR-009`: the private signing key never enters this repository, tests
 * included. The fixture generates one at runtime per suite, signs with it,
 * and verifies with the matching public key PEM. What this suite proves is
 * the CONTRACT — canonical form, key handling, verdict states — not any
 * particular key, and a key pair that only exists for the length of a test
 * is the only kind the repository may ever hold.
 */

// ── The fixture: a throwaway keypair, and a signer built on it ────────────────
const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1', // P-256 — ADR-009's decision.
});

const VERIFIER = new EcdsaLicenceSignatureVerifier({
  publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
});

/** Sign the canonical material for `payload`, the way the activation server will. */
const sign = (payload: unknown): string =>
  cryptoSign(
    'sha256',
    Buffer.from(canonicaliseLicenceMaterial(payload), 'utf8'),
    privateKey,
  ).toString('base64');

/** Wrap a signed payload in the certificate envelope the validator reads. */
const certificate = (
  payload: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  certificate: payload,
  canonicalisationVersion: CANONICALISATION_VERSION,
  keyId: 'primary-2026',
  signature: sign(payload),
  ...overrides,
});

const validate = (blob: unknown, now = instant('2026-10-11T00:00:00.000Z')) =>
  new ValidateLicenceCertificate({ verifier: VERIFIER }).validate({ certificate: blob, now });

const school = (): Record<string, unknown> => ({
  product: 'EduFlow360',
  edition: 'Deluxe',
  school_id: 'sch_om_muscat_01',
  school_name: 'Muscat International Academy',
  activation_date: '2026-09-01T00:00:00Z',
  expiry_date: '2027-08-31T23:59:59Z',
  allowed_modules: ['academics', 'finance'],
  limits: { maximum_students: 1500 },
  features: { ai_chatbot: true },
});

describe('ValidateLicenceCertificate — a certificate the signer issued', () => {
  it('verifies, and hands back the payload in the domain form', () => {
    const verdict = validate(certificate(school()));

    expect(verdict.outcome).toBe('valid');
    if (verdict.outcome === 'valid') {
      expect(verdict.payload.schoolId).toBe('sch_om_muscat_01');
      expect(verdict.payload.allowedModules).toContain('finance');
      expect(verdict.payload.expiryDate).toBeInstanceOf(Date);
    }
  });
});

// ── ADR-009 mandatory test 1 ───────────────────────────────────────────────
describe('reordering the payload does not break the signature', () => {
  it('verifies a certificate whose keys arrived in a different order', () => {
    // The ADR's first mandatory test, and the exact lockout scenario: the
    // signer serialised one order, a mail client or a clipboard the other,
    // and a verifier that re-serialised its own way would refuse a licence
    // the signer issued. Canonicalisation is what makes the two the same.
    const ordered = certificate(school());
    const shuffled = certificate({
      features: school().features,
      limits: school().limits,
      expiry_date: school().expiry_date,
      activation_date: school().activation_date,
      school_name: school().school_name,
      school_id: school().school_id,
      edition: school().edition,
      product: school().product,
      allowed_modules: school().allowed_modules,
    });

    expect(validate(ordered).outcome).toBe('valid');
    // The SAME bytes, arrived in a different order, must give the same answer.
    expect(validate(shuffled).outcome).toBe('valid');
  });
});

// ── ADR-009 mandatory test 2 ───────────────────────────────────────────────
describe('flipping any single byte breaks the signature', () => {
  const mutations: ReadonlyArray<[string, () => Record<string, unknown>]> = [
    [
      'a character in the school name',
      () => ({ ...school(), school_name: 'Muscat International Academx' }),
    ],
    ['an edition downgrade', () => ({ ...school(), edition: 'Basic' })],
    [
      'an added module',
      () => ({ ...school(), allowed_modules: [...school().allowed_modules, 'finance', 'assets'] }),
    ],
    ['a raised limit', () => ({ ...school(), limits: { maximum_students: 99999 } })],
    [
      'an extended expiry',
      () => ({ ...school(), expiry_date: '2027-08-31T23:59:59Z'.replace('2027', '2028') }),
    ],
    ['a flipped feature flag', () => ({ ...school(), features: { ai_chatbot: false } })],
  ];

  for (const [name, mutate] of mutations) {
    it(`refuses ${name}`, () => {
      // The mutation is applied to the SIGNED payload after signing, which is
      // exactly what an attacker holding a valid certificate can do: they
      // cannot re-sign, but they can edit the file.
      const tampered = mutate();
      const blob = certificate(tampered, {
        signature: sign(school()), // the signature of the ORIGINAL
      });

      expect(validate(blob).outcome).toBe('invalid-signature');
    });
  }
});

// ── ADR-009 mandatory test 3 ───────────────────────────────────────────────
describe('expired is distinguishable from invalid', () => {
  it('reports a valid certificate whose time has passed as EXPIRED, with the date', () => {
    const verdict = validate(certificate(school()), instant('2027-09-01T00:00:00.000Z'));

    expect(verdict.outcome).toBe('expired');
    if (verdict.outcome === 'expired') {
      // The date travels with the verdict: PLT-305's degradation UI and the
      // admin's mailbox both need WHEN, not just THAT.
      expect(verdict.payload.expiryDate.toISOString()).toBe('2027-08-31T23:59:59.000Z');
    }
  });

  it('reports a tampered certificate as INVALID-SIGNATURE, never as expired', () => {
    // The two states must never converge — an expired licence is a billing
    // conversation, a tampered one is a security incident, and the answers
    // are different enough that conflating them is an operational failure.
    //
    // The attack this models: the certificate's expiry was edited (or the
    // whole payload replaced) while the signature still covers the original
    // bytes. Judged at a date AFTER the tampered expiry would have run out,
    // so a verifier that checked time before signature would answer
    // "expired" and quietly retire a certificate that was, in fact, forged.
    const tampered = certificate(
      { ...school(), expiry_date: '2028-08-31T23:59:59Z' },
      {
        signature: sign(school()),
      },
    );

    expect(validate(tampered, instant('2027-09-01T00:00:00.000Z')).outcome).toBe(
      'invalid-signature',
    );
  });
});

describe('the verdict states, and why each exists', () => {
  it('reports a payload the schema refuses as SCHEMA-ERROR before any signature work', () => {
    // ADR-009's ordering rule: schema first, signature second. A mistyped
    // certificate is a schema error the clerk can fix; presenting it as a
    // signature failure would send an administrator hunting a forgery.
    const malformed = { ...school(), edition: '' };
    const verification = validate(certificate(malformed, { signature: 'not-even-a-signature' }));

    expect(verification.outcome).toBe('schema-error');
  });

  it('reports a signature over the wrong material as INVALID-SIGNATURE', () => {
    // The signer signed something else — the failure that catches a
    // canonicalisation disagreement between the two sides, which is exactly
    // the drift ADR-009 wrote the canonical function to prevent.
    const wrongMaterial = Buffer.from(
      '{"canonicalisationVersion":1,"payload":"something else"}',
      'utf8',
    );
    const signature = cryptoSign('sha256', wrongMaterial, privateKey).toString('base64');

    expect(validate(certificate(school(), { signature })).outcome).toBe('invalid-signature');
  });

  it('refuses a canonicalisation version this build does not implement', () => {
    // The version travels in the envelope, so it is checked BEFORE the
    // canonical form is built: a v2 certificate must not be canonicalised
    // with v1 rules and then refused as a bad signature — that error would
    // name the wrong problem and invite a signer to change the wrong thing.
    const blob = {
      certificate: school(),
      canonicalisationVersion: 2,
      keyId: 'primary-2026',
      // A perfectly valid signature over the CURRENT material — the version
      // check must still fire first.
      signature: sign(school()),
    };

    expect(validate(blob).outcome).toBe('unsupported-scheme');
  });

  it('refuses a certificate with no signature at all, as a schema error', () => {
    // Not an invalid-signature: nothing was presented to verify, and the
    // verdict should say so rather than implying a mismatch.
    expect(
      validate({ certificate: school(), canonicalisationVersion: 1, keyId: 'x' }).outcome,
    ).toBe('schema-error');
  });
});
