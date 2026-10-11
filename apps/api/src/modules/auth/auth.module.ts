import { randomBytes } from 'node:crypto';
import { Module, type DynamicModule, type OnModuleDestroy, type Provider } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config/env.js';
import { readPersistenceConfig } from '../../config/persistence.js';
import { FixedWindowThrottle } from '../../common/throttle/fixed-window-throttle.js';
import type { ThrottlePolicy } from '../../common/throttle/fixed-window-throttle.js';
import type { IPasswordHashParameterStore } from '../settings/domain/ports/password-hash-parameter-store.js';
import { resolvePasswordHashParameters } from '../settings/domain/services/password-hash-parameters.js';
import { PrismaPasswordHashParameterStore } from '../settings/infrastructure/postgres/prisma-password-hash-parameter-store.js';
import {
  LOGIN_THROTTLE_POLICY,
  PasswordSignInController,
} from './controllers/password-sign-in.controller.js';
import { OidcSignInController } from './controllers/oidc-sign-in.controller.js';
import {
  OIDC_CALLBACK_THROTTLE_POLICY,
  OidcCallbackController,
} from './controllers/oidc-callback.controller.js';
import { OidcLinkController } from './controllers/oidc-link.controller.js';
import {
  SETUP_THROTTLE_POLICY,
  SetupCompletionController,
} from './controllers/setup-completion.controller.js';
import { I_ALLOWED_EMAIL_DOMAIN_STORE } from '../settings/domain/ports/allowed-email-domain-store.js';
import { RequestPasswordReset } from './use-cases/request-password-reset.js';
import { ConfirmPasswordReset } from './use-cases/confirm-password-reset.js';
import {
  PASSWORD_RESET_THROTTLE_POLICY,
  PasswordResetController,
} from './controllers/password-reset.controller.js';
import { I_EMAIL_DELIVERY, type IEmailDelivery } from './domain/ports/email-delivery.js';
import { RecordingEmailAdapter } from './infrastructure/adapters/recording-email-adapter.js';
import { SmtpEmailAdapter } from './infrastructure/adapters/smtp-email-adapter.js';
import {
  I_PASSWORD_RESET_TOKEN_REPOSITORY,
  type IPasswordResetTokenRepository,
} from './domain/repositories/password-reset-token-repository.js';
import { PrismaPasswordResetTokenRepository } from './infrastructure/postgres/prisma-password-reset-token-repository.js';
import type { IAllowedEmailDomainStore } from '../settings/domain/ports/allowed-email-domain-store.js';
import { PrismaAllowedEmailDomainStore } from '../settings/infrastructure/postgres/prisma-allowed-email-domain-store.js';
import { CLOCK } from './domain/ports/clock.js';
import type { IPasswordHasher } from './domain/ports/password-hasher.js';
import { I_EXTERNAL_IDENTITY_REPOSITORY } from './domain/ports/external-identity-repository.js';
import type { IExternalIdentityRepository } from './domain/ports/external-identity-repository.js';
import { IOIDC_STATE_STORE } from './domain/ports/oidc-state-store.js';
import { I_SESSION_REPOSITORY } from './domain/ports/session-repository.js';
import type { ISessionRepository } from './domain/ports/session-repository.js';
import type { IBootstrapClaimRepository } from './domain/repositories/bootstrap-claim-repository.js';
import type { ISetupTokenRepository } from './domain/repositories/setup-token-repository.js';
import type { IUserCredentialRepository } from './domain/repositories/user-credential-repository.js';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher.js';
import { GoogleOidcProvider } from './infrastructure/adapters/google-oidc-provider.js';
import { HmacOidcStateStore } from './infrastructure/adapters/oidc-state-store.js';
import { SessionCookieAdapter } from './infrastructure/adapters/session-cookie.js';
import { SystemClock } from './infrastructure/adapters/system-clock.js';
import { PrismaBootstrapClaimRepository } from './infrastructure/postgres/prisma-bootstrap-claim-repository.js';
import { PrismaExternalIdentityRepository } from './infrastructure/postgres/prisma-external-identity-repository.js';
import { PrismaSessionRepository } from './infrastructure/postgres/prisma-session-repository.js';
import { PrismaSetupTokenRepository } from './infrastructure/postgres/prisma-setup-token-repository.js';
import { PrismaUserCredentialRepository } from './infrastructure/postgres/prisma-user-credential-repository.js';
import { BeginOidcSignIn } from './use-cases/begin-oidc-sign-in.js';
import { CompleteFirstAdministratorSetup } from './use-cases/complete-first-administrator-setup.js';
import { CompleteOidcCallback } from './use-cases/complete-oidc-callback.js';
import { SignInWithPassword } from './use-cases/sign-in-with-password.js';
import { SetupTokenService } from './use-cases/setup-token-service.js';

