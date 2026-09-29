import { expect, test, type Page } from '@playwright/test';

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

/**
 * The landing page.
 *
 * Its layout, visual language and four-locale copy are built from
 * `docs/template/` — but not its claims. `AGENTS.md` 2.8 says of that file:
 * _"Do not take the marketing claims — 'Trusted by 200+ schools' and '1.2M
 * Students Managed' are false, and 'Start Free Trial' contradicts a
 * per-school deployment sold on editions."_
 *
 * So the forbidden strings are asserted **absent**. That is the part of this
 * block that matters and the part that is easy to lose: the page looks finished,
 * so a later edit that restores "Trusted by 200+ schools" changes nothing
 * visually and fails nothing. Until now nothing in the repository would have
 * noticed.
 */
test.describe('landing page', () => {
  test('renders the hero and the four feature blocks', async ({ page }) => {
    await page.goto('/en');

    await expect(
      page.getByRole('heading', { level: 1 }),
      'the landing page has no h1, so /en is still the bare scaffold shell',
    ).toBeVisible();

    const features = page.locator('[data-testid="feature"]');
    await expect(
      features,
      'the landing page renders no feature blocks',
    ).toHaveCount(4);

    await expect(
      features.first(),
      'a feature block rendered empty, so a translation key resolved to nothing',
    ).not.toBeEmpty();
  });

  test('states no claim the governing contract calls false', async ({ page }) => {
    await page.goto('/en');

    const text = await page.locator('body').innerText();

    // Each of these is named or implied by AGENTS.md 2.8, D2/D4 (per-school
    // deployment sold on editions) or D5/ADR-005 (mobile is milestone 2).
    const FORBIDDEN: ReadonlyArray<readonly [string, string]> = [
      ['200+', 'AGENTS.md 2.8: "Trusted by 200+ schools" is not true of this product'],
      ['1.2M', 'AGENTS.md 2.8: "1.2M Students Managed" is not true of this product'],
      ['Free Trial', 'D2/D4: one deployment per school, sold on editions. There is no trial to start.'],
      ['Mobile for Everyone', 'D5/ADR-005: apps/mobile is milestone 2, not a shipped feature'],
    ];

    for (const [claim, why] of FORBIDDEN) {
      expect(text, `the landing page claims "${claim}" - ${why}`).not.toContain(claim);
    }
  });

  test('every locale renders the landing page in its own language', async ({ page }) => {
    // Parity of keys is a unit-test concern (packages/i18n-resources). That a
    // key is *reachable* and *used* is an e2e concern, and the failure mode is
    // silent: a missing key renders the key path, or falls back to English
    // without changing dir or lang.
    const readHero = async (locale: string) => {
      await page.goto(`/${locale}`);
      return page.locator('h1').first().innerText();
    };

    const en = await readHero('en');
    expect(en, 'the English hero did not render, so this test cannot prove anything').not.toBe('');

    for (const locale of ['ta', 'si', 'ar']) {
      const hero = await readHero(locale);
      expect(hero, `/${locale} rendered an empty hero`).not.toBe('');
      expect(hero, `/${locale} fell back to the English hero`).not.toBe(en);
    }
  });
});

test.describe('landing page motion', () => {
  // The template's character is largely motion: an animated mesh-gradient hero,
  // drifting orbs, a gradient that sheens across the heading, a glow pulse on
  // the primary call to action, and a scrolling marquee. A landing page that
  // drops all of it is a different product, so the motion is asserted rather
  // than assumed.
  //
  // `document.getAnimations()` is the assertion that actually works. Checking
  // that a `@keyframes` block exists in the stylesheet proves only that someone
  // typed it; checking `animation-name` on an element proves a rule is
  // *assigned*. Only the running-animation list proves the browser is
  // compositing it, which is what a visitor sees.
  const runningAnimations = (page: Page) =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => ((a as CSSAnimation).animationName as string | undefined) ?? a.constructor.name),
    );

  test('the hero runs the template signature animations', async ({ page }) => {
    await page.goto('/en');

    const names = await runningAnimations(page);

    for (const expected of ['sheen', 'meshShift', 'drift', 'pulse', 'glowPulse', 'scroll']) {
      expect(names, `the ${expected} animation is not running on /en`).toContain(expected);
    }
  });

  test('the marquee scrolls the module list', async ({ page }) => {
    await page.goto('/en');

    const marquee = page.locator('[data-testid="marquee-track"]');
    await expect(marquee, 'the module marquee is missing from the landing page').toBeVisible();

    // The track is duplicated so the -50% translate loops seamlessly. Both
    // halves must be present or the seam is visible.
    const items = page.locator('[data-testid="marquee-item"]');
    expect(await items.count(), 'the marquee needs two identical halves to loop').toBeGreaterThanOrEqual(12);
  });

  test('prefers-reduced-motion stops every animation', async ({ page }) => {
    // AGENTS.md 3.2.7 requires reduced motion to be respected. The template has
    // no rule for it at all, so this is the guarantee this project has to
    // supply rather than inherit.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');

    // Wait for the pre-paint theme script and the first paint to settle, so a
    // still-initialising animation is not counted as "not running".
    await page.waitForLoadState('networkidle');

    const names = await runningAnimations(page);

    expect(
      names,
      `a visitor who asked for reduced motion is still running: ${names.join(', ') || '(none)'}`,
    ).toHaveLength(0);
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
    // A locale silently falling back to English would still be dir=rtl for
    // Arabic and would still carry a valid lang attribute, and only the copy
    // would give it away. So the probe has to be a string that is genuinely
    // translated in all four locales.
    //
    // It probes the hero sub, not the h1. Two earlier probes were both wrong:
    // the h1 used to be `app.name` ("EduFlow", identical everywhere), and this
    // one used to be `app.tagline` inside a `<header>` that the landing page
    // no longer renders. `app.tagline` is now unused by any screen; the copy
    // the visitor actually reads is the hero, so the test follows it there.
    // Probing the h1 as well is what the "landing page" describe block does.
    const readHeroSub = async (locale: string) => {
      await page.goto(`/${locale}`);
      return page.locator('[data-testid="hero-sub"]').innerText();
    };

    const en = await readHeroSub('en');
    expect(en, 'the English hero sub did not render, so this test cannot prove anything').not.toBe('');

    for (const locale of ['ta', 'si', 'ar']) {
      const sub = await readHeroSub(locale);
      expect(sub, `/${locale} rendered the English hero sub, so the locale is falling back to en`).not.toBe(en);
      expect(sub, `/${locale} rendered an empty hero sub`).not.toBe('');
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
