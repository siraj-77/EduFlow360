import { describe, expect, it } from 'vitest';
import {
  InMemoryLicencePayloadCache,
  type LicenceCacheState,
} from './in-memory-licence-payload-cache.js';
import type { LicencePayload } from '../../domain/services/licence-payload.js';

/**
 * `InMemoryLicencePayloadCache` — the validated payload, held once (`PLT-301`
 * T2).
 *
 * ## Why a cache and not a read per request
 *
 * The verdict `PLT-302`'s guard needs on EVERY request, and the certificate is
 * validated once. A per-request read would put a database round trip (or a
 * signature verification — milliseconds of CPU) in front of every route in
 * the product. The cache holds the VALIDATED payload and the instant it was
 * validated at, which is also the input `PLT-305`'s grace period runs from
 * (the `License` model's `lastValidatedAt` has the same name and the same
 * job).
 *
 * ## Why the cache remembers FAILURES too
 *
 * The obvious design caches only a good payload. The one that actually works
 * remembers the bad verdict as well: a tampered or expired certificate must
 * answer the same way on every request after the first, and a cache that went
 * back to "nothing" between refreshes would turn a locked school into one
 * that flickers between locked and unlocked. `AGENTS.md` §2.3's fail-closed
 * applies to caches.
 */

const payload = (): LicencePayload => ({
  product: 'EduFlow360',
  edition: 'Deluxe',
  schoolId: 'sch_om_muscat_01',
  schoolName: 'Muscat International Academy',
  activationDate: new Date('2026-09-01T00:00:00.000Z'),
  expiryDate: new Date('2027-08-31T23:59:59.000Z'),
  allowedModules: ['academics', 'finance'],
  limits: { maximum_students: 1500 },
  features: { ai_chatbot: true },
});

const validState = (): LicenceCacheState => ({
  outcome: 'valid',
  payload: payload(),
  validatedAt: new Date('2026-10-11T09:00:00.000Z'),
});

describe('InMemoryLicencePayloadCache', () => {
  it('starts empty, which is the fresh-deployment state', () => {
    const cache = new InMemoryLicencePayloadCache();

    expect(cache.current()).toBeNull();
  });

  it('remembers what it was given, and hands back the same object', () => {
    const cache = new InMemoryLicencePayloadCache();

    cache.remember(validState());

    expect(cache.current()).toEqual(validState());
  });

  it('remembers a FAILURE, so a locked school stays locked', () => {
    // The flicker this prevents: between refreshes a cache that forgot its
    // own bad verdict would answer "no licence" and the guard would flip.
    const cache = new InMemoryLicencePayloadCache();

    cache.remember({ outcome: 'invalid-signature', validatedAt: new Date() });

    expect(cache.current()?.outcome).toBe('invalid-signature');
  });

  it('replaces the previous state, so a renewal is a rewrite and not a merge', () => {
    const cache = new InMemoryLicencePayloadCache();

    cache.remember(validState());
    cache.remember({ outcome: 'expired', payload: payload(), validatedAt: new Date() });

    expect(cache.current()?.outcome).toBe('expired');
  });

  it('is per-process: two caches do not share state', () => {
    // Single-tenant (`ADR-003`): one deployment, one cache. The assertion is
    // here so a future "shared registry" refactor has to fail this first.
    const first = new InMemoryLicencePayloadCache();
    const second = new InMemoryLicencePayloadCache();

    first.remember(validState());

    expect(second.current()).toBeNull();
  });
});
