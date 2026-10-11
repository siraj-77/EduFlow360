import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENT_KEY } from './route-guards.decorator.js';
import {
  I_LICENCE_PAYLOAD_CACHE,
  type ILicencePayloadCache,
} from '../../modules/licensing/domain/ports/licence-payload-cache.js';
import type { LicencePayload } from '../../modules/licensing/domain/services/licence-payload.js';

/**
 * `EntitlementGuard` — the gate `AGENTS.md` §2.3 made mandatory and `PLT-01`
 * left as vocabulary (`PLT-302`).
 *
 * ## What this file changes
 *
 * `@RequireEntitlement` recorded a key and nothing read it, so a Basic-edition
 * school could reach Deluxe functionality by calling the API directly. This
 * guard is registered globally in `app.module.ts` exactly like
 * `PermissionGuard` — a control that requires per-route opt-in is a control
 * whose absence is invisible in review.
 *
 * ## The one decision: every non-valid state refuses
 *
 * The cache holds what `RefreshCachedLicence` judged. A valid certificate
 * that grants the key passes; EVERY other state — expired, tampered,
 * unparseable, unknown scheme, absent, or a cache nobody has refreshed —
 * answers 403. The opposite default ("allow when unknown") would make a
 * failed boot or an edited certificate into a feature unlock, which is the
 * exact threat `ADR-009` defends against.
 *
 * ## What a caller learns, and what an administrator learns
 *
 * The body names the capability and nothing else: not the edition, not the
 * expiry, not the school, and not whether the certificate was tampered or
 * merely lapsed. That detail is the health endpoint's to report, reading the
 * same cache with the full reason — and `PLT-305`'s degradation UI is where
 * an administrator sees which.
 */

/** The frozen refusal body — one body for every refusal, so nothing leaks through variety. */
const NOT_ENTITLED_BODY = Object.freeze({
  statusCode: 403,
  error: 'Forbidden',
  message: "This installation's licence does not include the capability required by this route.",
});

/**
 * The one place a certificate is asked about a key.
 *
 * A key is granted when `features[key]` is `true` or a non-empty string — the
 * corpus's own `video_conferencing_provider: "zoom"` shape, where the feature
 * is ON and its value names a provider — or when `allowed_modules` carries
 * it. Those are `ADR-023`'s two rules: module keys gate registry rows,
 * feature keys gate capabilities, and `@RequireEntitlement` may carry either.
 *
 * Exported as a pure function so the rule is table-testable without a
 * container, and so the health endpoint and the UI's feature list read the
 * SAME rule rather than a copy of it.
 */
export function certificateGrantsKey(payload: LicencePayload, key: string): boolean {
  const feature = payload.features[key];
  if (feature === true) return true;
  if (typeof feature === 'string' && feature.length > 0) return true;
  return payload.allowedModules.includes(key);
}

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    // Optional so a database-less deployment still boots (`ADR-019`): with no
    // cache, no route can hold a validated certificate, and every
    // @RequireEntitlement route is refused by name rather than crashing the
    // container.
    @Optional()
    @Inject(I_LICENCE_PAYLOAD_CACHE)
    private readonly cache?: ILicencePayloadCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read under the same key `@RequireEntitlement` writes — the metadata key
    // is a shared constant, not a literal, for the same reason
    // `PermissionGuard` uses `PERMISSION_KEY`: two spellings of one key is a
    // decorator that silently stops being read.
    const key = this.reflector.getAllAndOverride<unknown>(ENTITLEMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Absent is the exemption the matrix records: the route is not feature-
    // gated, and this guard has nothing to say about it.
    if (key === undefined || key === null) return true;

    const required = typeof key === 'string' ? key : ENTITLEMENT_KEY;
    const state = this.cache?.current() ?? null;

    // Fail closed, with one refusal for every non-granting state. The body is
    // the frozen one because a caller must not be able to tell an expired
    // certificate from a tampered one — both are "not entitled" to them.
    if (
      state === null ||
      state.outcome !== 'valid' ||
      !certificateGrantsKey(state.payload, required)
    ) {
      throw new ForbiddenException(NOT_ENTITLED_BODY);
    }

    return true;
  }
}
