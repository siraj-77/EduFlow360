import { describe, expect, it } from 'vitest';
import { bootBanner, loadConfig } from './env.js';

/**
 * The fail-fast contract (AGENTS.md 11).
 *
 * "Start-up must fail fast naming the missing variable; no silent defaults."
 * These tests are that sentence made executable. If someone later adds a
 * `.default()` to DATABASE_URL, `loads with no DATABASE_URL` fails, and
 * the failure message says exactly why that would be wrong.
 */

/** A minimal valid environment. */
const base = { NODE_ENV: 'test', PORT: '3001' } as NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('loads with no DATABASE_URL, in an explicit persistence-disabled state', () => {
    const loaded = loadConfig(base);

    expect(loaded.persistence).toBe('disabled');
    expect(loaded.config.DATABASE_URL).toBeUndefined();
    expect(loaded.missing).toContain('DATABASE_URL');
  });

  it('enables persistence when DATABASE_URL is present', () => {
    const loaded = loadConfig({
      ...base,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/eduflow',
    });

    expect(loaded.persistence).toBe('enabled');
    expect(loaded.missing).not.toContain('DATABASE_URL');
  });

  it('rejects a non-PostgreSQL DATABASE_URL and says why', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'mysql://localhost/eduflow' })).toThrow(
      /single-tenant/i,
    );
  });

  it('rejects a SQLite URL, which is not an option under ADR-003', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'file:./dev.db' })).toThrow(/postgresql/);
  });

  it('rejects a still-placeholder value rather than booting with it', () => {
    expect(() =>
      loadConfig({ ...base, DATABASE_URL: '<postgresql://user:pass@localhost:5432/eduflow>' }),
    ).toThrow(/placeholder/i);
  });

  it('rejects a short JWT_ACCESS_SECRET', () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'too-short' })).toThrow(/32 characters/);
  });

  it('names EVERY invalid variable in one throw, not just the first', () => {
    let message = '';
    try {
      loadConfig({ ...base, DATABASE_URL: 'mysql://x', JWT_ACCESS_SECRET: 'short' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/JWT_ACCESS_SECRET/);
  });

  it('cites AGENTS.md 11 in the failure, so the reason is discoverable', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/AGENTS\.md 11/);
  });

  it('coerces PORT from a string', () => {
    expect(loadConfig({ ...base, PORT: '4000' }).config.PORT).toBe(4000);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ ...base, PORT: 'not-a-port' })).toThrow();
  });
});

describe('OIDC_STATE_TTL_MS — how long a sign-in may stay open', () => {
  it('defaults to ten minutes when nothing is configured', () => {
    // A default, and deliberately a short one. AGENTS.md 8 forbids hardcoding a
    // school's *values*; this is a protocol window, not a school setting, and a
    // never-written configuration should produce the conservative answer rather
    // than no answer at all.
    expect(loadConfig(base).config.OIDC_STATE_TTL_MS).toBe(600_000);
  });

  it('is read from the environment when a school sets one', () => {
    expect(loadConfig({ ...base, OIDC_STATE_TTL_MS: '900000' }).config.OIDC_STATE_TTL_MS).toBe(
      900_000,
    );
  });

  it.each([
    { label: 'zero', value: '0' },
    { label: 'a negative window', value: '-1' },
    { label: 'a fractional window', value: '1500.5' },
    { label: 'text', value: 'ten minutes' },
  ])('refuses $label', ({ value }) => {
    // Each of these produces an `Expires` the browser either discards or
    // misreads, and a browser that discards the attribute leaves a state cookie
    // with no expiry at all.
    expect(() => loadConfig({ ...base, OIDC_STATE_TTL_MS: value })).toThrow(/OIDC_STATE_TTL_MS/);
  });
});

describe('WEB_ORIGIN — the origin allowed to call the API', () => {
  it('defaults to the web app origin when nothing is configured', () => {
    // A deployment value, not a secret — the OIDC_STATE_TTL_MS precedent:
    // a never-written configuration produces the conservative answer (this
    // app's own web origin) rather than a boot failure. The web app runs on
    // 3500 (apps/web/web-port.ts), the only origin the CSRF guard's
    // assumption permits (create-app.ts).
    expect(loadConfig(base).config.WEB_ORIGIN).toBe('http://localhost:3500');
  });

  it('is read from the environment when a deployment sets one', () => {
    expect(loadConfig({ ...base, WEB_ORIGIN: 'https://school.edu' }).config.WEB_ORIGIN).toBe(
      'https://school.edu',
    );
  });
});

