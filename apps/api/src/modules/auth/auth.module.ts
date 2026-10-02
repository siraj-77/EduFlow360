import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { AppConfig } from '../../config/env.js';
import { OidcSignInController } from './controllers/oidc-sign-in.controller.js';
import { GoogleOidcProvider } from './infrastructure/adapters/google-oidc-provider.js';
import { HmacOidcStateStore } from './infrastructure/adapters/oidc-state-store.js';
import { SystemClock } from './infrastructure/adapters/system-clock.js';
import { BeginOidcSignIn } from './use-cases/begin-oidc-sign-in.js';

/**
 * `AuthModule` — the wiring, and nothing else.
 *
 * ## Why there is no business logic in this file
 *
 * Every rule lives in `domain/`, every decision lives in a use-case, and every
 * vendor detail lives in an adapter. What is left is the part that knows *which*
 * of those to construct from *which* environment variable, which is a genuine
 * fourth thing and belongs in the module file. `AGENTS.md` 2's Interface
 * Segregation is not "no file may contain more than one class" — it is "no class
 * owns more than one reason to change". This file owns one.
 *
 * ## Why `forRoot`, and why it takes the configuration as an argument
 *
 * Two reasons, and the first is the important one:
 *
 * 1. **Ordering.** `loadEnvFiles()` runs in `main.ts` *before* the Nest
 *    application is created, precisely because `.env` is not in `process.env`
 *    until then. Anything that read the environment while the `@Module`
 *    decorator was being evaluated — a top-level `const`, or a `useFactory`
 *    reached at import time — would run before the env files are read. This
 *    repository lost a day to exactly that. So configuration arrives as a
 *    parameter, from `main.ts`, after validation.
 * 2. **The route has to be conditional.** A deployment with no Google
 *    credentials must still boot — `bootBanner` says so in as many words
 *    ("sign-in is unavailable"), and refusing to start would turn an
 *    unconfigured optional feature into an outage. See below.
 */

/** DI tokens. Symbols rather than classes, because the ports are interfaces. */
export const IOIDC_PROVIDER = Symbol('IOIDC_PROVIDER');
export const IOIDC_STATE_STORE = Symbol('IOIDC_STATE_STORE');
export const AUTHORIZATION_ORIGIN = Symbol('AUTHORIZATION_ORIGIN');

/**
 * Google's authorization endpoint, stated here rather than inherited.
 *
 * `GoogleOidcProvider` carries this as a default. Passing it explicitly means
 * the origin the redirect check trusts and the endpoint the URL is built from
 * are the same string, set in one place, and that neither is a default nobody
 * chose. This is configuration: `AGENTS.md` 2 forbids a hard-coded provider in a
 * *use-case*, which is exactly why it lives in the module and is injected rather
 * than hardcoded where the check happens.
 */
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

/** The three Google values, narrowed to strings, or nothing at all. */
interface GoogleSignInConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

/**
 * Read the Google credentials.
 *
 * Three outcomes, and the middle one is the point:
 *
 * - **all absent** → `null`. Sign-in is not configured; the route is not
 *   registered. An optional feature that was never switched on must not stop the
 *   application from starting.
 * - **some absent** → throws, naming every missing variable. `env.ts` already
 *   refuses a partial set at boot, so reaching this means configuration arrived
 *   by some other route — and a half-configured provider fails later, at the
 *   token exchange, as a provider error that reads like Google's fault.
 * - **all present** → the narrowed values.
 *
 * Written this way rather than as `isConfigured()` plus assertions at each use
 * site so there is no branch that is unreachable: every `null` either returns or
 * throws.
 */
const readGoogleSignInConfig = (config: AppConfig): GoogleSignInConfig | null => {
  const clientId = presentValue(config.GOOGLE_CLIENT_ID);
  const clientSecret = presentValue(config.GOOGLE_CLIENT_SECRET);
  const redirectUri = presentValue(config.GOOGLE_REDIRECT_URI);

  if (clientId === null && clientSecret === null && redirectUri === null) return null;

  if (clientId === null || clientSecret === null || redirectUri === null) {
    const missing: string[] = [];
    if (clientId === null) missing.push('GOOGLE_CLIENT_ID');
    if (clientSecret === null) missing.push('GOOGLE_CLIENT_SECRET');
    if (redirectUri === null) missing.push('GOOGLE_REDIRECT_URI');

    throw new Error(
      `Google sign-in is half-configured: ${missing.join(', ')} not provided. ` +
        'Set all three of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI, or ' +
        'none. A partial set fails later at the token exchange as a provider error, which is ' +
        'far harder to diagnose (AGENTS.md 11: no silent defaults).',
    );
  }

  // Narrowed by the throw above, not by a cast.
  return { clientId, clientSecret, redirectUri };
};