/**
 * `AuthModule` — the wiring, and nothing else.
 *
 * ## Why there is no business logic in this file
 *
 * Every rule lives in `domain/`, every decision lives in a use-case, and every
 * vendor detail lives in an adapter. What is left is the part that knows *which* of
 * those to construct from *which* environment variable, which is a genuine fourth
 * thing and belongs in the module file. `AGENTS.md` 2's Interface Segregation is not
 * "no file may contain more than one class" — it is "no class owns more than one
 * reason to change". This file owns one.
 *
 * ## `forRoot`, and why it takes the configuration as an argument
 *
 * Two reasons, the first the important one:
 *
 * 1. **Ordering.** `loadEnvFiles()` runs in `main.ts` *before* the Nest application
 *    is created, precisely because `.env` is not in `process.env` until then.
 *    Anything that read the environment while the `@Module` decorator was being
 *    evaluated would run before the env files are read. This repository lost a day
 *    to exactly that, so configuration arrives as a parameter, from `main.ts`, after
 *    validation.
 * 2. **Two features, two independent switches.** Google sign-in is optional and may
 *    be unconfigured; the credential routes need a database. Neither switch disables
 *    the other, and neither may stop the application from starting.
 *
 * ## The three states this module can be in
 *
 * | state                                   | OIDC route | credential routes |
 * |-----------------------------------------|-----------|-------------------|
 * | neither Google nor persistence configured| absent   | absent            |
 * | Google only                              | present  | absent            |
 * | persistence only                         | absent   | present           |
 * | both                                     | present  | present           |
 *
 * An absent route answers **404**, not 500, in every case. That is the same decision
 * the original Google-only version made and it is why a route that does not exist
 * says what is true: this deployment has no sign-in by Google, or no database, and a
 * `console.warn` at boot says the same thing, because a 404 an operator does not
 * understand is its own outage.
 *
 * ## The dummy password hash, and why it is built at boot
 *
 * `DUMMY_PASSWORD_HASH` is a real argon2id digest of 32 CSPRNG bytes that nothing
 * holds, hashed **at this deployment's cost parameters**. It is what
 * `SignInWithPassword` verifies against when no account matches, so a request for a
 * non-existent user costs the same as one for a real user.
 *
 * Two decisions worth stating:
 *
 *   - **At boot, from the configured parameters.** An embedded constant would be
 *     hashed at whatever cost it was created with, and a school that tuned its
 *     parameters would then measure its dummy verification at the wrong price — which
 *     is the enumeration oracle the whole mechanism exists to remove. Measured in
 *     `sign-in-with-password.spec.ts`, asserted as a fact rather than a distribution.
 *   - **`randomBytes`, never a literal.** The plaintext is discarded immediately and
 *     never stored, so the digest cannot be reversed into anything usable. But a
 *     hard-coded "random" value in source is a value every deployment shares, and a
 *     digest whose preimage is public is a digest an attacker can deliberately match
 *     if the port ever grows a "does this hash verify" shortcut.
 *
 * It costs one argon2 hash at startup. That is deliberate and paid on boot rather
 * than lazily, because a lazily-built dummy would make the FIRST sign-in attempt
 * cost two hashes and every later one cost one.
 */

