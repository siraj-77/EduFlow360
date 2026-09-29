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
