/**
 * Environment contract.
 *
 * AGENTS.md 11: ".env.example (tracked) documents every variable with
 * placeholders" and "Start-up must fail fast naming the missing variable;
 * no silent defaults."
 *
 * This file must satisfy BOTH of those, and they pull in opposite
 * directions at this stage of the build:
 *
 *   - "fail fast, no silent defaults"  => a missing DATABASE_URL should
 *     never be papered over with a guessed localhost URL.
 *   - "npm run dev must work with no Docker installed" => at P2 there are
 *     no persistence features yet, so requiring a database would block the
 *     scaffold for no benefit.
 *
 * The resolution is a THIRD state rather than a default: when DATABASE_URL
 * is absent the app enters `persistence: 'disabled'`, logs that loudly at
 * boot, and no repository implementation is constructed. It is explicit
 * and visible, which satisfies "no silent defaults". A guessed URL would
 * be neither.
 *
 * From P4 (Prompt Pack P4, "Persistence: Prisma setup, base migration"),
 * DATABASE_URL becomes required and the disabled state is removed.
 */
import { z } from 'zod';

const PLACEHOLDER_PATTERN = /^<.*>$/;

const optionalSecret = (label: string) =>
  z
    .string()
    .min(1)
    .refine((v) => !PLACEHOLDER_PATTERN.test(v), {
      message: `${label} is still the .env.example placeholder. Copy .env.example to .env and fill it in.`,
    })
    .optional();

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),

    /**
     * PostgreSQL. One database per school (ADR-003).
     * Optional at P2; REQUIRED from P4.
     */
    DATABASE_URL: optionalSecret('DATABASE_URL').refine(
      (v) => v === undefined || /^postgres(ql)?:\/\//.test(v),
      {
        message:
          'DATABASE_URL must be a postgresql:// connection string. EduFlow is single-tenant: ' +
          'one database per school (AGENTS.md 2.1). A shared multi-tenant URL is architecturally wrong.',
      },
    ),

    /** Redis. Required from P4 (BullMQ). */
    REDIS_URL: optionalSecret('REDIS_URL'),

    /** MinIO / any S3-compatible endpoint (ADR-015). */
    STORAGE_ENDPOINT: optionalSecret('STORAGE_ENDPOINT'),
    STORAGE_ACCESS_KEY: optionalSecret('STORAGE_ACCESS_KEY'),
    STORAGE_SECRET_KEY: optionalSecret('STORAGE_SECRET_KEY'),
    STORAGE_BUCKET: z.string().min(1).default('eduflow'),

    /** Generate with: openssl rand -base64 32 */
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
      .optional(),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
      .optional(),

    /** Public key only. The private signing key never enters this repository (ADR-010). */
    LICENSE_PUBLIC_KEY_PATH: optionalSecret('LICENSE_PUBLIC_KEY_PATH'),

    /**
     * How long a lapsed certificate keeps its entitlements (`PLT-305`).
     *
     * Three days. NO CORPUS SOURCE for the number — `PLT-305` says only "at
     * least the configured grace window" — so this is a recorded gap in the
     * same style as the throttles: a deployment can set its own, and the
     * default is documented rather than presented as chosen.
     *
     * The window is bounded in BOTH directions. Zero disables grace, which
     * is the conservative answer for a school that wants an exact expiry;
     * and grace that never ended would be an unlicensed school running a
     * licensed product, which is what `ADR-009` wrote the scheme to prevent.
     */
    LICENCE_GRACE_WINDOW_MS: z.coerce
      .number()
      .int('LICENCE_GRACE_WINDOW_MS must be a whole number of milliseconds')
      .nonnegative('LICENCE_GRACE_WINDOW_MS must be zero or greater (zero disables grace)')
      .default(259_200_000),

    /**
     * Google OIDC (`PLT-101`), authorization-code flow.
     *
     * Optional as a GROUP, not individually: a half-configured provider is
     * exactly the state that fails confusingly later, at the token exchange,
     * with a provider error instead of a local validation error. All three or
     * none.
     *
     * `provider` is a COLUMN and not a table per provider - owner decision
     * 2026-09-30, "Google first, more providers expected" - so Microsoft or
     * Apple later is a row and not a migration. Do not add a
     * `GOOGLE_`-prefixed variable here without asking whether the provider
     * belongs in `provider` or in this schema at all.
     */
    GOOGLE_CLIENT_ID: optionalSecret('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optionalSecret('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: optionalSecret('GOOGLE_REDIRECT_URI'),

    /**
     * How long a begun sign-in stays open.
     *
     * The window in which `GET /auth/oidc/callback` will accept the signed state
     * bundle that `GET /auth/oidc/redirect` issued. It bounds a credential that
     * is sitting in a browser, so it is deliberately short and deliberately
     * configurable rather than a constant in the store.
     *
     * Ten minutes by default: long enough for a password manager and a second
     * factor on a slow connection, short enough that a bundle left in a browser
     * is worthless quickly. It must exceed the provider's own authorization-code
     * lifetime, or a legitimate sign-in can expire server-side while the user is
     * still typing. It is validated as a positive whole number of milliseconds
     * because anything else produces an `Expires` the browser discards — and a
     * discarded `Expires` is a cookie with *no* expiry, which is the opposite of
     * what was asked for.
     *
     * Not a secret, so it takes a default: `AGENTS.md` 8 forbids hardcoding a
     * school's timezone, currency, language or academic calendar, and a protocol
     * window is none of those. A never-written configuration should produce the
     * conservative answer, not a boot failure.
     */
    OIDC_STATE_TTL_MS: z.coerce
      .number()
      .int('OIDC_STATE_TTL_MS must be a whole number of milliseconds')
      .positive('OIDC_STATE_TTL_MS must be greater than zero')
      .default(600_000),

    LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).default('INFO'),
    LOG_DIR: z.string().min(1).default('logs'),

    /**
     * The origin allowed to call the API.
     *
     * A deployment value, not a secret — the `OIDC_STATE_TTL_MS` precedent:
     * a never-written configuration should produce the conservative answer
     * (this app's own web origin) rather than a boot failure. The web app
     * runs on 3500 (`apps/web/web-port.ts`), and that is the only origin
     * the CSRF guard's assumption permits (`create-app.ts`: one origin,
     * never a list — a wildcard would undo the CSRF guard).
     *
     * Entered here rather than defaulted at the read site, so a typo fails
     * startup naming the variable, and so `main.ts` reads it from validated
     * config instead of an ambient `process.env` read with a `??` fallback
     * (FIX-08 / G1-11: no `??` on an env read remains).
     *
     * This default is the ONE hard-coded localhost URL in application
     * source, and it is exempt from `PLT-1001`'s ban deliberately and
     * visibly: the alternative is a boot failure for a value the
     * conservative answer is known for. A real deployment writes
     * `WEB_ORIGIN` — `.env.example` documents it — and this default is
     * what the persistence-disabled state boots with. The exemption is
     * a comment at the site rather than an entry in an allowlist file,
     * because the justification is local and a global list would hide
     * it. Do NOT copy this pattern to a read site.
     */
    // eslint-disable-next-line no-restricted-syntax -- PLT-1001: the one justified WEB_ORIGIN default; see above.
    WEB_ORIGIN: z.string().min(1).default('http://localhost:3500'),

    /**
     * Which deployment owns this database.
     *
     * `AGENTS.md` 2.1 makes isolation physical — one database per school — while
     * still requiring a `schoolId` column on school-scoped rows, as metadata for
     * auditability and licence portability. Something therefore has to name that
     * one school, and it is configuration rather than a constant: a constant
     * would be the same UUID in every school in the world.
     *
     * **No default, deliberately.** `seed.mjs` carries a documented default
     * because it is a local convenience; a default here would mean an operator
     * who never set it silently inherits one and discovers it from a support
     * ticket. `AGENTS.md` 11 — no silent defaults.
     *
     * Validated as a UUID because every repository interpolates it into a `uuid`
     * column predicate. A typo would not throw: it would match no row, and the
     * symptom would be an installation where every login 401s and no login can
     * ever succeed.
     */
    SCHOOL_ID: z
      .string()
      .uuid('SCHOOL_ID must be a UUID. Every repository scopes its reads and writes by it.')
      .optional(),

    // ═══════════════════════════════════════════════════════════════════════
    // Credential-route thresholds.
    //
    // `AGENTS.md` 2.14 puts every threshold in settings rather than in code, and
    // 8 forbids hard-coding one. `OIDC_STATE_TTL_MS` above is the precedent:
    // a documented default, configurable per deployment, validated rather than
    // trusted.
    //
    // PROVENANCE IS NOT UNIFORM, and saying which is which matters more than the
    // numbers:
    //
    //   - LOGIN_MAX_FAILED_ATTEMPTS / LOGIN_LOCKOUT_MS are STATED BY THE CORPUS.
    //     docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md line 723 gives
    //     PLT-101 "lockout at 5 fails/10 min -> 429 with FakeClock".
    //   - PASSWORD_MIN_LENGTH is a GAP. The corpus contains no password policy at
    //     all: EduFlow_School_Setup_Workflow_v1.md line 452 lists "Password policy
    //     (length, complexity, history, expiry if any)" as a **Phase 4** item, and
    //     line 395 says the first administrator sets "a strong password (policy
    //     from Phase 4 defaults)". Twelve is a judgement call above the NIST
    //     SP 800-63B floor of eight, chosen because this particular credential is
    //     the whole installation. It needs owner sign-off and must be revisited
    //     when Phase 4 designs the policy. Recorded rather than presented as
    //     chosen.
    //   - SESSION_TTL_MS, REFRESH_TOKEN_TTL_MS, PASSWORD_MAX_LENGTH,
    //     SETUP_MAX_ATTEMPTS and SETUP_ATTEMPT_WINDOW_MS are ALSO GAPS, with the
    //     reasoning in the comments at their use sites.
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * How long a session cookie and its session row live.
     *
     * One hour, with no corpus source. Chosen because a school day is roughly
     * that long and because a shorter window forces a re-authentication in the
     * middle of a lesson. Recorded as a gap: `AGENTS.md` 6 requires a missing
     * requirement to be visible rather than filled with a number that looks
     * chosen, and this comment is that visibility.
     */
    SESSION_TTL_MS: z.coerce
      .number()
      .int('SESSION_TTL_MS must be a whole number of milliseconds')
      .positive('SESSION_TTL_MS must be greater than zero')
      .default(3_600_000),

    /**
     * How long a refresh token stays valid.
     *
     * Fourteen days, no corpus source. Long enough that a teacher who closes a
     * laptop overnight is not asked to sign in again; short enough that a lost
     * laptop does not carry a renewable credential for months. `ADR-008`'s
     * rotation is what actually limits the damage — the window only decides how
     * long the theft is useful.
     *
     * Must exceed `SESSION_TTL_MS`, enforced by the cross-field refinement
     * below: a refresh token that expires before its session turns every sign-in
     * into a session that cannot be renewed, which is a product failure wearing a
     * security control's clothes.
     */
    REFRESH_TOKEN_TTL_MS: z.coerce
      .number()
      .int('REFRESH_TOKEN_TTL_MS must be a whole number of milliseconds')
      .positive('REFRESH_TOKEN_TTL_MS must be greater than zero')
      .default(1_209_600_000),

    /**
     * Failed sign-ins before an account is locked, and for how long.
     *
     * The only threshold here the corpus actually states — see the provenance
     * block above. Five attempts is also what
     * EduFlow_School_Setup_Workflow_v1.md line 1080 names as the authentication
     * test ("lockout after 5 failures"), so two governing documents agree.
     *
     * The floor of two matters: a threshold of one locks an account on a single
     * typo, which is a denial of service available to anyone who knows a
     * username. Even that floor leaves the property exposed — see
     * `sign-in-with-password.ts` for why a locked account answering 429 is a
     * deliberate, documented leak rather than an oversight.
     */
    LOGIN_MAX_FAILED_ATTEMPTS: z.coerce
      .number()
      .int('LOGIN_MAX_FAILED_ATTEMPTS must be a whole number of attempts')
      .min(
        2,
        'LOGIN_MAX_FAILED_ATTEMPTS must be at least 2. A threshold of 1 locks an account on a single typo, which is a denial of service available to anyone who knows a username.',
      )
      .default(5),

    /**
     * How long a locked account stays locked. Ten minutes, from the corpus.
     *
     * Long enough that an attacker cannot grind a small password space, short
     * enough that a locked-out principal is not waiting until the next morning.
     */
    LOGIN_LOCKOUT_MS: z.coerce
      .number()
      .int('LOGIN_LOCKOUT_MS must be a whole number of milliseconds')
      .positive('LOGIN_LOCKOUT_MS must be greater than zero')
      .default(600_000),

    /**
     * The provisional password policy.
     *
     * LENGTH BOUNDS AND NOTHING ELSE, and that is a statement about the corpus
     * rather than about security. There is no policy to implement:
     * EduFlow_School_Setup_Workflow_v1.md line 452 defers it to Phase 4, and
     * line 395 says the first administrator sets "a strong password (policy from
     * Phase 4 defaults)" — a reference to something that does not exist yet.
     *
     * So this is the smallest thing that makes `PLT-107`'s acceptance criterion
     * ("a password that fails the password policy does not consume the token")
     * testable at all, and it is deliberately boring: a minimum and a maximum,
     * no composition rules. NIST SP 800-63B is explicit that character-class
     * rules and periodic expiry make passwords WORSE, and inventing them here
     * would be inventing policy this repository has been told does not exist yet.
     *
     * The minimum of twelve is above the NIST floor of eight because this
     * particular credential is the entire installation — there is no second
     * administrator to call. It is a judgement, flagged as a gap, and it must be
     * replaced when Phase 4 designs the real policy.
     */
    PASSWORD_MIN_LENGTH: z.coerce
      .number()
      .int('PASSWORD_MIN_LENGTH must be a whole number of characters')
      .min(
        8,
        'PASSWORD_MIN_LENGTH must be at least 8. NIST SP 800-63B requires eight characters for a user-chosen password; nothing published goes lower.',
      )
      .default(12),

    /**
     * The upper bound, which is a DoS guard rather than a security rule.
     *
     * 128 characters. argon2 has no 72-byte truncation problem (that is bcrypt's),
     * so this bound exists for one reason only: the request body is
     * attacker-controlled and reaches an intentionally expensive function. 128
     * comfortably exceeds NIST's "at least 64" allowance while bounding the work.
     */
    PASSWORD_MAX_LENGTH: z.coerce
      .number()
      .int('PASSWORD_MAX_LENGTH must be a whole number of characters')
      .positive('PASSWORD_MAX_LENGTH must be greater than zero')
      .default(128),

    /**
     * The throttle on `POST /auth/setup/complete`.
     *
     * Ten attempts per source per fifteen minutes, and there is no corpus source
     * for either number. Ten rather than five because the legitimate caller is a
     * principal copying a 43-character token off a printed line: a throttle that
     * fires mid-copy is a throttle on the school's only way in, and this route
     * has no recovery path by design (`STORY_PLT-107`, option (b)).
     *
     * The window is per source address, not per token, because an attacker holds
     * no token to key on. See `fixed-window-throttle.ts` for why the counter is
     * in-process and why that is acceptable for a single-school deployment.
     */
    SETUP_MAX_ATTEMPTS: z.coerce
      .number()
      .int('SETUP_MAX_ATTEMPTS must be a whole number of attempts')
      .positive('SETUP_MAX_ATTEMPTS must be greater than zero')
      .default(10),

    SETUP_ATTEMPT_WINDOW_MS: z.coerce
      .number()
      .int('SETUP_ATTEMPT_WINDOW_MS must be a whole number of milliseconds')
      .positive('SETUP_ATTEMPT_WINDOW_MS must be greater than zero')
      .default(900_000),

    /**
     * The throttle on `GET /auth/oidc/callback`.
     *
     * Twenty callbacks per source per ten minutes, and there is no corpus source for
     * either number. Recorded as a GAP alongside the setup throttle rather than
     * presented as chosen — `AGENTS.md` 6 requires a missing requirement to be
     * visible rather than filled with a number that looks decided.
     *
     * **Why the callback needs one at all.** It is unauthenticated by necessity (it
     * is where a session is obtained) and it is the only route that performs a token
     * exchange. An attacker who can make this deployment talk to Google's token
     * endpoint at will is spending someone else's quota and holding open a window in
     * which a forged `state` is worth attempting.
     *
     * **Why it covers BOTH flows.** The link flow completes at this same route, so
     * one throttle bounds both. A second throttle on `GET /auth/oidc/link` would be
     * measuring the same requests twice and could only be tuned inconsistently.
     *
     * Twenty rather than five: a legitimate user completing a sign-in with a
     * password manager, a second factor and a slow connection may legitimately take
     * several round trips, and this route has no in-product recovery path.
     */
    OIDC_CALLBACK_MAX_ATTEMPTS: z.coerce
      .number()
      .int('OIDC_CALLBACK_MAX_ATTEMPTS must be a whole number of attempts')
      .positive('OIDC_CALLBACK_MAX_ATTEMPTS must be greater than zero')
      .default(20),

    OIDC_CALLBACK_WINDOW_MS: z.coerce
      .number()
      .int('OIDC_CALLBACK_WINDOW_MS must be a whole number of milliseconds')
      .positive('OIDC_CALLBACK_WINDOW_MS must be greater than zero')
      .default(600_000),

    /**
     * How long a password-reset link lives (`PLT-105` AC-1).
     *
     * One hour — the window the story's own acceptance criterion names
     * ("expires after configurable window (e.g., 1 hour)"), which makes this
     * the rare threshold here with a corpus source. The `OIDC_STATE_MS`
     * precedent applies: a documented default rather than a required value,
     * because a never-written configuration should produce the conservative
     * answer.
     *
     * Longer than the OIDC state window on purpose: this one sits in a
     * MAILBOX, which is read on the recipient's schedule and not on the
     * sender's, and a user who requests a reset at 16:55 and reads it after
     * dinner is the normal case rather than the edge one.
     */
    PASSWORD_RESET_TTL_MS: z.coerce
      .number()
      .int('PASSWORD_RESET_TTL_MS must be a whole number of milliseconds')
      .positive('PASSWORD_RESET_TTL_MS must be greater than zero')
      .default(3_600_000),

    /**
     * The throttle on `POST /auth/password-reset/request`.
     *
     * Five requests per source per fifteen minutes, no corpus source — the
     * same judgement as `SETUP_MAX_ATTEMPTS` and recorded the same way
     * (`AGENTS.md` 6: a gap is visible, not presented as chosen).
     *
     * **Why this route needs one at all.** It is unauthenticated and it
     * causes outbound mail. An attacker who can call it at will can make the
     * school's own mail server deliver unbounded mail to an arbitrary
     * address — which gets the school's domain blacklisted and breaks
     * password reset for everyone. The throttle is per source address, the
     * same reasoning as the setup throttle: an attacker holds no account to
     * key on.
     */
    PASSWORD_RESET_MAX_ATTEMPTS: z.coerce
      .number()
      .int('PASSWORD_RESET_MAX_ATTEMPTS must be a whole number of requests')
      .positive('PASSWORD_RESET_MAX_ATTEMPTS must be greater than zero')
      .default(5),

    PASSWORD_RESET_WINDOW_MS: z.coerce
      .number()
      .int('PASSWORD_RESET_WINDOW_MS must be a whole number of milliseconds')
      .positive('PASSWORD_RESET_WINDOW_MS must be greater than zero')
      .default(900_000),

    // ═══════════════════════════════════════════════════════════════════════
    // Email delivery (`ADR-014`).
    //
    // Optional as a GROUP. Absent means "no SMTP configured", which the
    // adapter layer answers with a recording adapter and a loud boot line —
    // the same explicit-third-state pattern as persistence-disabled. A
    // half-configured group is refused at boot for the `OIDC_*` reason: it
    // would otherwise fail at send time as a provider error.
    //
    // The group is `SMTP_HOST` plus its credentials; `SMTP_PORT` and
    // `EMAIL_FROM` are deployment conveniences and take defaults.
    // ═══════════════════════════════════════════════════════════════════════
    SMTP_HOST: optionalSecret('SMTP_HOST'),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    /**
     * STARTTLS versus implicit TLS. `false` (STARTTLS on 587) is the default
     * because it is what Mailpit and every hosted relay speak on the
     * submission port; implicit TLS on 465 sets this to `true`.
     */
    SMTP_SECURE: z.coerce.boolean().default(false),
    SMTP_USER: optionalSecret('SMTP_USER'),
    SMTP_PASSWORD: optionalSecret('SMTP_PASSWORD'),
    /**
     * The envelope sender. A plain address-shaped string, not an RFC 5322
     * display name — the display name is the school's to configure through
     * settings once the Settings engine lands, and this default names the
     * product rather than the deployment.
     */
    EMAIL_FROM: z.string().min(3).default('EduFlow360 <no-reply@localhost>'),
  })
  /**
   * Cross-field check, applied only when at least one provider variable is
   * present. All three, or none.
   */
  .refine(
    (v) =>
      [v.GOOGLE_CLIENT_ID, v.GOOGLE_CLIENT_SECRET, v.GOOGLE_REDIRECT_URI].filter(
        (x) => x !== undefined,
      ).length %
        3 ===
      0,
    {
      message:
        'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are all required together. ' +
        'A partial set fails later at the token exchange, as a provider error, which is far ' +
        'harder to diagnose than a local validation error at boot (AGENTS.md 11). ' +
        'Set all three, or none.',
      path: ['GOOGLE_CLIENT_ID'],
    },
  )
  /**
   * `SMTP_USER` and `SMTP_PASSWORD` are a PAIR, and `SMTP_HOST` stands alone.
   *
   * That asymmetry is the point. Credentials without a host is nonsense, but
   * a host WITHOUT credentials is a real configuration — Mailpit in
   * development and tests, and plenty of authenticated-by-network relays in
   * production, neither of which authenticates. Requiring a username where
   * none is needed is how a development environment ends up with a fake
   * credential in a tracked `.env.example`.
   *
   * What IS refused is half a PAIR, which fails at send time as a provider
   * error rather than as the local validation error boot owes the operator.
   */
  .refine((v) => (v.SMTP_USER === undefined) === (v.SMTP_PASSWORD === undefined), {
    message:
      'SMTP_USER and SMTP_PASSWORD must be set together. A half pair fails later at send ' +
      'time as an SMTP error, which is far harder to diagnose than a local validation error at ' +
      'boot (AGENTS.md 11). Set both, or neither.',
    path: ['SMTP_PASSWORD'],
  })
  /**
   * A refresh token that dies before its session it renews is a product failure
   * wearing a security control's clothes, so it is refused at boot rather than
   * discovered by a teacher whose sign-in silently stops working.
   */
  .refine((v) => v.REFRESH_TOKEN_TTL_MS > v.SESSION_TTL_MS, {
    message:
      'REFRESH_TOKEN_TTL_MS must be greater than SESSION_TTL_MS. A refresh token that expires ' +
      'first leaves every session unable to be renewed.',
    path: ['REFRESH_TOKEN_TTL_MS'],
  })
  /**
   * A maximum at or below the minimum is a policy no password can satisfy, which
   * would lock every administrator out of their own installation.
   */
  .refine((v) => v.PASSWORD_MAX_LENGTH > v.PASSWORD_MIN_LENGTH, {
    message:
      'PASSWORD_MAX_LENGTH must be greater than PASSWORD_MIN_LENGTH, or no password could ' +
      'satisfy the policy and the first administrator could never be created.',
    path: ['PASSWORD_MAX_LENGTH'],
  });

