/**
 * The permission decision, as a rule with no framework in it.
 *
 * ## Why a rule and not a lookup helper
 *
 * `AGENTS.md` 2.3 makes permission the only thing that gates a route, so the guard
 * that enforces it is the control this repository most needs to get right — and the
 * cheapest way to get a security decision wrong is to bury it inside plumbing.
 * `CsrfGuard` already splits its rule into `isCsrfRequestAcceptable` and
 * `SessionGuard` into `isPublicRoute` for exactly this reason. This is the same
 * move, and it lives under `domain/` because it imports nothing: no NestJS, no ORM,
 * no clock (`AGENTS.md` 2.2, 2.4).
 *
 * ## What it decides, and what it deliberately does not
 *
 * One question: may this caller reach this route?
 *
 * It does **not** decide whether a user may read *this particular* record. That is
 * ownership — teacher to own classes, parent to own children, vendor to own outlet —
 * and `AGENTS.md` 2.3 requires it, but it is **`PLT-203`** and the data model it
 * needs does not exist: `User` carries no student, teacher or parent relationship and
 * there is no `IOwnershipPolicy` port. Inventing one here would be `AGENTS.md` 6's
 * failure mode — a fabricated rule filling a table that is honestly empty. So this
 * rule answers the role question only, and the gap is recorded in
 * `permission-grant-reader.ts` rather than papered over with a `TODO` that reads like
 * a plan.
 *
 * ## Why the rule OWNS the lookup instead of being handed its answer
 *
 * The first version took `granted?: boolean` and left the guard to call the reader
 * first. That is correct only if the guard checks every precondition before asking,
 * and the failure mode of forgetting is subtle and expensive: a database round trip
 * in front of `GET /auth/oidc/redirect`, the one route a browser reaches before a
 * session exists.
 *
 * So the reader arrives as a **function this rule calls**, not a value it reads. Two
 * properties then hold structurally rather than by convention:
 *
 * - the reader cannot be consulted until every precondition has passed, and
 * - it cannot be consulted twice, or not at all when it must be.
 *
 * `decide-permission.spec.ts` asserts both by counting invocations, which is the only
 * honest way to test whether the database was touched.
 *
 * ## The property this file exists to guarantee: it fails CLOSED
 *
 * Five ways to be refused, and — outside the `@Public` exemption — exactly one way to
 * be allowed. Every refusal is a way the answer could have become "allowed" by
 * accident:
 *
 * - a route naming neither a permission nor `@Public` (no requirement, so no check);
 * - a blank key, which checks for nothing and looks identical on the route to one
 *   that does;
 * - no principal, because `SessionGuard` did not resolve one;
 * - no reader wired, because the deployment has no database;
 * - no grant — including a reader answering anything other than boolean `true`.
 */

/**
 * What the route's metadata asks for.
 *
 * Resolved from `Reflector` in `common/guards/permission.guard.ts`, because
 * `Reflector` is a NestJS type and `domain/` may not import one (`AGENTS.md` 2.2).
 * The split is deliberate: reading metadata is framework work, deciding what it means
 * is not, and only the first half needs the framework.
 */
export type PermissionRequirement =
  /**
   * `@Public('<reason>')` — the one exemption `AGENTS.md` 2.3 names.
   *
   * Spelled as a block rather than a single-line JSDoc deliberately: `check-route-guards`
   * skips a comment line only when it TRIMS to something starting with `*`, and a
   * one-line `/** ... *\/` opener starts with `/`. Writing the decorator name on such a
   * line makes the checker read documentation as a route and demand an allowlist entry
   * for it.
   */
  | { readonly kind: 'public' }
  /** `@RequirePermission('<KEY>')`. The key arrives untrimmed; trimming is decided here. */
  | { readonly kind: 'permission'; readonly key: string }
  /** Neither marker. A defect in the source, per `AGENTS.md` 2.3. */
  | { readonly kind: 'unmarked' };

/**
 * Why a request was refused.
 *
 * Enumerated rather than a bare `false` because the operator log has to distinguish a
 * wiring fault from an ordinary denial — they send an administrator to completely
 * different places — while the wire answer stays one identical 403. See
 * `permission.guard.ts`.
 */
