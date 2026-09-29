import { expect, test } from '@playwright/test';

/**
 * The four contracts the app shell promises, asserted against a real browser.
 *
 * These are the RTL / theme / locale archetypes (`AGENTS.md` section 3.2.4 to
 * 3.2.6) that every later screen copies, which makes this the earliest place
 * to catch a broken shell. A unit test cannot see any of it: the `dir`
 * attribute, the pre-paint theme script and the compiled CSS bundle exist only
 * in a rendered document.
 *
 * The i18n key-parity suite proves the four locale files agree. It cannot prove
 * that any of them is actually reachable over HTTP, or that the locale is
 * reflected into the document. That is what these tests are for.
 */

const LOCALES = [
  { code: 'en', dir: 'ltr' },
  { code: 'ta', dir: 'ltr' },
  { code: 'si', dir: 'ltr' },
  { code: 'ar', dir: 'rtl' },
] as const;

/**
 * The bare root is the first URL anyone types, and it is a 404.
 *
 * `i18n/routing.ts` sets `localePrefix: 'always'`, so every real route is
 * locale-prefixed and `/` matches no page. Nothing rescues it: `proxy.ts` is
 * the Next 16 filename, Next 15 expects `middleware.ts`, and even renamed it
 * would not negotiate a locale because `createMiddleware(routing)` is never
 * called - it only wires the request config. The compiled manifest confirms it:
 * `middleware: {}`.
 *
 * This was known and worked around rather than fixed. `playwright.config.ts`
 * probes `/en` and says so in a comment, which makes a product defect read as
 * expected behaviour. That is the pattern worth catching: a test config
 * accommodating a broken route is how a broken route survives.
 *
 * Only a browser can see this. A unit test cannot - the redirect happens in the
 * request pipeline, before any page renders.
 */
test.describe('locale negotiation at the root', () => {
  test('the bare root is not a 404', async ({ page }) => {
    const response = await page.goto('/');

    expect(
      response?.status(),
      'the bare root 404s. A visitor who types the site address sees "This page could not be found"',
    ).not.toBe(404);

    expect(
      page.url(),
      'the bare root did not land on a locale-prefixed URL',
    ).toMatch(/\/(en|ta|si|ar)$/);
  });

  test.describe('with an Arabic browser preference', () => {
    test.use({ locale: 'ar-SA' });

    test('the root negotiates to Arabic, not to the default', async ({ page }) => {
      await page.goto('/');

      expect(
        page.url(),
        'Accept-Language: ar did not send the visitor to /ar, so a Tamil or Sinhala speaker gets English',
      ).toContain('/ar');

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    });
  });
});

test.describe('locale shell', () => {
  for (const { code, dir } of LOCALES) {
    test(`/${code} renders with dir="${dir}" and lang="${code}"`, async ({ page }) => {
      const response = await page.goto(`/${code}`);

      expect(response?.status(), `/${code} did not return 200`).toBe(200);

      const html = page.locator('html');

      // AGENTS.md 3.2.6: RTL is driven by dir on <html>, not per page.
      await expect(html).toHaveAttribute('dir', dir);
      await expect(html).toHaveAttribute('lang', code);
    });
  }

  test('every locale renders translated copy, not an English fallback', async ({ page }) => {
    // `app.name` is deliberately identical in all four locales - it is the
    // brand. `app.tagline` is genuinely translated, so it is the right probe:
    // a locale silently falling back to English would still be dir=rtl for
    // Arabic and would still carry a valid lang attribute, and only the copy
    // would give it away.
    //
    // An earlier version of this test asserted on the h1 and failed, because
    // h1 is app.name and app.name is "EduFlow" everywhere. The failure was in
    // the test, not the application.
    const readTagline = async (locale: string) => {
      await page.goto(`/${locale}`);
      return page.locator('header p').first().innerText();
    };

    const en = await readTagline('en');
    expect(en, 'the English tagline did not render, so this test cannot prove anything').not.toBe('');

    for (const locale of ['ta', 'si', 'ar']) {
      const tagline = await readTagline(locale);
      expect(tagline, `/${locale} rendered the English tagline, so the locale is falling back to en`).not.toBe(en);
      expect(tagline, `/${locale} rendered an empty tagline`).not.toBe('');
    }
  });

  test('the four locales expose the same set of navigation destinations', async ({ page }) => {
    // Parity of keys is a unit-test concern. Parity of what the browser
    // actually received is an e2e concern, and a missing one slips through.
    //
    // Sequential, not Promise.all: one page cannot navigate four times
    // concurrently, and doing so aborts every request with ERR_ABORTED.
    const readNav = async (locale: string) => {
      await page.goto(`/${locale}`);
      return page.locator('nav a, header a').allInnerTexts();
    };

    const en = await readNav('en');

    for (const locale of ['ta', 'si', 'ar']) {
      const nav = await readNav(locale);
      expect(nav.length, `/${locale} rendered ${nav.length} nav destinations where /en rendered ${en.length}`).toBe(en.length);
    }
  });
});

test.describe('theme shell', () => {
  for (const { code } of LOCALES) {
    test(`/${code} resolves the theme before first paint`, async ({ page }) => {
      await page.goto(`/${code}`);

      // AGENTS.md 3.2.5 requires data-theme set on <html> before first paint,
      // otherwise the document flashes the wrong theme. theme-script.tsx runs
      // in <head>, so the attribute must already be present at DOMContentLoaded
      // - not merely appear after hydration.
      const atFirstPaint = await page.evaluate(() => {
        const el = document.documentElement;
        return { theme: el.getAttribute('data-theme'), scheme: getComputedStyle(el).colorScheme };
      });

      expect(atFirstPaint.theme, `/${code} has no data-theme on <html>`).toBe('light');
      expect(atFirstPaint.scheme).toBe('light');
    });
  }

  test('the design tokens are actually applied to the document', async ({ page }) => {
    await page.goto('/en');

    // The token test reads the source stylesheet, which a build-time minifier
    // could rewrite (it turns #ffffff into #fff). Only a rendered document
    // proves the shipped bundle carries them.
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const names = ['--bg', '--surface', '--text', '--muted', '--border', '--brand', '--brand-2', '--accent', '--danger', '--ok'];
      return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(n).trim()]));
    });

    for (const [name, value] of Object.entries(tokens)) {
      expect(value, `${name} is not applied on the rendered document`).not.toBe('');
    }
  });
});
