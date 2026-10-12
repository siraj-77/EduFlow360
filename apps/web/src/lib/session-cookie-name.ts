/**
 * The session cookie's name, as the WEB app knows it.
 *
 * The API owns the value — `apps/api/src/modules/auth/domain/ports/session-cookie.ts`
 * exports `SESSION_COOKIE_NAME = 'eduflow_session'` — and the web app must
 * not import from `apps/api`. So the name exists in both places, and
 * `session-cookie-name.spec.ts` reads the API's source and refuses a
 * drift. Two copies with a test is the pattern this repository already
 * uses for the locale set; two copies WITHOUT the test is how the two
 * apps would silently disagree about which cookie carries the session,
 * which is a login loop nobody can explain from the logs.
 */
export const SESSION_COOKIE_NAME = 'eduflow_session';