/** DI tokens. Symbols rather than classes, because the ports are interfaces. */
export const IOIDC_PROVIDER = Symbol('IOIDC_PROVIDER');
export const AUTHORIZATION_ORIGIN = Symbol('AUTHORIZATION_ORIGIN');

/**
 * `IOIDC_STATE_STORE` now lives in its port file, alongside `CLOCK` and
 * `I_SESSION_REPOSITORY`.
 *
 * The reason is an import cycle, and it is recorded here because the alternative
 * looks harmless: `OidcCallbackController` needs this token, this module imports that
 * controller, and a controller importing a token back out of this module evaluates its
 * own body while the symbol is still uninitialised — so `@Inject(undefined)` is emitted
 * and Nest falls back to reflected metadata and cannot resolve the dependency.
 *
 * Re-exported here because it was declared here until that happened.
 */
export { IOIDC_STATE_STORE } from './domain/ports/oidc-state-store.js';

/**
 * DI tokens for the ports.
 *
 * Symbols, because a TypeScript `interface` has no runtime value and Nest resolves
 * providers by identity. `auth.module.ts` and the two controllers both import these,
 * so the alternative — importing the interface and writing `provide:
 * SomeInterface as symbol` — produces a `TS1361` at every one of a dozen sites and
 * reads as though interfaces were tokens.
 */
export const I_PASSWORD_HASHER = Symbol('IPasswordHasher');
export const I_PASSWORD_HASH_PARAMETER_STORE = Symbol('IPasswordHashParameterStore');
export const I_SETUP_TOKEN_REPOSITORY = Symbol('ISetupTokenRepository');
export const I_BOOTSTRAP_CLAIM_REPOSITORY = Symbol('IBootstrapClaimRepository');
export const I_USER_CREDENTIAL_REPOSITORY = Symbol('IUserCredentialRepository');

/**
 * `I_SESSION_REPOSITORY` now lives in its port file, alongside `CLOCK`.
 *
 * Re-exported here because it was declared here until `SessionGuard` needed it from
 * `common/guards/`, and a guard that guards every route cannot import the auth module
 * to read one symbol without dragging `@prisma/client` and every controller with it.
 * The re-export keeps every existing import site working.
 */
export { I_SESSION_REPOSITORY } from './domain/ports/session-repository.js';

/** This school's resolved argon2id cost parameters. */
export const PASSWORD_HASH_PARAMETERS = Symbol('PASSWORD_HASH_PARAMETERS');

/** A digest no password matches, at this deployment's cost parameters. */
export const DUMMY_PASSWORD_HASH = Symbol('DUMMY_PASSWORD_HASH');

/**
 * Google's authorization endpoint, stated here rather than inherited.
 *
 * `GoogleOidcProvider` carries this as a default. Passing it explicitly means the
 * origin the redirect check trusts and the endpoint the URL is built from are the
 * same string, set in one place, and that neither is a default nobody chose. This is
 * configuration: `AGENTS.md` 2 forbids a hard-coded provider in a *use-case*, which is
 * exactly why it lives in the module and is injected rather than hardcoded where the
 * check happens.
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
 * - **all absent** → `null`. Sign-in is not configured; the route is not registered.
 * - **some absent** → throws, naming every missing variable. `env.ts` already refuses
 *   a partial set at boot, so reaching this means configuration arrived by some other
 *   route — and a half-configured provider fails later, at the token exchange, as a
 *   provider error that reads like Google's fault.
 * - **all present** → the narrowed values.
 *
 * Written this way rather than as `isConfigured()` plus assertions at each use site
 * so there is no branch that is unreachable: every `null` either returns or throws.
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
      'Google sign-in is half-configured: ' +
        missing.join(', ') +
        ' not provided. ' +
        'Set all three of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI, or ' +
        'none. A partial set fails later at the token exchange as a provider error, which is ' +
        'far harder to diagnose (AGENTS.md 11: no silent defaults).',
    );
  }

  // Narrowed by the throw above, not by a cast.
  return { clientId, clientSecret, redirectUri };
};

/**
 * `readPersistenceConfig` is imported from `config/persistence.ts` rather than defined
 * here, because `RbacModule` needs the identical answer down to the refusal on the
 * half-configured case. That file explains why it is not an export from this module.
 */

