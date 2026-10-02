import { SetMetadata } from '@nestjs/common';

/**
 * The only exemption from `@RequirePermission`.
 *
 * `AGENTS.md` 2.3: "`@Public('<reason>')` is the only exemption from
 * `@RequirePermission`. The reason is mandatory." This decorator makes both
 * halves of that true in the type system rather than in review:
 *
 * - **A reason is required.** There is no zero-argument overload. A public
 *   route has to state why it is reachable without a permission, and that
 *   sentence is what makes the exemption reviewable instead of invisible.
 * - **The reason is non-empty.** `@Public('')` is refused by the guard, not by
 *   convention, so "someone typed a quote" cannot pass.
 *
 * ## Why the allowlist, and why it is checked in
 *
 * `AGENTS.md` 2.3 also says "every `@Public` use is listed in a checked-in
 * allowlist file with its justification, so exemptions are reviewable rather
 * than invisible." That file is `route-guards.allowlist.json`, and
 * `check-route-guards` fails the build when the decorator and the file
 * disagree in either direction: a route with no entry, or an entry with no
 * route.
 *
 * Without that second check the allowlist decays. A decorator added and not
 * listed would still work, and the file would slowly become a lie - which is
 * the failure mode of every allowlist nobody reconciles.
 */
export const PUBLIC_ROUTE_KEY = 'eduflow:public-route';

export interface PublicRouteMetadata {
  /** Why this route is reachable without a permission. Mandatory, non-empty. */
  readonly reason: string;
}

/**
 * Mark a route as reachable without a permission.
 *
 * @param reason Why the exemption is correct. Checked in to
 *   `route-guards.allowlist.json`; a mismatch fails `pnpm check:route-guards`.
 */
export const Public = (reason: string): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ROUTE_KEY, { reason: sanitizeReason(reason) } satisfies PublicRouteMetadata);

/**
 * Reject a blank reason here rather than in the guard, so the mistake surfaces
 * at the decorator call site in the same stack as the route that has it.
 */
function sanitizeReason(reason: string): string {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error(
      "@Public requires a non-empty reason (AGENTS.md 2.3: 'the reason is mandatory'). " +
        'An exemption nobody can justify is not an exemption, it is a hole with a comment on it. ' +
        'Also add the route to route-guards.allowlist.json.',
    );
  }
  return reason.trim();
}