export type AppConfig = z.infer<typeof schema>;

/**
 * Whether persistence may be constructed.
 * `false` is a loud, explicit state -- not a fallback.
 */
export type PersistenceMode = 'enabled' | 'disabled';

export interface LoadedConfig {
  readonly config: AppConfig;
  readonly persistence: PersistenceMode;
  /** Variables the app wants but does not have, for the boot banner. */
  readonly missing: readonly string[];
}

/**
 * Parse and validate the environment.
 *
 * @throws {Error} naming EVERY invalid variable at once, so a developer
 *   with a fresh checkout sees the full list rather than discovering them
 *   one restart at a time. This is the "fail fast" half of AGENTS.md 11.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoadedConfig {
  const candidate: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) candidate[key] = value;
  }

  const result = schema.safeParse(candidate);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );

    throw new Error(
      [
        '',
        'EDUFLOW — environment validation FAILED.',
        '',
        'Start-up fails here by design (AGENTS.md 11): no silent defaults.',
        'Nothing was started and no repository was constructed.',
        '',
        ...lines,
        '',
        'To fix:',
        '  cp .env.example .env',
        '  then fill in the values shown above. Never commit .env.',
        '',
      ].join('\n'),
    );
  }

  const config = result.data;
  const missing: string[] = [];
  if (!config.DATABASE_URL) missing.push('DATABASE_URL');
  if (!config.REDIS_URL) missing.push('REDIS_URL');

  return {
    config,
    persistence: config.DATABASE_URL ? 'enabled' : 'disabled',
    missing,
  };
}

/** Optional detail for the banner, so it can report what it actually read. */
export interface BootBannerContext {
  /** Workspace env files that existed and were loaded, in load order. */
  readonly envFilesLoaded?: readonly string[];
}

