/**
 * The web app's port, defined once.
 *
 * WHY IT IS NOT INLINE
 * --------------------
 * On 2026-09-29 this port was 3000 and appeared in four places: the `dev`
 * script, the `start` script, Playwright's `baseURL`, and `webServer.url`.
 * An unrelated application already bound to 3000 answered Playwright's
 * readiness probe with a 307 to its own login page and a 200. Playwright
 * declared the server ready, and the entire e2e suite ran against that app:
 * 11 failures, none of which mentioned the port, all of which looked exactly
 * like application bugs.
 *
 * A duplicated port fails silently and misleadingly, which is worse than
 * failing loudly. So it is a constant, and every consumer derives from it.
 *
 * It is 3500 rather than 3000 because another application on this machine
 * still holds 3000. `AGENTS.md` §2.14 applies here too: a port is a
 * deployment value, and the working value belongs in one place.
 *
 * `package.json` cannot import a constant — npm scripts are not a module
 * graph — so `dev` and `start` carry the literal and are held to it by a test.
 * That is the one place duplication survives, and it is deliberate rather
 * than accidental.
 */
export const WEB_PORT = 3500;
