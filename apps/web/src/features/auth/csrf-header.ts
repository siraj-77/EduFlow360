/**
 * The CSRF header every state-changing request must carry.
 *
 * ## Read this before removing anything from `buildSignInRequest`
 *
 * `apps/api` registers `CsrfGuard` **globally** in `app.module.ts`, and it
 * **enforces**. `GET`, `HEAD` and `OPTIONS` are the complete allow-list of safe
 * methods; every other verb is refused unless the request carries this header
 * with a non-blank value. `POST /auth/login` is a `POST`.
 *
 * The guard runs in the guard pipeline, which is **before** the controller, so
 * the refusal happens before the credential is read, before the throttle, and
 * before the use-case. A form that omits the header gets a bare `403` and looks
 * exactly like a credentials bug - which is the failure this file exists to make
 * impossible to write by accident. The e2e suite asserts the header is on the
 * wire, and `sign-in-request.spec.ts` asserts it is non-blank.
 *
 * ## Why the value is a constant and not a token
 *
 * The API side (`csrf.guard.ts`, `isCsrfHeaderSatisfied`) states the design: **no
 * expected value is compared**. This is not a weakened double-submit cookie; it
 * is a deliberate choice, because comparing a token requires the browser to be
 * able to READ it, which puts a credential back within reach of any XSS on the
 * web app and undoes the `httpOnly` attribute `D48` settles.
 *
 * So the header is a **channel test, not a credential**. What it proves is that
 * the request arrived through a channel the attacker does not control: a custom
 * `x-`-prefixed header cannot be attached to a cross-origin request without
 * passing a CORS preflight that only this app's origin passes, and an HTML form
 * cannot set any custom header at all. The value is irrelevant to that argument,
 * and inventing a random one would imply a comparison that does not exist.
 *
 * ## Why the name is duplicated here
 *
 * The name is a wire contract, and the API already exports it as
 * `CSRF_HEADER_NAME` from `common/guards/csrf.guard.ts`. It is repeated rather
 * than imported because `@eduflow/shared-types` is the package that would own a
 * contract shared by both sides, and it was outside this change's boundary. The
 * duplication is real and is called out in the sign-in report; moving it to
 * `@eduflow/shared-types` is a two-line follow-up that needs no behaviour change.
 */

/** Must equal `CSRF_HEADER_NAME` in `apps/api/src/common/guards/csrf.guard.ts`. */
export const CSRF_HEADER_NAME = 'x-eduflow-csrf';

/**
 * The value.
 *
 * Non-blank, and deliberately not random. The API checks
 * `candidate.trim().length > 0` and nothing else, so any non-blank string
 * satisfies it - see the header comment. It is namespaced so a network log
 * makes the origin of the request obvious, and it carries no secret.
 */
export const CSRF_HEADER_VALUE = 'eduflow-web';

/**
 * The headers a sign-in POST carries.
 *
 * `Accept` is not decoration: without it a server may answer `406`, and the
 * failure would look like an API problem rather than a request problem.
 * `Content-Type: application/json` is what makes this a request the browser
 * preflights, which is the mechanism the guard relies on.
 */
export function signInHeaders(): Readonly<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
  };
}

/**
 * True when a header bag satisfies the guard's rule.
 *
 * A faithful port of `isCsrfHeaderSatisfied` for the ONE shape this app produces,
 * used by the unit test to prove the value it sends would pass. Duplicated
 * rather than imported for the same boundary reason as the name; if the API ever
 * tightens the rule, this test is the thing that says so.
 */
export function satisfiesCsrfRule(headers: Readonly<Record<string, string>>): boolean {
  return (headers[CSRF_HEADER_NAME] ?? '').trim().length > 0;
}