/**
 * Closes the pool when the module goes away.
 *
 * A provider class rather than a hook on the factory, because Nest calls
 * `onModuleDestroy` on providers and not on factory return values. Without this a
 * `pnpm test` run leaves a pool per harness behind, and Windows holds the socket long
 * after the process that wanted it has gone.
 */
class PrismaConnection implements OnModuleDestroy {
  constructor(private readonly client: PrismaClient) {}

  onModuleDestroy(): void {
    // Not awaited: Nest's shutdown hook is synchronous here and the pool closes
    // itself. A rejected disconnect during shutdown must not mask the reason the
    // process is shutting down.
    void this.client.$disconnect();
  }
}

@Module({})
export class AuthModule {
  static forRoot(config: AppConfig): DynamicModule {
    const google = readGoogleSignInConfig(config);
    const persistence = readPersistenceConfig(config);

    const controllers = [];
    const providers: Provider[] = [SystemClock];

    // The clock PORT, satisfied by the clock CLASS. See `domain/ports/clock.ts` for
    // why this is a token rather than injecting `SystemClock` everywhere: a consumer
    // bound to the class cannot be given a fake, and the cookie TTL computed from
    // this clock is exactly the value a test needs to control.
    providers.push({ provide: CLOCK, useExisting: SystemClock });

    if (google === null) {
      console.warn(
        'AuthModule: Google OIDC is not configured, so GET /auth/oidc/redirect is not ' +
          'registered and will answer 404. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ' +
          'GOOGLE_REDIRECT_URI — all three or none — to enable sign-in (PLT-101).',
      );
    } else {
      providers.push(
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
          // calls it with none, so `clock` was `undefined` and the first request died
          // in `HmacOidcStateStore.seal` with
          //
          //     TypeError: Cannot read properties of undefined (reading 'now')
          //
          // Nest does not fall back to the factory's own parameter types here: a
          // `useFactory` arrow function carries no `design:paramtypes` because it is not
          // decorated, so the reflected list is empty. Every other factory in this file
          // already declared `inject`. `auth.module.spec.ts` did not catch it because it
          // invoked the factory by hand and passed `new SystemClock()` itself — which is
          // why the container is now built in a test as well.
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
      );
      controllers.push(OidcSignInController);
      // The LINK route needs no database to *begin* a flow — it seals a state cookie and
      // redirects — so it is registered with Google alone, exactly like the redirect.
      // It still cannot do anything useful without a session, and `SessionGuard` refuses
      // every request when no session repository is wired, so an unregistered-in-practice
      // route is unreachable rather than half-working.
      controllers.push(OidcLinkController);
    }

    if (persistence === null) {
      console.warn(
        'AuthModule: neither DATABASE_URL nor SCHOOL_ID is set, so POST /auth/setup/complete ' +
          'and POST /auth/login are not registered and will answer 404. Without them there is ' +
          'nowhere to read a credential from (PLT-101, PLT-107).',
      );
    } else {
      const { databaseUrl, schoolId } = persistence;
      providers.push(...credentialProviders(databaseUrl, schoolId, config));
      controllers.push(
        SetupCompletionController,
        PasswordSignInController,
        // `PLT-105` — registered here, in the database branch, for the same reason
        // sign-in is: both mint credentials from a real credential row, and the
        // three-state shape (`ADR-019`) means a database-less deployment has
        // neither sign-in nor password reset. The pages themselves (`T3`) wait
        // for the app shell — see the controller header.
        PasswordResetController,
      );
    }

    // The callback needs BOTH halves: a provider to verify the assertion with, and a
    // database to resolve the identity and issue a session against. Registered only
    // when both are present, so a Google-only deployment answers 404 rather than 401 —
    // "this deployment has no Google sign-in" instead of a refusal that reads like a bug.
    if (google !== null && persistence !== null) {
      providers.push(...oidcCallbackProviders(config));
      controllers.push(OidcCallbackController);
    }

    return {
      module: AuthModule,
      controllers,
      providers,
      // `I_SESSION_REPOSITORY` is exported so the globally-registered `SessionGuard`
      // — which lives in `common/` and cannot import this module — can inject it. It is
      // exported ONLY when persistence exists, and `SessionGuard`'s `@Optional()` turns
      // its absence into "refuse every authenticated route" rather than a boot failure.
      exports: [
        ...(google === null ? [] : [BeginOidcSignIn]),
        ...(persistence === null
          ? []
          : [I_SESSION_REPOSITORY, I_EXTERNAL_IDENTITY_REPOSITORY, I_ALLOWED_EMAIL_DOMAIN_STORE]),
      ],
    };
  }
}

