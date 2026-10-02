import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

/**
 * CSRF defence for the cookie transport settled by `D48`.
 *
 * ## Why this is NOT in the cookie adapter
 *
 * The obvious home for "CSRF protection" is beside the cookie, and that is the
 * wrong home. Four reasons, in order of how much they matter:
 *
 * 1. **They face opposite directions.** The cookie adapter is outbound — it
 *    writes onto a response. This is inbound — it reads a request. One class
 *    owning both is a class with two reasons to change, which is what
 *    `AGENTS.md` 2 (Interface Segregation) exists to prevent.
 *
 * 2. **The adapter cannot do this job.** Enforcing the header requires seeing
 *    the *incoming* request. The cookie adapter never sees one. Wiring it in
 *    would mean passing a request into a class whose entire interface is
 *    "put this in the browser", which is the god-interface smell precisely.
 *
 * 3. **The two populations are not the same.** A `POST /api/grades` made from
 *    an existing session sends the cookie and issues no new one. A
 *    `POST /auth/login` issues a cookie and sends none. Neither is covered by
 *    "protect the cookie", and both are covered by "protect the request".
 *
 * 4. **They are different specifications.** A cookie attribute is RFC 6265
 *    data on a response. A required request header is an RFC 9110 precondition
 *    on a request. `D48` describes the header as a *second, layered* control
 *    ("`SameSite=Lax` plus a required custom header"), not as an attribute of
 *    the cookie.
 *
 * So: this is a guard, `common/guards/` is where guards live, and it is a
 * **fourth, orthogonal** control. It is not one of the three `AGENTS.md` 2.3
 * requires. It enforces no permission, no entitlement and no audit rule — it
 * asks only whether the request could have been made by a browser that the
 * user did not intend to make it.
 *
 * ## What `SameSite=Lax` does and does not cover
 *
 * `Lax` stops the cross-*site* case: a form on `evil.com` does not get the
 * cookie. It does not stop a cross-*origin* request from a **same-site,
 * attacker-controlled subdomain** — `shop.school.edu` is same-site with
 * `api.school.edu`, so `Lax` attaches the cookie and the request is allowed.
 * For a single-school deployment that subdomain threat is realistic: DNS, a
 * lapsed hosting contract, or a student with an A record. This guard is the
 * layer that covers it, because a custom header is not something a subdomain
 * gets to attach to a cross-origin request without passing a CORS preflight,
 * and `main.ts` allows exactly one origin.
 *
 * ## Why an allow-list of safe methods
 *
 * The list is `GET`, `HEAD`, `OPTIONS` — and nothing else. The alternative,
 * a denylist of unsafe methods, is the more common mistake: it treats every
 * method nobody thought of as safe, so a newly added verb is unprotected until
 * somebody notices. Here an unknown verb is denied by construction.
 *
 * `TRACE` deserves a note because RFC 9110 §9.3.8 does classify it as safe and
 * this guard denies it. That is deliberate. Cross-site tracing is a real class
 * of attack, browsers forbid `fetch(..., { method: 'TRACE' })` outright, and no
 * EduFlow route is a `TRACE` route — so allowing it would buy nothing and cost
 * a header-disclosure surface. Denying it makes a stray `TRACE` return a 403
 * rather than a 404, which is a worse diagnostic and a better default.
 */

/**
 * The required request header.
 *
 * Custom and `x-`-prefixed so it is outside the CORS-safelisted request-header
 * set (Accept, Accept-Language, Content-Language, Content-Type, Range). That is
 * the whole mechanism: a browser attaches cookies to a cross-site request
 * automatically, but it cannot attach this header without a preflight the
 * attacker's origin will not be allowed to pass, and an HTML form cannot set
 * any custom header at all.
 */
export const CSRF_HEADER_NAME = 'x-eduflow-csrf';

/**
 * The complete set of methods treated as safe.
 *
 * `ReadonlySet`, and a frozen literal, so no caller can widen it at runtime.
 * Three entries. Every other token in the HTTP method space is state-changing
 * as far as this guard is concerned.
 */
