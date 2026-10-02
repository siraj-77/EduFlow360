import { loadConfig, type AppConfig } from '../config/env.js';

/**
 * The synthetic environment every HTTP test boots with.
 *
 * ## Why the values live here rather than in each spec
 *
 * Three reasons, and the third is the one that bites.
 *
 * 1. **One secret, one place.** `JWT_ACCESS_SECRET` is the HMAC key the OIDC state
 *    store signs with. A test that asserts "the cookie this deployment issued can
 *    be opened by this deployment" has to sign and verify with the *same* key, so
 *    the key cannot be invented per spec. Spelling it once makes that structural
 *    rather than a coincidence two specs happen to share.
 * 2. **The values are visibly fake.** `AGENTS.md` 11 forbids a real-looking
 *    credential in a tracked file. Every value here says what it is in its own
 *    text, so a reader does not have to check whether `test-client-secret` is a
 *    real Google client secret that leaked into a repository.
 * 3. **Nothing reads `process.env`.** `main.ts` calls `loadEnvFiles()`, which
 *    loads the git-ignored `.env` and `.env.local` — so on a developer machine
 *    `process.env` holds *real Google credentials* at the moment a test runs. Any
 *    harness that called `loadConfig()` with no argument, or that let a value
 *    fall through to `process.env`, would be testing the developer's account and
 *    would pass or fail depending on their shell. `TEST_ENVIRONMENT` is the only
 *    input, so that failure mode has nowhere to occur.
 */

/**
 * At least 32 characters, because `HmacOidcStateStore`'s constructor refuses
 * anything shorter. Named so that it cannot be mistaken for a usable secret.
 */
export const TEST_JWT_ACCESS_SECRET = 'test-only-signing-key-of-adequate-length-0123456789';

export const TEST_GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
export const TEST_GOOGLE_CLIENT_SECRET = 'test-client-secret-not-a-real-credential';
export const TEST_GOOGLE_REDIRECT_URI = 'http://localhost:3001/auth/oidc/callback';

/** The browser origin the harness tells the application to allow. */
export const TEST_WEB_ORIGIN = 'http://localhost:3500';

/**
 * Exactly what a harness passes to `loadConfig`.
 *
 * `NODE_ENV: 'test'` is set rather than defaulted, so a harness assertion can
 * read it back and prove the value under test is the one it supplied.
 *
 * **`DATABASE_URL` is deliberately absent.** `GET /auth/oidc/redirect` reads and
 * writes no row, and `AppModule.forRoot` constructs no repository, so a harness
 * that needed a database to test this route would be adding a dependency the
 * route does not have. Its absence is asserted in `http-harness.spec.ts` rather
 * than assumed: if a future route reaches for persistence, the harness stops
 * working and says so, instead of silently requiring a live PostgreSQL from a
 * suite that `pnpm test` runs on every machine.
 */
export const TEST_ENVIRONMENT: NodeJS.ProcessEnv = Object.freeze({
  NODE_ENV: 'test',
  GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: TEST_GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: TEST_GOOGLE_REDIRECT_URI,
  JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
});

/**
 * The configuration a harness boots with, validated by the real schema.
 *
 * `loadConfig` rather than an `as unknown as AppConfig` cast, deliberately. A
 * cast would let this file drift from what the application accepts without
 * anything noticing, and the first symptom of that drift is a test suite booting
 * a shape production can never boot — which is precisely the class of defect
 * this repository has been repeatedly bitten by. Going through the real schema
 * also means a new required variable fails here, naming itself, rather than
 * arriving as `undefined` somewhere inside a use-case.
 */
export const testConfig = (): AppConfig => loadConfig(TEST_ENVIRONMENT).config;
