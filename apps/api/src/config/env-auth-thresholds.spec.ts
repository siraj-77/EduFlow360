import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

/**
 * The credential-route configuration contract.
 *
 * ## Why these are environment variables at all
 *
 * `POST /auth/setup/complete` and `POST /auth/login` are the first two routes
 * that need numbers this repository has no other source for: how long a session
 * lasts, how many failures lock an account, how short a password may be, and how
 * many attempts one source may make at an *unauthenticated* route.
 *
 * `AGENTS.md` 2.14 puts every threshold in settings and `AGENTS.md` 8 forbids
 * hard-coding one, and the precedent is `OIDC_STATE_TTL_MS` in this same schema:
 * a documented default, configurable per deployment, validated rather than
 * trusted.
 *
 * ## What is asserted here, and what is not
 *
 * Asserted: the defaults exist, they are the numbers the use-cases and the
 * throttle are documented against, and each one is refused when malformed rather
 * than silently coerced. A fractional or zero TTL would serialise into an
 * `Expires` a browser discards, which is the failure `OIDC_STATE_TTL_MS` already
 * documents.
 *
 * NOT asserted: that these numbers are *right*. Several have no source in the
 * corpus at all — see the provenance notes in `env.ts`. A test cannot settle a
 * judgement call; it can only stop a number from changing by accident.
 */

const base = { NODE_ENV: 'test', PORT: '3001' } as NodeJS.ProcessEnv;

describe('SCHOOL_ID — which deployment this database belongs to', () => {
  it('is absent unless configured, and never invented', () => {
    // There is no default, deliberately. A default here would be a number in
    // code that some deployment would then ship with and believe was chosen,
    // which is the "silent default" AGENTS.md 11 forbids. `seed.mjs` has its own
    // documented default for local convenience; the API does not.
    expect(loadConfig(base).config.SCHOOL_ID).toBeUndefined();
  });

  it('is read from the environment', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    expect(loadConfig({ ...base, SCHOOL_ID: id }).config.SCHOOL_ID).toBe(id);
  });

  it('refuses anything that is not a UUID, naming the variable', () => {
    // The repositories put this value into a `uuid` column on every read and
    // every write. A typo would otherwise become a query that matches nothing
    // and an installation in which every login 401s and no login can ever work.
    expect(() => loadConfig({ ...base, SCHOOL_ID: 'the-main-school' })).toThrow(/SCHOOL_ID/);
  });
});

describe('session lifetimes', () => {
  it('defaults to one hour of session and fourteen days of refresh', () => {
    const { config } = loadConfig(base);

    expect(config.SESSION_TTL_MS).toBe(3_600_000);
    expect(config.REFRESH_TOKEN_TTL_MS).toBe(1_209_600_000);
  });

  it.each([
    'SESSION_TTL_MS',
    'REFRESH_TOKEN_TTL_MS',
    'LOGIN_LOCKOUT_MS',
    'SETUP_ATTEMPT_WINDOW_MS',
  ])('refuses a fractional %s, because a fractional millisecond count is nonsense', (key) => {
    // `OIDC_STATE_TTL_MS` refuses a fraction for the same reason: the value
    // becomes an `Expires` attribute, and a browser that cannot parse one
    // discards it — leaving a cookie with no expiry at all.
    expect(() => loadConfig({ ...base, [key]: '1500.5' })).toThrow(new RegExp(key));
  });

  it.each(['SESSION_TTL_MS', 'REFRESH_TOKEN_TTL_MS'])('refuses a zero or negative %s', (key) => {
    expect(() => loadConfig({ ...base, [key]: '0' })).toThrow(new RegExp(key));
    expect(() => loadConfig({ ...base, [key]: '-1' })).toThrow(new RegExp(key));
  });

  it('refuses a refresh lifetime shorter than the session it outlives', () => {
    // A refresh token that dies before its session turns every sign-in into a
    // session that cannot be renewed, which is a product failure rather than a
    // security control. This is a cross-field rule, so it belongs in the schema.
    expect(() =>
      loadConfig({ ...base, SESSION_TTL_MS: '7200000', REFRESH_TOKEN_TTL_MS: '3600000' }),
    ).toThrow(/REFRESH_TOKEN_TTL_MS/);
  });
});

describe('LOGIN_MAX_FAILED_ATTEMPTS and LOGIN_LOCKOUT_MS', () => {
  it('defaults to five failures and ten minutes', () => {
    // The only threshold in this file with a source in the governing corpus:
    // docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md line 723 states
    // "lockout at 5 fails/10 min -> 429 with FakeClock" for PLT-101.
    const { config } = loadConfig(base);

    expect(config.LOGIN_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(config.LOGIN_LOCKOUT_MS).toBe(600_000);
  });

  it('refuses a threshold of zero or one, which would lock every account on one guess', () => {
    expect(() => loadConfig({ ...base, LOGIN_MAX_FAILED_ATTEMPTS: '0' })).toThrow(
      /LOGIN_MAX_FAILED_ATTEMPTS/,
    );
    expect(() => loadConfig({ ...base, LOGIN_MAX_FAILED_ATTEMPTS: '1' })).toThrow(
      /LOGIN_MAX_FAILED_ATTEMPTS/,
    );
  });
});

describe('the password policy bounds', () => {
  it('defaults to twelve characters minimum and 128 maximum', () => {
    const { config } = loadConfig(base);

    expect(config.PASSWORD_MIN_LENGTH).toBe(12);
    expect(config.PASSWORD_MAX_LENGTH).toBe(128);
  });

  it('refuses a minimum below eight, because no published standard goes lower', () => {
    // NIST SP 800-63B requires at least eight characters for a user-chosen
    // password. A school that configures less is choosing something no external
    // authority endorses, and the schema is the last place to notice.
    expect(() => loadConfig({ ...base, PASSWORD_MIN_LENGTH: '4' })).toThrow(/PASSWORD_MIN_LENGTH/);
  });

  it('refuses a maximum at or below the minimum, which no password could satisfy', () => {
    expect(() =>
      loadConfig({ ...base, PASSWORD_MIN_LENGTH: '12', PASSWORD_MAX_LENGTH: '12' }),
    ).toThrow(/PASSWORD_MAX_LENGTH/);
  });
});

describe('the unauthenticated setup throttle', () => {
  it('defaults to ten attempts per source per fifteen minutes', () => {
    // No corpus source. Ten rather than five because the legitimate caller is a
    // principal typing a 43-character token from a printed or emailed line, and
    // a lockout that fires mid-typing is a lockout on the school's only way in.
    const { config } = loadConfig(base);

    expect(config.SETUP_MAX_ATTEMPTS).toBe(10);
    expect(config.SETUP_ATTEMPT_WINDOW_MS).toBe(900_000);
  });

  it('refuses a non-positive attempt limit', () => {
    expect(() => loadConfig({ ...base, SETUP_MAX_ATTEMPTS: '0' })).toThrow(/SETUP_MAX_ATTEMPTS/);
  });
});
