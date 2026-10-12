/**
 * Where the API lives.
 *
 * ## Why this is a file
 *
 * The API is a separate service (`AGENTS.md` 3.1: the web app is UI, there are
 * no server actions and no data fetching from this app's server), so the web
 * app has to know its address. That is a **deployment value** - the same class
 * as `WEB_PORT` next door - and `AGENTS.md` 2.14 puts every one of those in
 * configuration rather than in code.
 *
 * Two forms are supported because a single-school deployment has both shapes:
 *
 *   - **Absolute** (`https://api.school.edu`) - local development, and two
 *     deployments behind one hostname. The browser treats it as cross-origin,
 *     so it sends a CORS preflight (which is also why the CSRF header works as
 *     a channel test at all - see `features/auth/csrf-header.ts`).
 *   - **Root-relative** (`/api`) - the production shape. A school's deployment
 *     is one host with the API behind a reverse proxy, which makes every request
 *     same-origin: no preflight, and the `httpOnly` session cookie is stored
 *     without needing `Access-Control-Allow-Credentials`.
 *
 * The relative form is not a convenience. It is the form in which the session
 * cookie actually survives the login round trip, and it is why the e2e suite
 * runs with `NEXT_PUBLIC_API_BASE_URL=/api` (see `playwright.config.ts`).
 *
 * ## The fallback, stated plainly
 *
 * `LOCAL_API_ORIGIN` is the API's OWN default, not a guess: `PORT` defaults to
 * `3001` in `apps/api/src/config/env.ts`, and the API's CORS allow-list names
 * this app at `http://localhost:3500`, which is `WEB_PORT`. Both halves come
 * from the other side of the workspace, so the pair cannot disagree with it.
 *
 * `AGENTS.md` 11 asks for no *silent* defaults, and this is not one: the value
 * is named, exported, documented, and asserted by a unit test. A deployment that
 * needs something else sets the variable.
 */

/** The API's own default `PORT`, from `apps/api/src/config/env.ts`. */
export const LOCAL_API_PORT = 3001;

/**
 * The origin the API serves on unless configured otherwise.
 *
 * `PLT-1001`'s no-hard-coded-localhost ban is exempted HERE and only
 * here, at the site, for the reason the header above states: this is the
 * API's own default assembled from the API's own default `PORT`, it is
 * named and exported rather than buried, and `api-base-url.spec.ts`
 * asserts the value. A deployment that needs another origin sets
 * `NEXT_PUBLIC_API_BASE_URL`, which wins. An allowlist FILE would hide
 * that reasoning; a comment at the line keeps it.
 */
// eslint-disable-next-line no-restricted-syntax -- PLT-1001: the documented web-side dev fallback, asserted by api-base-url.spec.ts; see the header.
export const LOCAL_API_ORIGIN = `http://localhost:${LOCAL_API_PORT}`;

/**
 * Resolve the base URL, absolute or root-relative.
 *
 * A trailing slash is stripped so callers can join paths with a single leading
 * slash and get exactly one separator. `/api/` + `/auth/login` must be
 * `/api/auth/login`, not `/api//auth/login` - a double slash is a different
 * path to most routers and a reliable way to get a 404 that reads like a bug.
 */
export function resolveApiBaseUrl(configured: string | undefined): string {
  const raw =
    configured === undefined || configured.trim() === '' ? LOCAL_API_ORIGIN : configured.trim();

  return raw.endsWith('/') ? raw.replace(/\/+$/, '') : raw;
}

/** The value the running app uses. */
export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

/** `true` when the API is same-origin, which is the production shape. */
export function isSameOriginApi(baseUrl: string): boolean {
  // `//` is EXCLUDED deliberately. A protocol-relative URL begins with a slash and
  // is absolute, so a bare `startsWith('/')` would classify `//api.school.edu` as
  // same-origin - and that classification is not cosmetic: it is what decides
  // whether the browser preflights, and the preflight is the entire mechanism the
  // CSRF header check rests on. A guard that reads true for the one value that
  // needs the most care is worse than no guard.
  return baseUrl.startsWith('/') && !baseUrl.startsWith('//');
}

/** Absolute URL for a path on the API, for `fetch` and for tests. */
export function apiUrl(path: string, baseUrl: string = API_BASE_URL): string {
  // The trailing slash is stripped HERE as well as in `resolveApiBaseUrl`, because
  // `baseUrl` is a parameter: a caller that passes `'/api/'` must get
  // `/api/auth/login`, not `/api//auth/login`. A double slash is a different
  // path to most routers and is a 404 that reads like a bug.
  const base = baseUrl.replace(/\/+$/, '');

  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