export type PermissionDenialReason =
  /** The route carries neither `@RequirePermission` nor `@Public`. */
  | 'NO_PERMISSION_REQUIRED'
  /** The route names a permission, but the key is empty or whitespace. */
  | 'BLANK_PERMISSION_KEY'
  /** No principal: `SessionGuard` did not resolve one, which is a wiring fault. */
  | 'NO_PRINCIPAL'
  /** No `IPermissionGrantReader` is registered, so no grant can be evaluated. */
  | 'NO_GRANT_READER'
  /** The caller's roles do not grant this key — including "the reader said anything but true". */
  | 'NOT_GRANTED';

export type PermissionDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: PermissionDenialReason };

/** The facts the rule needs. */
export interface PermissionFacts {
  readonly requirement: PermissionRequirement;
  /** Whether `SessionGuard` attached a principal to this request. */
  readonly hasPrincipal: boolean;
  /**
   * Asks whether the caller's roles grant `permissionKey`.
   *
   * Absent means no reader is wired at all. Called **at most once**, and only after
   * every other precondition has passed — which is the whole reason it is a function
   * rather than a value.
   */
  readonly lookup?: ((permissionKey: string) => Promise<boolean>) | undefined;
}

/**
 * Decide whether a caller may reach a route.
 *
 * The order of the checks is load-bearing and is asserted by name in the spec: each
 * refusal names the *first* thing wrong, because an operator told "no principal" when
 * the real fault is an unmarked route will go and inspect the cookie instead of the
 * controller.
 *
 * @throws whatever `lookup` throws. A reader failure is not a permission decision,
 *   so it is not caught here and not folded into `false` — see below.
 */
export async function decidePermissionAccess(facts: PermissionFacts): Promise<PermissionDecision> {
  const { requirement } = facts;

  // The exemption, first and unconditionally. A `@Public` route is reachable before a
  // session exists — that is what sign-in IS — so consulting a principal or a reader
  // here would make authentication impossible while every other gate stayed green.
  if (requirement.kind === 'public') return { allowed: true };

  // Fail closed on an unmarked route. "No requirement" is NOT "no restriction": it is a
  // route somebody added without deciding who may call it, which `AGENTS.md` 2.3 calls
  // a defect and which `check-route-guards` fails the build on. This is the runtime half
  // of that rule, for the file the checker never scanned.
  if (requirement.kind === 'unmarked') {
    return { allowed: false, reason: 'NO_PERMISSION_REQUIRED' };
  }

  // A blank key is refused rather than looked up. `@RequirePermission` already throws on
  // one at the call site, so this is belt-and-braces against metadata set by other
  // means — and the direction matters: an empty string is a real, findable
  // `Permission.key` the day somebody seeds one, and treating it as a wildcard then
  // would hand over whatever they seeded.
  if (requirement.key.trim().length === 0) {
    return { allowed: false, reason: 'BLANK_PERMISSION_KEY' };
  }

  // Unreachable in a correctly wired application, because `SessionGuard` runs first and
  // refuses before this guard is consulted. Refusing keeps it that way if the
  // registration order in `app.module.ts` ever changes.
  if (!facts.hasPrincipal) return { allowed: false, reason: 'NO_PRINCIPAL' };

  // A deployment with no database registers no reader. "We cannot evaluate this" is
  // neither "yes" nor "no", and answering either would let a missing dependency read as
  // a working installation.
  const { lookup } = facts;
  if (lookup === undefined) return { allowed: false, reason: 'NO_GRANT_READER' };

  // Not wrapped in a try/catch. A database outage is not a permission decision: folding
  // it into `false` would surface as a 403 that reads like policy and send an operator
  // to inspect a role instead of the database. Letting it propagate makes it a 500,
  // which says what it is.
  const granted = await lookup(requirement.key);

  // `=== true`, not a truthiness test. A reader returning a truthy non-boolean is either
  // a broken adapter or a substituted one, and neither should open a route by accident.
  return granted === true ? { allowed: true } : { allowed: false, reason: 'NOT_GRANTED' };
}
