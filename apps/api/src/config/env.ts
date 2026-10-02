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

    LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']).default('INFO'),
    LOG_DIR: z.string().min(1).default('logs'),
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
  );

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
