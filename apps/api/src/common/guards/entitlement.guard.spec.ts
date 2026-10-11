import { Controller, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { instant } from '../../testing/instant.js';
import { RequireEntitlement } from './route-guards.decorator.js';
import { EntitlementGuard, certificateGrantsKey } from './entitlement.guard.js';
import type {
  ILicencePayloadCache,
  LicenceCacheState,
} from '../../modules/licensing/domain/ports/licence-payload-cache.js';
import type { LicencePayload } from '../../modules/licensing/domain/services/licence-payload.js';

/**
 * `EntitlementGuard` — the third guard, and the one that makes
 * `@RequireEntitlement` a control (`PLT-302`).
 *
 * ## What this guard must never do: fail open
 *
 * Every state that is not "a valid certificate that grants this key" is a
 * refusal. A tampered certificate, an expired one, a cache that has never
 * been refreshed, a repository that cannot be read — all 403. The opposite
 * choice (treat "unknown" as "allowed") would make an attacker's licence
 * edit into a feature unlock, and would make a boot failure into a bypass.
 *
 * ## Why the refusal body names the reason CATEGORY and not the certificate
 *
 * The caller must not learn whether the licence expired, was tampered, or
 * names different keys — that is a map of what someone else owns. What an
 * administrator needs is on the health endpoint, which reads the same cache
 * with the full reason.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────
const payload = (
  features: Record<string, boolean | string> = {},
  modules: readonly string[] = ['academics', 'finance'],
): LicencePayload => ({
  product: 'EduFlow360',
  edition: 'Deluxe',
  schoolId: 'sch_om_muscat_01',
  schoolName: 'Muscat International Academy',
  activationDate: new Date('2026-09-01T00:00:00.000Z'),
  expiryDate: new Date('2027-08-31T23:59:59.000Z'),
  allowedModules: modules,
  limits: {},
  features,
});

/** A cache holding one state. The port's shape, nothing more. */
const cacheWith = (state: LicenceCacheState | null): ILicencePayloadCache => ({
  current: () => state,
  remember: () => {
    throw new Error('the guard must not write the cache');
  },
});

@Controller('admin')
class EntitledController {
  /** A FEATURE key — granted through `features`. */
  @RequireEntitlement('ai_chatbot')
  chatbot(): { readonly ok: true } {
    return { ok: true };
  }

  /** A MODULE key — granted through `allowed_modules` (ADR-023). */
  @RequireEntitlement('facilities')
  facilities(): { readonly ok: true } {
    return { ok: true };
  }

  plain(): { readonly ok: true } {
    return { ok: true };
  }
}

const controller = new EntitledController();

const contextFor = (handler: (...args: never[]) => unknown): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => EntitledController,
    switchToHttp: () => ({ getRequest: () => ({ principal: { sessionId: 's', userId: 'u' } }) }),
  }) as unknown as ExecutionContext;

const guardWith = (state: LicenceCacheState | null) =>
  new EntitlementGuard(new Reflector(), cacheWith(state));

/** Decide, and return either `true` or the thrown error. */
const decide = async (state: LicenceCacheState | null, handler: (...args: never[]) => unknown) => {
  const context = contextFor(handler);
  try {
    return await guardWith(state).canActivate(context);
  } catch (error) {
    return { error: error as { getStatus(): number; getResponse(): unknown } };
  }
};

const VALID = (
  features: Record<string, boolean | string> = {},
  modules: readonly string[] = ['academics', 'finance'],
): LicenceCacheState => ({
  outcome: 'valid',
  payload: payload(features, modules),
  validatedAt: new Date('2026-10-11T09:00:00.000Z'),
});

/** The thrown error's status, or a marker if nothing was thrown. */
const statusOf = (result: boolean | { error: { getStatus(): number } }): number | 'allowed' =>
  typeof result === 'boolean' ? 'allowed' : result.error.getStatus();

describe('EntitlementGuard — a route with no @RequireEntitlement', () => {
  it('passes through untouched, the exemption the matrix records', async () => {
    expect(await decide(VALID(), controller.plain)).toBe(true);
  });
});

describe('EntitlementGuard — a valid certificate and a FEATURE key', () => {
  it('allows a feature the certificate grants as true', async () => {
    expect(await decide(VALID({ ai_chatbot: true }), controller.chatbot)).toBe(true);
  });

  it('allows a feature the certificate names as a provider string', async () => {
    // `video_conferencing_provider: "zoom"` is the corpus's own shape: the
    // feature is ON and its value chooses a provider. A string value is an
    // enabled feature, so the value must not be read as "not a boolean".
    @Controller('admin')
    class StringFeatureController {
      @RequireEntitlement('video_conferencing_provider')
      classroom(): { readonly ok: true } {
        return { ok: true };
      }
    }

    const stringController = new StringFeatureController();

    expect(
      await decide(VALID({ video_conferencing_provider: 'zoom' }), stringController.classroom),
    ).toBe(true);
  });

  it('refuses a feature the certificate turns off', async () => {
    // The Deluxe-only feature on a Standard school: the certificate names it
    // and sets it false. That is a deliberate OFF, not an unknown.
    expect(statusOf(await decide(VALID({ ai_chatbot: false }), controller.chatbot))).toBe(403);
  });

  it('refuses a key the certificate does not name at all', async () => {
    // No key in `features` and none in `allowed_modules`: the certificate is
    // genuine and silent about this capability.
    expect(statusOf(await decide(VALID({}), controller.chatbot))).toBe(403);
  });
});