/**
 * `PLT-105`'s two variables: how long a reset link lives, and how the mail
 * reaches a mailbox.
 *
 * The TTL follows the `OIDC_STATE_TTL_MS` precedent exactly — a positive
 * whole number of milliseconds with a documented default — because the same
 * reasoning applies: a never-written configuration should produce the
 * conservative answer (a short window), not a boot failure.
 *
 * The SMTP group is the opposite shape, and deliberately so. The email
 * adapter per `ADR-014` is production SMTP with a mail catcher in
 * development and tests, so the variables are optional as a GROUP: absent
 * means "no SMTP configured", which the adapter layer answers with the
 * recording adapter rather than with a crash. A half-configured SMTP group
 * is refused at boot for the same reason a half-configured OIDC group is —
 * it fails far later as a provider error instead of a local validation one.
 */
describe('PASSWORD_RESET_TTL_MS — how long a reset link lives', () => {
  it('defaults to one hour, the window the story names', () => {
    expect(loadConfig(base).config.PASSWORD_RESET_TTL_MS).toBe(3_600_000);
  });

  it('is configurable, because the acceptance criterion says configurable', () => {
    expect(
      loadConfig({ ...base, PASSWORD_RESET_TTL_MS: '1800000' }).config.PASSWORD_RESET_TTL_MS,
    ).toBe(1_800_000);
  });

  it('refuses a non-positive or fractional window, which would produce an Expires either boundary', () => {
    for (const value of ['0', '-1', '1.5', 'abc']) {
      expect(() => loadConfig({ ...base, PASSWORD_RESET_TTL_MS: value })).toThrow(
        /PASSWORD_RESET_TTL_MS/,
      );
    }
  });
});

describe('the SMTP group (ADR-014)', () => {
  it('loads with no SMTP at all, which selects the recording adapter', () => {
    const loaded = loadConfig(base);

    expect(loaded.config.SMTP_HOST).toBeUndefined();
  });

  it('loads a complete group', () => {
    const loaded = loadConfig({
      ...base,
      SMTP_HOST: 'mailpit',
      SMTP_PORT: '1025',
      EMAIL_FROM: 'EduFlow360 <no-reply@school.lk>',
    });

    expect(loaded.config.SMTP_HOST).toBe('mailpit');
    expect(loaded.config.SMTP_PORT).toBe(1025);
    expect(loaded.config.EMAIL_FROM).toBe('EduFlow360 <no-reply@school.lk>');
  });

  it('refuses half a credential pair, the same rule as the OIDC group', () => {
    // One variable alone is the state that fails at send time with a provider
    // error; boot is where it is cheap to catch. A host WITHOUT credentials is
    // NOT that state — Mailpit and network-authenticated relays need none —
    // so the pairing rule covers the pair, not the host.
    expect(() => loadConfig({ ...base, SMTP_USER: 'smtp-user' })).toThrow(/SMTP_PASSWORD/);
    expect(() => loadConfig({ ...base, SMTP_PASSWORD: 'smtp-pass' })).toThrow(/SMTP_PASSWORD/);
  });

  it('defaults the port and the from-address, which are deployment conveniences', () => {
    const loaded = loadConfig({ ...base, SMTP_HOST: 'mailpit' });

    expect(loaded.config.SMTP_PORT).toBe(587);
    expect(loaded.config.EMAIL_FROM).toBe('EduFlow360 <no-reply@localhost>');
  });
});

describe('LICENCE_GRACE_WINDOW_MS — how long a lapsed licence keeps working', () => {
  it('defaults to three days — a RECORDED gap, not a corpus number', () => {
    // `PLT-305` says "at least the configured grace window" and names no
    // duration, so this default is a documented judgement in the style of the
    // throttles: visible in the env spec, overridable by deployment, never
    // presented as chosen (`AGENTS.md` 6).
    expect(loadConfig(base).config.LICENCE_GRACE_WINDOW_MS).toBe(259_200_000);
  });

  it('accepts zero, which disables grace entirely', () => {
    // A school that wants an exact expiry gets one: the conservative answer
    // is available, not merely documented.
    expect(
      loadConfig({ ...base, LICENCE_GRACE_WINDOW_MS: '0' }).config.LICENCE_GRACE_WINDOW_MS,
    ).toBe(0);
  });

  it('refuses a negative or fractional window', () => {
    for (const value of ['-1', '1.5', 'abc']) {
      expect(() => loadConfig({ ...base, LICENCE_GRACE_WINDOW_MS: value })).toThrow(
        /LICENCE_GRACE_WINDOW_MS/,
      );
    }
  });
});

describe('bootBanner', () => {
  it('states loudly that persistence is disabled, rather than staying silent', () => {
    const banner = bootBanner(loadConfig(base)).join('\n');

    expect(banner).toMatch(/PERSISTENCE DISABLED/);
    expect(banner).toMatch(/not a fallback/i);
    expect(banner).toMatch(/DATABASE_URL/);
  });

  it('confirms single-tenant on every boot (ADR-003)', () => {
    const banner = bootBanner(loadConfig(base)).join('\n');
    expect(banner).toMatch(/one database and one deployment per school/i);
  });
});
