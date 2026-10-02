import { describe, expect, it } from 'vitest';
import { bootBanner, loadConfig } from './env.js';

/**
 * `PLT-101`: the three Google variables are all-or-nothing.
 *
 * A partial set is the configuration that costs an afternoon. The app boots
 * cleanly, the sign-in button renders, and the failure arrives at the token
 * exchange as a provider error that reads like a Google fault rather than a
 * local mistake. Rejecting it at boot turns that into one line naming the
 * three variables.
 */
describe('Google OIDC configuration is all-or-nothing', () => {
  const base = { NODE_ENV: 'test', PORT: '3001' } as NodeJS.ProcessEnv;

  const withGoogle = (partial: Partial<Record<string, string>>): NodeJS.ProcessEnv => ({
    ...base,
    ...partial,
  });

  it('accepts all three', () => {
    const loaded = loadConfig(
      withGoogle({
        GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/oidc/callback',
      }),
    );
    expect(loaded.config.GOOGLE_CLIENT_ID).toBe('123.apps.googleusercontent.com');
  });

  it('accepts none, because OIDC is not required until the flow ships', () => {
    expect(() => loadConfig(base)).not.toThrow();
  });

  it.each([
    ['id only', { GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com' }],
    ['secret only', { GOOGLE_CLIENT_SECRET: 'secret' }],
    ['redirect only', { GOOGLE_REDIRECT_URI: 'http://localhost:3001/x' }],
    [
      'id and secret, no redirect',
      { GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret' },
    ],
    [
      'id and redirect, no secret',
      {
        GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/x',
      },
    ],
  ])('rejects a partial set: %s', (_label, partial) => {
    expect(() => loadConfig(withGoogle(partial))).toThrow(/all required together/);
  });

  it('still rejects the .env.example placeholder rather than accepting it', () => {
    // The tracked template ships angle-bracketed placeholders, and a developer
    // who copies .env.example without filling it in must not boot a config
    // that looks valid (AGENTS.md 11).
    expect(() =>
      loadConfig(
        withGoogle({
          GOOGLE_CLIENT_ID: '<...>.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: '<google-client-secret>',
          GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/oidc/callback',
        }),
      ),
    ).toThrow(/placeholder/);
  });
});

describe('the boot banner reports what it actually read', () => {
  const base = { NODE_ENV: 'test', PORT: '3001' } as NodeJS.ProcessEnv;

  it('says which env files were loaded', () => {
    const loaded = loadConfig(base);
    const banner = bootBanner(loaded, {
      envFilesLoaded: ['/repo/.env', '/repo/.env.local'],
    }).join('\n');
    expect(banner).toMatch(/env files: \.env/);
  });

  it('says plainly when it read none', () => {
    const banner = bootBanner(loadConfig(base), { envFilesLoaded: [] }).join('\n');
    expect(banner).toMatch(/no \.env file found/);
  });

  it('reports Google OIDC as unconfigured rather than staying silent', () => {
    // Silence here is what let the credential gap go unnoticed for a session.
    expect(bootBanner(loadConfig(base)).join('\n')).toMatch(/Google OIDC not configured/);
  });

  it('reports Google OIDC as configured when all three are present', () => {
    const banner = bootBanner(
      loadConfig({
        ...base,
        GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/oidc/callback',
      }),
    ).join('\n');
    expect(banner).toMatch(/Google OIDC credentials configured/);
  });
});
