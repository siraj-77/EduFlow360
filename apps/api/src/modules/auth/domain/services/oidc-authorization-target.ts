/**
 * Where this server is willing to send a browser.
 *
 * ## What the rule is for
 *
 * `GET /auth/oidc/redirect` answers with a `302`. The `Location` on that
 * response is a full navigation authority: whoever wrote it decides which site
 * the user is now looking at, and this route is `@Public`, so anybody on the
 * internet can ask it for one.
 *
 * The URL comes from the provider adapter, not from the request — that is
 * settled in `begin-oidc-sign-in.ts`, and it is the reason an inbound `?state=`
 * or `?return_to=` cannot influence this. What is *not* settled is what happens
 * if that adapter is wrong, is replaced, is a second provider, or is a port
 * somebody implements from the interface alone without reading
 * `google-oidc-provider.ts`. "The adapter looks correct" is not a control. It is
 * a comment.
 *
 * ## Why the check is in `domain/` and not in the controller
 *
 * It is a rule about a value, with no I/O and no framework: two strings in, a
 * boolean out. `AGENTS.md` 2 puts rules in `domain/services/` and orchestration
 * in `use-cases/`, and this is the rule half. The use-case calls it; the
 * controller never sees the question.
 *
 * ## The circularity, stated plainly
 *
 * The origin this rule compares against is derived from the *same* configured
 * endpoint that the adapter builds its URL from, so in today's implementation
 * the comparison cannot fail and it is defence in depth rather than a live
 * gate. That is a real limitation, not a rhetorical hedge, and it is stated here
 * so nobody later mistakes it for an independent check.
 *
 * What the comparison *does* catch today, independent of that circularity:
 *
 * - a scheme downgrade to `http` (the rule refuses `http` even when the expected
 *   origin is itself `http`, so a bad configuration fails closed);
 * - userinfo, a subdomain suffix, a trailing dot, or an unexpected port on an
 *   otherwise-correct host — the shapes a substring check would wave through;
 * - a future adapter whose `authorizationUrl` is influenced by anything other
 *   than its configuration, which is the day this becomes load-bearing.
 *
 * A genuinely independent allowlist is possible and was not chosen here: it
 * would mean a second place that knows Google's host is trusted, and two places
 * that must agree is one more thing to keep in step than one derived value.
 */

/** The only origin this deployment will send a browser to for a sign-in. */
export interface AuthorizationOriginPolicy {
  /** e.g. `https://accounts.google.com`. Derived from configuration. */
  readonly origin: string;
}

/**
 * Is this a URL this server will redirect a browser to?
 *
 * `expectedOrigin` is a single origin, not a list. A list is where this goes
 * wrong: it becomes a place where entries are added and nobody removes them.
 */
export const isTrustedAuthorizationUrl = (candidate: string, expectedOrigin: string): boolean => {
  let parsed: URL;
  try {
    // No base URL. A relative or protocol-relative string is therefore a parse
    // failure rather than something resolved against the current request, which
    // is the whole open-redirect surface.
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  // Absent and checked first, so no candidate is ever compared against an
  // unparsed policy.
  let policy: URL;
  try {
    policy = new URL(expectedOrigin);
  } catch {
    return false;
  }

  // `https` unconditionally, not "whatever the policy says". A policy that is
  // itself `http` makes this refuse rather than become permissive.
  if (parsed.protocol !== 'https:') return false;

  // Credentials in a `Location` are never acceptable, even when the host is the
  // one we expected: `https://someone@accounts.google.com/` reaches Google, but
  // it puts a username in front of a URL the user is about to trust.
  if (parsed.username !== '' || parsed.password !== '') return false;

  // Origin comparison, not `host.includes(expectedHost)`. `URL` normalises case
  // and drops a default `:443`, so `https://ACCOUNTS.GOOGLE.COM:443/...` is
  // accepted while `https://accounts.google.com.evil.test/` is not.
  return parsed.origin === policy.origin;
};
