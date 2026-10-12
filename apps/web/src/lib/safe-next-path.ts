/**
 * The one place a `next` parameter is decided safe.
 *
 * ## Why this exists
 *
 * `PLT-1002` redirects an anonymous caller to sign-in with a `next`
 * parameter and back to their destination after the password check.
 * A `next` that is honoured verbatim is an OPEN REDIRECT: the link
 * `school.edu/en/sign-in?next=https://evil.example` is a page the
 * school controls that sends the visitor to an attacker's site, which
 * is the shape a phishing kit needs because the first hop looks
 * legitimate. `PLT-1002` AC-3 names the variants — absolute,
 * protocol-relative, and encoded — and this function is the whole
 * answer to them.
 *
 * ## The rules, and the bypass each one closes
 *
 * The function returns a value only when the input is a path THIS
 * site can serve. Everything else falls back.
 *
 *  1. **Trim.** Browsers strip leading and trailing whitespace from a
 *     URL before parsing it, so `" /admin"` and `"/admin "` both mean
 *     `/admin`. Trimming first means the rules below see the string
 *     the browser will see.
 *  2. **Decode once, and refuse malformed input.** `%2F%2Fevil.com`
 *     decodes to `//evil.com`, which rule 4 then rejects. A malformed
 *     escape (`%zz`, a lone `%`) is not a path this app produced, so
 *     it falls back rather than being repaired.
 *  3. **Must start with `/`.** That is what makes it relative to this
 *     origin. It excludes every absolute URL (`https:`, `javascript:`,
 *     `data:`) by construction.
 *  4. **Must not start with `//` or `/\`.** A protocol-relative URL
 *     (`//evil.example`) is an absolute URL to another origin, and
 *     browsers normalise `/\` to `//` before the request leaves, so
 *     the two forms are the same attack.
 *  5. **No control characters anywhere.** Browsers strip TAB, LF and
 *     CR from a URL before parsing it, so `/%09/evil.example` becomes
 *     `//evil.example` after the strip — a protocol-relative URL
 *     assembled from a string that passed rule 4. The strip is the
 *     bypass; refusing the characters is the fix.
 *  6. **No backslash anywhere.** A backslash is not valid in a URL
 *     path, and `\` is normalised to `/` by browsers in the authority
 *     position, so any occurrence is an attempt to assemble `//`
 *     rather than a path this app generated.
 *
 * ## What it deliberately does NOT do
 *
 * It does not check that the path EXISTS. A stale in-app path is a
 * 404 the visitor can see, which is a product defect, not a security
 * one. It does not check the locale: the caller owns the prefix.
 */

/** TAB, LF and CR — the characters browsers strip from URLs. */
const CONTROL_CHARACTERS = /[\t\n\r]/;

/**
 * Decide where a sign-in may return a caller.
 *
 * @param raw - the `next` parameter, exactly as received
 * @param fallback - where to go when `raw` is absent or refused
 * @returns `raw`, or `fallback` — never an absolute URL
 */
export function safeNextPath(raw: string | undefined | null, fallback: string): string {
  if (typeof raw !== 'string') {
    return fallback;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // A malformed percent-escape is not a path this app produced.
    return fallback;
  }

  if (!decoded.startsWith('/')) {
    return fallback;
  }

  if (CONTROL_CHARACTERS.test(decoded) || decoded.includes('\\')) {
    return fallback;
  }

  if (decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return fallback;
  }

  return decoded;
}