export const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Is this method safe, by the allow-list above?
 *
 * Matching is exact and case-sensitive, which is the fail-closed direction: a
 * lower-case `get` is a *different* token, so it is denied. Express upper-cases
 * `req.method`, so no legitimate browser request is affected.
 */
export const isSafeMethod = (method: string): boolean => SAFE_METHODS.has(method);

/** The inverse, stated separately so call sites read as the question they ask. */
export const requiresCsrfHeader = (method: string): boolean => !isSafeMethod(method);

/**
 * Is the header present with a value?
 *
 * **No expected value is compared, and that is the design.** The stronger
 * design in the literature is a double-submit token: a random value in a
 * *script-readable* cookie, echoed in the header and compared here. That is not
 * used, because comparing a token requires the browser to be able to read it —
 * which puts a credential back within reach of any XSS on the web app, undoing
 * the `httpOnly` attribute `D48` settles. This header is a channel test, not a
 * credential. What matters is that the request came through a channel the
 * attacker does not control, and that channel does not depend on the value.
 *
 * A duplicated header arrives from Node as one comma-joined string, so `1, 2`
 * is accepted. The value is not the security property.
 */
export const isCsrfHeaderSatisfied = (value: string | string[] | undefined): boolean => {
  if (value === undefined) return false;
  // The array form is per-instance, so the question is "did the client attach
  // a value at all", not "does the concatenation contain a character". Joining
  // first and trimming would answer yes for `['', '']` — two empty headers join
  // to `","`, which is not blank. That is a bug this test caught: an empty
  // header is exactly the shape a proxy that strips values leaves behind.
  const candidates = Array.isArray(value) ? value : [value];
  return candidates.some((candidate) => candidate.trim().length > 0);
};

/**
 * The decision, as a pure function of the two things that matter.
 *
 * Split out of `canActivate` so the rule is testable without an application
 * context, and so the tests above exercise the *rule* rather than a Nest
 * mock. `canActivate` is a two-line shell over this.
 */
export const isCsrfRequestAcceptable = (request: {
  readonly method: string;
  readonly csrfHeader: string | string[] | undefined;
}): boolean => {
  if (!requiresCsrfHeader(request.method)) return true;
  return isCsrfHeaderSatisfied(request.csrfHeader);
};

/**
 * The refusal reason.
 *
 * It names the method and the header, and nothing else. In particular it never
 * echoes a header value, a cookie, or a token (`AGENTS.md` 2.13: logs redact
 * credentials).
 */
export const CSRF_REJECTION_MESSAGE =
  `CSRF check failed: this request method requires the ${CSRF_HEADER_NAME} request header. ` +
  'Cross-site form submissions and subresource loads cannot set it. See D48.';

/**
 * Applied globally in `app.module.ts`.
 *
 * **There is deliberately no exemption for unauthenticated requests.** The
 * usual carve-out is "only enforce when a session cookie is present", and it is
 * a bypass: an attacker who can get *any* cookie named as the session cookie
 * onto the victim's browser — from a subdomain, or by any other write — then
 * skips the check. A static header costs the web app nothing to send on every
 * request, so there is nothing to buy by carving the hole out.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const accepted = isCsrfRequestAcceptable({
      // `?? ''` rather than a default of `'GET'`: a request whose method
      // cannot be read is an unknown method, and an unknown method is denied.
      method: request?.method ?? '',
      csrfHeader: request?.headers?.[CSRF_HEADER_NAME],
    });

    if (!accepted) {
      // `console.warn` is permitted by the base config's `no-console`
      // allow-list. This moves to the AGENTS.md 2.15 structured logger once one
      // exists; until then it is the loudest available channel, and a refused
      // forgery is exactly the kind of thing an operator needs to see.
      console.warn(CSRF_REJECTION_MESSAGE);
    }

    return accepted;
  }
}