/**
 * `forRoot` returning no controllers when Google is not configured.
 *
 * **A `404`, not a `500`, and deliberately.** The alternative — registering the
 * controller with a provider that throws "not configured" — produces a route that
 * looks like a feature and answers with a server error. A route that does not
 * exist says what is true: this deployment has no sign-in. The `console.warn`
 * below says the same thing at boot, because a `404` an operator does not
 * understand is its own outage.
 */
@Module({})
export class AuthModule {
  static forRoot(config: AppConfig): DynamicModule {
    const google = readGoogleSignInConfig(config);

    if (google === null) {
      console.warn(
        'AuthModule: Google OIDC is not configured, so GET /auth/oidc/redirect is not ' +
          'registered and will answer 404. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ' +
          'GOOGLE_REDIRECT_URI — all three or none — to enable sign-in (PLT-101).',
      );
      return { module: AuthModule };
    }

    const providers: Provider[] = [
      SystemClock,
      {
        provide: IOIDC_PROVIDER,
        useFactory: (): GoogleOidcProvider =>
          new GoogleOidcProvider({
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            redirectUri: google.redirectUri,
            authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
          }),
      },
      {
        provide: AUTHORIZATION_ORIGIN,
        useFactory: (): string => new URL(GOOGLE_AUTHORIZATION_ENDPOINT).origin,
      },
      {
        provide: IOIDC_STATE_STORE,
        useFactory: (clock: SystemClock): HmacOidcStateStore =>
          new HmacOidcStateStore({
            clock,
            // Reused rather than given a secret of its own; see the note in
            // `oidc-state-store.ts` on why, and what promoting it would cost.
            secret: requireString(config.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),
            ttlMs: config.OIDC_STATE_TTL_MS,
          }),
        // `inject` was MISSING here until 2026-10-03, and the route could not work
        // because of it. Without it Nest has no argument list for this factory and
        // calls it with none, so `clock` was `undefined` and the first request
        // died in `HmacOidcStateStore.seal` with
        //
        //     TypeError: Cannot read properties of undefined (reading 'now')
        //
        // Nest does not fall back to the factory's own parameter types here: a
        // `useFactory` arrow function carries no `design:paramtypes` because it
        // is not decorated, so the reflected list is empty. Every other factory in
        // this file already declared `inject`; this one did not, and the omission
        // was invisible because `auth.module.spec.ts` invoked the factory by hand
        // and passed `new SystemClock()` itself.
        //
        // It is worth recording that this is the second defect of its kind in one
        // module: `OidcSignInController` declares its dependency with `import type`,
        // which `emitDecoratorMetadata` cannot turn into a runtime value. That one
        // lives in `controllers/` and is not fixed here.
        inject: [SystemClock],
      },
      {
        provide: BeginOidcSignIn,
        useFactory: (
          provider: GoogleOidcProvider,
          store: HmacOidcStateStore,
          origin: string,
        ): BeginOidcSignIn => new BeginOidcSignIn(provider, store, origin),
        inject: [IOIDC_PROVIDER, IOIDC_STATE_STORE, AUTHORIZATION_ORIGIN],
      },
    ];

    return {
      module: AuthModule,
      controllers: [OidcSignInController],
      providers,
      exports: [BeginOidcSignIn],
    };
  }
}

/** A trimmed non-empty string, or `null`. Absent and blank are the same answer. */
const presentValue = (value: string | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/**
 * Narrow an optional environment string, naming the variable when it is absent.
 *
 * The value is deliberately absent from the message: `AGENTS.md` 2.13, and the
 * caller is about to read a real secret out of the environment.
 */
function requireString(value: string | undefined, variable: string): string {
  const present = presentValue(value);
  if (present === null) {
    throw new Error(
      `${variable} is required to build the auth module but was not provided. ` +
        'Sign-in cannot be constructed without it (AGENTS.md 11: no silent defaults).',
    );
  }
  return present;
}
