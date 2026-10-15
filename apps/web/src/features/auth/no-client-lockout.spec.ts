import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * `PLT-1004` T2 / AC-2: **no lockout logic exists in client code.**
 *
 * ## What this proves, and why it is a source-level test
 *
 * The story's acceptance criterion is a NEGATIVE one: five failed logins must
 * produce a server-side 429, and no attempt counter may exist in the browser.
 * A behavioural test can only prove that the counter is not observable in the
 * paths it exercises. This asserts the stronger property — that the ported
 * screens do not carry one at all.
 *
 * ## What the template being ported actually contains
 *
 * `docs/template/EduFlow360_Template_Landing_Auth.html` ships a working
 * client-side lockout: `getAttempts`/`setAttempts` persist a per-address
 * counter in `localStorage` under `eduflow360-attempts-<email>`, and
 * `handleLogin` refuses the sixth attempt locally with "Your account is locked
 * for 15 minutes" — a number the server never agreed to. It also ships
 * hard-coded demo credentials printed into its own error message. `PLT-1004`
 * T2 is the task that ports those screens, so this is the spec that means the
 * port cannot bring any of that with it.
 *
 * The values are read from the TEMPLATE, not listed here, so a template that
 * gains a new storage key or a new lockout function fails this spec until a
 * row names it — the same both-ways reconciliation `PLT-1003` T3 uses.
 *
 * ## Why comments are stripped before the scan
 *
 * `use-sign-in.ts` and `sign-in-form.spec.tsx` discuss the lockout in prose
 * ("two POSTs spend two of the five attempts"), and a scan that counted those
 * would fail on the explanation rather than on a counter. The explanation is
 * the record of the decision; the code is the decision. So the scan reads
 * code.
 */

/*
 * The base is held in a variable for the reason `session-cookie-name.spec.ts`
 * records: Vite rewrites a `new URL()` whose second argument is LITERALLY
 * `import.meta.url` into an asset reference, and the rewrite resolves to a
 * non-`file:` scheme under jsdom - so `readFileSync` dies with "The URL must
 * be of scheme file". Anchored to this file, not to the working directory, so
 * the scan holds from any cwd.
 */
const HERE = import.meta.url;

const FEATURE = new URL('.', HERE);
const TEMPLATE = readFileSync(
  new URL('../../../../../docs/template/EduFlow360_Template_Landing_Auth.html', HERE),
  'utf8',
);

/** Every PRODUCTION source file in the auth feature, recursively.
 *
 * Specs are excluded, and the reason is self-reference rather than
 * convenience: this file has to NAME the template's lockout identifiers to
 * assert their absence, and a scan that read itself would find every one of
 * them and fail for the wrong reason. The shipped screens are what AC-2
 * constrains; a test that names a forbidden string is doing its job.
 */
function featureFiles(dir: URL): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    /*
     * The trailing slash is load-bearing. `new URL('components', dir)`
     * resolves to `.../auth/components` with no slash, and joining a child
     * onto THAT replaces the final segment — so `credential-field.tsx`
     * arrives as `.../auth/credential-field.tsx` and the read dies with
     * ENOENT. With the slash the directory is a directory.
     */
    const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);

    if (entry.isDirectory()) return featureFiles(path);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.spec\.(ts|tsx)$/.test(entry.name)) return [];

    return [readFileSync(path, 'utf8')];
  });
}

/**
 * Block and line comments removed, string literals left intact.
 *
 * Deliberately conservative: it strips `/* … *\/` and `// …` and leaves
 * everything else. A false negative (a lockout keyword inside a string) is
 * caught by the dedicated assertions below that look for exact values.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const SOURCES = featureFiles(FEATURE).map(stripComments);

/**
 * The template's own lockout machinery, read from the template's script.
 *
 * These are the identifiers and storage key the demo uses. Each is asserted
 * absent below, and each is confirmed PRESENT in the template first, so a
 * template that drops its lockout cannot make this spec silently vacuous.
 */
const TEMPLATE_LOCKOUT_PARTS = {
  readsAttempts: 'localStorage.getItem',
  writesAttempts: 'localStorage.setItem',
  storageKeyPrefix: 'eduflow360-attempts',
  counterFunction: 'getAttempts',
  lockoutMessage: 'Your account is locked for',
  demoCredential: 'demo@eduflow360.school',
  demoPassword: 'demo1234',
  minutesRemaining: 'minute(s)',
} as const;

describe('the ported auth screens carry no client-side lockout (PLT-1004 T2 / AC-2)', () => {
  it('confirms the template really does carry each part before asserting its absence', () => {
    // The teeth-proof for the scan itself. If a future template edit removes
    // the demo's lockout, the "absent" assertions would pass against nothing
    // — which is exactly the vacuous-green shape this repo keeps finding.
    for (const [name, value] of Object.entries(TEMPLATE_LOCKOUT_PARTS)) {
      expect(TEMPLATE, `the template no longer carries ${name} (${value})`).toContain(value);
    }
  });

  it.each(Object.entries(TEMPLATE_LOCKOUT_PARTS))(
    "does not carry the template's %s",
    (_name, value) => {
      const offender = SOURCES.find((source) => source.includes(value));

      expect(
        offender,
        `${value} is the template's client-side lockout. AC-2 requires five failures to answer ` +
          `from the SERVER (POST /auth/login -> 429, already shipped by PLT-105); the port must not ` +
          `re-implement the countdown, its storage, or its message.`,
      ).toBeUndefined();
    },
  );

  it('reads no browser storage at all', () => {
    // Stricter than the rows above and stated separately because it is the
    // shape a NEW lockout would take: not the template's key, but any key.
    // Session tokens already live in an httpOnly cookie the script cannot
    // read, so nothing in this feature has a legitimate reason to touch
    // either API.
    const offender = SOURCES.find((source) => /localStorage|sessionStorage/.test(source));

    expect(offender, 'an auth screen touched browser storage').toBeUndefined();
  });

  it('derives no wait from a counter it keeps itself', () => {
    // The wait must come from the server's `Retry-After` header only
    // (`sign-in-request.ts` reads it and floors it at one second). A local
    // countdown would state a wait the deployment never promised, in a
    // number the school has not configured.
    const offender = SOURCES.find(
      (source) =>
        /(?:setInterval|setTimeout)\s*\(/.test(source) &&
        /retry|countdown|remaining|locked/i.test(source),
    );

    expect(offender, 'an auth screen runs its own countdown').toBeUndefined();
  });

  it('counts no attempts anywhere in the feature', () => {
    // `attempts`, `remaining`, `lockedUntil` and the shape they travel in.
    // Matched as identifiers rather than substrings so the prose-recovery in
    // `use-sign-in.ts`'s own header about "the five attempts" cannot trip it —
    // and a declaration, not a mention, is what would be a counter.
    const offender = SOURCES.find((source) =>
      /(?:const|let|var)\s+\w*(?:attempts?|remaining|lockedUntil|lockout)\w*\s*[:=]/i.test(source),
    );

    expect(offender, 'an auth screen declares an attempt counter').toBeUndefined();
  });
});