/**
 * Everything `GET /auth/oidc/callback` needs.
 *
 * Separate from `credentialProviders` because the two lists are governed by different
 * questions: that one is "what does a database alone enable", this one is "what does a
 * database enable *given a provider*". A callback with no provider has nothing to
 * verify and a provider with no database has nowhere to resolve an identity, and
 * neither combination is a working route.
 */
function oidcCallbackProviders(config: AppConfig): Provider[] {
  return [
    {
      provide: I_EXTERNAL_IDENTITY_REPOSITORY,
      useFactory: (client: PrismaClient): IExternalIdentityRepository =>
        new PrismaExternalIdentityRepository(client, schoolIdOf(config)),
      inject: [PrismaClient],
    },
    {
      provide: I_ALLOWED_EMAIL_DOMAIN_STORE,
      useFactory: (client: PrismaClient): IAllowedEmailDomainStore =>
        new PrismaAllowedEmailDomainStore(client, schoolIdOf(config)),
      inject: [PrismaClient],
    },
    {
      provide: CompleteOidcCallback,
      useFactory: (
        provider: GoogleOidcProvider,
        stateStore: HmacOidcStateStore,
        domains: IAllowedEmailDomainStore,
        identities: IExternalIdentityRepository,
        sessions: ISessionRepository,
      ): CompleteOidcCallback =>
        new CompleteOidcCallback({
          provider,
          stateStore,
          domains,
          identities,
          sessions,
          sessionTtlMs: config.SESSION_TTL_MS,
          refreshTtlMs: config.REFRESH_TOKEN_TTL_MS,
        }),
      inject: [
        IOIDC_PROVIDER,
        IOIDC_STATE_STORE,
        I_ALLOWED_EMAIL_DOMAIN_STORE,
        I_EXTERNAL_IDENTITY_REPOSITORY,
        I_SESSION_REPOSITORY,
      ],
    },
    {
      provide: OIDC_CALLBACK_THROTTLE_POLICY,
      useValue: Object.freeze({
        limit: config.OIDC_CALLBACK_MAX_ATTEMPTS,
        windowMs: config.OIDC_CALLBACK_WINDOW_MS,
      }) satisfies ThrottlePolicy,
    },
  ];
}

/**
 * The school id, named rather than passed twice.
 *
 * `readPersistenceConfig` already proved it exists and refused the inverse
 * configuration at boot, so re-reading it here cannot fail — and it makes the two
 * factories below visibly scoped to the SAME school as the credential repositories.
 */
function schoolIdOf(config: AppConfig): string {
  return requireString(config.SCHOOL_ID, 'SCHOOL_ID');
}

/**
 * Everything the two credential routes need, given a database and a school.
 *
 * Split out of `forRoot` rather than inlined because the list is long and a method
 * body that long hides the three decisions that matter inside it: which parameters
 * are read once, which are read per request, and which are the enumeration defence.
 *
 * **Every `useFactory` here declares `inject`.** There is no exception and there was
 * never a good reason for one — see the `IOIDC_STATE_STORE` note above, which is what
 * happens when it is forgotten.
 */