/** The banner shown at boot. Loud by design -- see the file comment. */
export function bootBanner(loaded: LoadedConfig, context: BootBannerContext = {}): string[] {
  const { config, persistence, missing } = loaded;
  const lines = [
    '',
    '  EduFlow API',
    `  env: ${config.NODE_ENV}   port: ${config.PORT}   log: ${config.LOG_LEVEL}`,
  ];

  /**
   * Which env files were read, named but never valued. `AGENTS.md` 2.13 and
   * 11: configuration that silently did not load is the defect this whole
   * arrangement exists to remove, so the banner says what it found.
   */
  const envFilesLoaded = context.envFilesLoaded ?? [];
  lines.push(
    envFilesLoaded.length === 0
      ? '  ⚠ no .env file found — configuration comes from the environment alone'
      : `  env files: ${envFilesLoaded.map((p) => p.replace(/\\/g, '/').split('/').pop()).join(' → ')}`,
  );

  const oidcReady = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
  lines.push(
    oidcReady
      ? '  ✓ Google OIDC credentials configured (PLT-101)'
      : '  ⚠ Google OIDC not configured — sign-in is unavailable (PLT-101)',
  );

  if (persistence === 'disabled') {
    lines.push(
      '',
      '  ⚠  PERSISTENCE DISABLED — no DATABASE_URL configured.',
      '     Expected at this stage (P2 scaffold): no persistence features exist yet.',
      '     This is an explicit state, not a fallback. No repository is constructed.',
      '     From P4 onward DATABASE_URL is REQUIRED and the API will refuse to boot without it.',
      `     Missing: ${missing.join(', ') || 'none'}`,
    );
  } else {
    lines.push('  ✓ persistence enabled');
  }

  lines.push('', '  Single-tenant (ADR-003): one database and one deployment per school.', '');
  return lines;
}