describe('EntitlementGuard — a valid certificate and a MODULE key', () => {
  it('allows a module the certificate grants through allowed_modules', async () => {
    // ADR-023's two rules: module keys gate registry rows, feature keys gate
    // capabilities, and @RequireEntitlement may carry either.
    expect(await decide(VALID({}, ['facilities']), controller.facilities)).toBe(true);
  });

  it('refuses a module it does not list', async () => {
    expect(statusOf(await decide(VALID({}, ['academics']), controller.facilities))).toBe(403);
  });
});

describe('EntitlementGuard — every state that is not valid is a refusal', () => {
  it('refuses when the cache has never been refreshed', async () => {
    // A guard that answered "allow" here would make a failed boot a bypass.
    expect(statusOf(await decide(null, controller.chatbot))).toBe(403);
  });

  it('refuses an expired certificate', async () => {
    // Expired is not revoked: the expiry check is `PLT-305`'s grace period's
    // to soften, and until then a lapsed licence buys nothing.
    expect(
      statusOf(
        await decide(
          {
            outcome: 'expired',
            payload: payload({ ai_chatbot: true }),
            validatedAt: instant('2026-10-11T09:00:00.000Z'),
          },
          controller.chatbot,
        ),
      ),
    ).toBe(403);
  });

  it('refuses a tampered certificate', async () => {
    expect(
      statusOf(
        await decide(
          { outcome: 'invalid-signature', validatedAt: instant('2026-10-11T09:00:00.000Z') },
          controller.chatbot,
        ),
      ),
    ).toBe(403);
  });

  it('refuses a schema error and an unsupported scheme', async () => {
    expect(
      statusOf(
        await decide(
          {
            outcome: 'schema-error',
            reason: 'x',
            validatedAt: instant('2026-10-11T09:00:00.000Z'),
          },
          controller.chatbot,
        ),
      ),
    ).toBe(403);
    expect(
      statusOf(
        await decide(
          {
            outcome: 'unsupported-scheme',
            version: 2,
            validatedAt: instant('2026-10-11T09:00:00.000Z'),
          },
          controller.chatbot,
        ),
      ),
    ).toBe(403);
  });

  it('refuses when the deployment holds no licence at all', async () => {
    // A fresh deployment has nothing. Feature-gated routes are closed until
    // a certificate exists — the opposite default would ship the product
    // unlocked.
    expect(
      statusOf(
        await decide(
          {
            outcome: 'absent',
            reason: 'no licence row',
            validatedAt: instant('2026-10-11T09:00:00.000Z'),
          },
          controller.chatbot,
        ),
      ),
    ).toBe(403);
  });
});

describe('EntitlementGuard — what the refusal tells the caller', () => {
  it('answers 403 with one frozen body, whatever the state', async () => {
    // A caller must not be able to tell an expired certificate from a
    // tampered one from a missing one: all three are "this installation is
    // not licensed for this route" to them. One body is the whole defence.
    for (const state of [
      null,
      {
        outcome: 'expired',
        payload: payload({ ai_chatbot: true }),
        validatedAt: instant('2026-10-11T09:00:00.000Z'),
      },
      { outcome: 'invalid-signature', validatedAt: instant('2026-10-11T09:00:00.000Z') },
      {
        outcome: 'absent',
        reason: 'no licence row',
        validatedAt: instant('2026-10-11T09:00:00.000Z'),
      },
      VALID({ ai_chatbot: false }),
    ] as readonly (LicenceCacheState | null)[]) {
      const result = await decide(state, controller.chatbot);
      expect(result !== true && result.error.getResponse()).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message:
          "This installation's licence does not include the capability required by this route.",
      });
    }
  });
});

describe('certificateGrantsKey — the rule, as a pure function', () => {
  it('grants a true feature and a non-empty provider string', () => {
    expect(certificateGrantsKey(payload({ ai_chatbot: true }), 'ai_chatbot')).toBe(true);
    expect(
      certificateGrantsKey(
        payload({ video_conferencing_provider: 'zoom' }),
        'video_conferencing_provider',
      ),
    ).toBe(true);
  });

  it('refuses a false feature and an empty provider string', () => {
    expect(certificateGrantsKey(payload({ ai_chatbot: false }), 'ai_chatbot')).toBe(false);
    expect(
      certificateGrantsKey(
        payload({ video_conferencing_provider: '' }),
        'video_conferencing_provider',
      ),
    ).toBe(false);
  });

  it('grants a module key through allowed_modules, and only there', () => {
    expect(certificateGrantsKey(payload({}, ['facilities']), 'facilities')).toBe(true);

    // The module-in-features case is UNREACHABLE here and deliberately not
    // asserted: `parseLicencePayload` refuses `facilities` as a feature key
    // (it is not in `FEATURE_KEYS`), so a validated certificate cannot carry
    // it. The guard reads only validated payloads, and the schema is what
    // keeps the two key spaces apart — which is the same reason
    // `licence-payload.spec.ts` asserts unknown keys are refused.
    expect(certificateGrantsKey(payload({}), 'facilities')).toBe(false);
  });
});