function credentialProviders(databaseUrl: string, schoolId: string, config: AppConfig): Provider[] {
  return [
    {
      provide: PrismaClient,
      // `datasourceUrl` rather than relying on `process.env.DATABASE_URL`, because
      // configuration is passed in as an argument precisely so that nothing here reads
      // the ambient environment. A test boots this with a synthetic URL and a
      // developer's own `.env` cannot reach it.
      useFactory: (): PrismaClient => new PrismaClient({ datasourceUrl: databaseUrl }),
    },
    {
      provide: PrismaConnection,
      useFactory: (client: PrismaClient): PrismaConnection => new PrismaConnection(client),
      inject: [PrismaClient],
    },

    // ── argon2id, and the cost this school configured ────────────────────────
    {
      provide: I_PASSWORD_HASH_PARAMETER_STORE,
      useFactory: (client: PrismaClient): IPasswordHashParameterStore =>
        new PrismaPasswordHashParameterStore(client, schoolId),
      inject: [PrismaClient],
    },
    {
      // Resolved ONCE at boot, not per sign-in. It is a school setting that changes
      // by an administrator action, and a per-request read would put a database round
      // trip in front of every hash — including the dummy one on the missing-user
      // path, where a round trip is a difference an attacker could measure.
      provide: PASSWORD_HASH_PARAMETERS,
      useFactory: async (store: IPasswordHashParameterStore) => {
        const resolution = resolvePasswordHashParameters(await store.readParameters());
        if (resolution.origin === 'default') {
          // Reported, never silent. `resolvePasswordHashParameters` returns this so a
          // caller can SEE that a school is running on the published recommendation
          // rather than a choice somebody made.
          console.warn(
            `AuthModule: this school has configured no usable argon2id cost parameters, so the ` +
              `published default is in use (replaced: ${resolution.replaced.join(', ') || 'none'}). ` +
              'That is a recommendation, not a setting anybody chose.',
          );
        }
        return resolution.parameters;
      },
      inject: [I_PASSWORD_HASH_PARAMETER_STORE],
    },
    {
      provide: I_PASSWORD_HASHER,
      useFactory: (parameters): Argon2PasswordHasher =>
        new Argon2PasswordHasher({ currentParameters: parameters }),
      inject: [PASSWORD_HASH_PARAMETERS],
    },
    {
      // The enumeration defence, built here. See the header.
      provide: DUMMY_PASSWORD_HASH,
      useFactory: async (hasher: IPasswordHasher, parameters) => {
        const plaintext = randomBytes(32).toString('base64url');
        const hashed = await hasher.hash(plaintext, parameters);
        return hashed.hash;
      },
      inject: [I_PASSWORD_HASHER, PASSWORD_HASH_PARAMETERS],
    },

    // ── repositories ─────────────────────────────────────────────────────────
    {
      provide: I_SETUP_TOKEN_REPOSITORY,
      useFactory: (client: PrismaClient): ISetupTokenRepository =>
        new PrismaSetupTokenRepository(client, schoolId),
      inject: [PrismaClient],
    },
    {
      provide: I_BOOTSTRAP_CLAIM_REPOSITORY,
      useFactory: (client: PrismaClient): IBootstrapClaimRepository =>
        new PrismaBootstrapClaimRepository(client, schoolId),
      inject: [PrismaClient],
    },
    {
      provide: I_USER_CREDENTIAL_REPOSITORY,
      useFactory: (client: PrismaClient): IUserCredentialRepository =>
        new PrismaUserCredentialRepository(client, schoolId),
      inject: [PrismaClient],
    },
    {
      provide: I_SESSION_REPOSITORY,
      useFactory: (client: PrismaClient): ISessionRepository =>
        new PrismaSessionRepository(client, schoolId),
      inject: [PrismaClient],
    },

    // ── use-cases ────────────────────────────────────────────────────────────
    {
      provide: SetupTokenService,
      useFactory: (tokens: ISetupTokenRepository, clock: SystemClock): SetupTokenService =>
        new SetupTokenService(tokens, clock),
      inject: [I_SETUP_TOKEN_REPOSITORY, CLOCK],
    },
    {
      provide: CompleteFirstAdministratorSetup,
      useFactory: (
        claims: IBootstrapClaimRepository,
        tokens: SetupTokenService,
        hasher: IPasswordHasher,
        clock: SystemClock,
        parameters,
      ): CompleteFirstAdministratorSetup =>
        new CompleteFirstAdministratorSetup({
          claims,
          tokens,
          hasher,
          clock,
          // The PROVISIONAL policy. See `domain/services/password-policy.ts`: the
          // requirements corpus has no password policy at all, and this is the
          // smallest rule that makes PLT-107's acceptance criterion testable.
          policy: {
            minimumLength: config.PASSWORD_MIN_LENGTH,
            maximumLength: config.PASSWORD_MAX_LENGTH,
            provisional: true,
          },
          hashParameters: parameters,
        }),
      inject: [
        I_BOOTSTRAP_CLAIM_REPOSITORY,
        SetupTokenService,
        I_PASSWORD_HASHER,
        CLOCK,
        PASSWORD_HASH_PARAMETERS,
      ],
    },
    {
      provide: SignInWithPassword,
      useFactory: (
        users: IUserCredentialRepository,
        hasher: IPasswordHasher,
        sessions: ISessionRepository,
        clock: SystemClock,
        dummyHash: string,
        parameters,
      ): SignInWithPassword =>
        new SignInWithPassword({
          users,
          hasher,
          sessions,
          clock,
          dummyHash,
          hashParameters: parameters,
          sessionTtlMs: config.SESSION_TTL_MS,
          refreshTtlMs: config.REFRESH_TOKEN_TTL_MS,
          lockout: {
            maxAttempts: config.LOGIN_MAX_FAILED_ATTEMPTS,
            lockoutMs: config.LOGIN_LOCKOUT_MS,
          },
        }),
      inject: [
        I_USER_CREDENTIAL_REPOSITORY,
        I_PASSWORD_HASHER,
        I_SESSION_REPOSITORY,
        CLOCK,
        DUMMY_PASSWORD_HASH,
        PASSWORD_HASH_PARAMETERS,
      ],
    },

    // ── transport and throttles ──────────────────────────────────────────────
    {
      provide: SessionCookieAdapter,
      useFactory: (clock: SystemClock): SessionCookieAdapter => new SessionCookieAdapter({ clock }),
      inject: [CLOCK],
    },
    {
      provide: FixedWindowThrottle,
      useFactory: (clock: SystemClock): FixedWindowThrottle => new FixedWindowThrottle(clock),
      inject: [CLOCK],
    },
    {
      provide: SETUP_THROTTLE_POLICY,
      // `useValue` rather than a factory: these are configuration, read once, and a
      // factory would be a function returning a constant. See `env.ts` for where the
      // numbers came from and which of them have no corpus source.
      useValue: Object.freeze({
        limit: config.SETUP_MAX_ATTEMPTS,
        windowMs: config.SETUP_ATTEMPT_WINDOW_MS,
      }) satisfies ThrottlePolicy,
    },
    {
      provide: LOGIN_THROTTLE_POLICY,
      useValue: Object.freeze({
        // Deliberately GENEROUS compared with the account lockout. This throttle
        // exists to bound argon2 work per source address; the lockout is the control
        // that stops guessing, it is durable, and it is keyed on the account. Setting
        // them to the same number would mean one attacker cycling source addresses
        // could lock colleagues out, which the source-keyed throttle must never be able
        // to do.
        limit: config.LOGIN_MAX_FAILED_ATTEMPTS * 10,
        windowMs: config.LOGIN_LOCKOUT_MS,
      }) satisfies ThrottlePolicy,
    },
    {
      provide: PASSWORD_RESET_THROTTLE_POLICY,
      // The request route causes outbound mail, so this is the throttle that keeps
      // one source from spending the school's SMTP quota and getting the domain
      // blacklisted. Configuration, not constants (`AGENTS.md` 2.14).
      useValue: Object.freeze({
        limit: config.PASSWORD_RESET_MAX_ATTEMPTS,
        windowMs: config.PASSWORD_RESET_WINDOW_MS,
      }) satisfies ThrottlePolicy,
    },

    // ── password reset (`PLT-105`) ───────────────────────────────────────────
    {
      provide: I_PASSWORD_RESET_TOKEN_REPOSITORY,
      useFactory: (client: PrismaClient): IPasswordResetTokenRepository =>
        new PrismaPasswordResetTokenRepository(client, schoolId),
      inject: [PrismaClient],
    },
    {
      // `ADR-014`: email goes through a port from the first story that needs it.
      // Which IMPLEMENTATION is a deployment fact — SMTP when configured, the
      // recording adapter otherwise — decided here, once, at boot, and reported
      // in the banner rather than at send time.
      provide: I_EMAIL_DELIVERY,
      useFactory: (): IEmailDelivery => {
        if (config.SMTP_HOST === undefined || config.SMTP_HOST.trim().length === 0) {
          console.warn(
            'AuthModule: no SMTP_HOST is configured, so outbound mail is NOT delivered - ' +
              'password-reset links are recorded in memory only (ADR-014). This is reported ' +
              'rather than discovered from a support ticket.',
          );
          return new RecordingEmailAdapter();
        }
        return new SmtpEmailAdapter(config);
      },
    },
    {
      provide: RequestPasswordReset,
      useFactory: (
        users: IUserCredentialRepository,
        tokens: IPasswordResetTokenRepository,
        email: IEmailDelivery,
        clock: SystemClock,
      ): RequestPasswordReset =>
        new RequestPasswordReset(
          { users, tokens, email, clock },
          {
            // Configuration, per `AGENTS.md` 2.14: the window the story's own
            // acceptance criterion names as configurable.
            ttlMs: config.PASSWORD_RESET_TTL_MS,
            webOrigin: config.WEB_ORIGIN,
          },
        ),
      inject: [
        I_USER_CREDENTIAL_REPOSITORY,
        I_PASSWORD_RESET_TOKEN_REPOSITORY,
        I_EMAIL_DELIVERY,
        CLOCK,
      ],
    },
    {
      provide: ConfirmPasswordReset,
      useFactory: (
        users: IUserCredentialRepository,
        tokens: IPasswordResetTokenRepository,
        sessions: ISessionRepository,
        hasher: IPasswordHasher,
        clock: SystemClock,
        parameters,
      ): ConfirmPasswordReset =>
        new ConfirmPasswordReset({
          users,
          tokens,
          sessions,
          hasher,
          clock,
          // The same PROVISIONAL policy as setup (`password-policy.ts`): reused
          // rather than duplicated, because a school that accepts a twelve-character
          // first password must not be sent an eight-character reset one.
          policy: {
            minimumLength: config.PASSWORD_MIN_LENGTH,
            maximumLength: config.PASSWORD_MAX_LENGTH,
            provisional: true,
          },
          hashParameters: parameters,
        }),
      inject: [
        I_USER_CREDENTIAL_REPOSITORY,
        I_PASSWORD_RESET_TOKEN_REPOSITORY,
        I_SESSION_REPOSITORY,
        I_PASSWORD_HASHER,
        CLOCK,
        PASSWORD_HASH_PARAMETERS,
      ],
    },
  ];
}

/** A trimmed non-empty string, or `null`. Absent and blank are the same answer. */
const presentValue = (value: string | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/**
 * Narrow an optional environment string, naming the variable when it is absent.
 *
 * The value is deliberately absent from the message: `AGENTS.md` 2.13, and the caller
 * is about to read a real secret out of the environment.
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
