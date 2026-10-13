import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  diffPixels,
  parseManifest,
  verifyBaselines,
  verifyManifest,
  verifyTemplateChecksums,
} from '../../../../scripts/visual-regression.mjs';

/**
 * `PLT-1003` T4 — the Playwright visual-regression harness.
 *
 * ## What this spec is the contract for
 *
 * The AC: "baseline screenshots exist for every templated screen in all four
 * combinations (landing, login, forgot, reset, dashboard × light/dark ×
 * LTR/RTL), **taken from the template HTML itself**, so 'the product looks
 * like the approved design' becomes a screenshot diff rather than an eyeball
 * judgement."
 *
 * Three properties make a baseline set a *gate* rather than decoration, and
 * each one is a pure function this spec drives:
 *
 * 1. **The mapping is complete and reconciled both ways.** A baseline set
 *    that covers only the screens someone remembered misses the next one.
 *    The reconciliation is `check-route-guards`' rule applied to views:
 *    every view the approved templates declare is either mapped to a screen
 *    or excluded with a reason, so a view that appears later fails naming
 *    itself — a new view nobody baselined is a new view nobody compares.
 *
 * 2. **A baseline is only capturable while its template is checksum-clean.**
 *    T2 gates the templates; T4 composes with the same decision rather than
 *    re-deriving it, so a screenshot can never bless an unapproved edit.
 *
 * 3. **A baseline goes stale when its template changes.** T2's authorisation
 *    makes an edit legal; it does not make the old screenshots still true.
 *    Each baseline records the checksum of the template it was taken from,
 *    and a mismatch fails with the re-capture command.
 *
 * ## Why not Playwright's `toHaveScreenshot`
 *
 * Playwright snapshots compare a page against a baseline of *the same page*.
 * The baseline here is the **template** and the thing compared later is the
 * **app** — two different documents, deliberately not pixel-identical (the
 * ported CSS is re-authored, and `template-dictionary.spec.ts` pins the copy
 * divergences). So the harness owns its diff: this spec pins the decisions,
 * and `apps/web/scripts/visual-capture.mjs` owns the browser.
 */

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

const LANDING_TEMPLATE = 'EduFlow — Frontend Template.html';
const AUTH_TEMPLATE = 'EduFlow360_Template_Landing_Auth.html';
const DASHBOARD_TEMPLATE = 'EduFlow360_Template_Admin_Dashboard.html';

/** Every view each template declares on disk, as the ids found in its markup. */
const VIEWS = new Map<string, string[]>([
  [LANDING_TEMPLATE, ['view-landing', 'view-login', 'view-forgot', 'view-reset', 'view-dashboard']],
  [AUTH_TEMPLATE, ['view-landing', 'view-login', 'view-forgot', 'view-reset', 'view-dashboard']],
  [DASHBOARD_TEMPLATE, []],
]);

/** The five templated screens of the AC, in manifest order. */
const screen = (
  id: string,
  template: string,
  view: string | null,
  route: string,
  parity: Record<string, unknown>,
) => ({ id, template, view, route, parity });

const measured = (maxDiffPixelRatio: number) => ({
  status: 'measured',
  maxDiffPixelRatio,
  reason: 'token-faithful port',
});

const deferred = (story: string) => ({ status: 'deferred', story, reason: 'not ported yet' });

/** The shipped manifest's shape: all five screens, every view accounted for. */
const manifestFixture = () => ({
  viewport: { width: 1280, height: 720 },
  combinations: [
    { theme: 'light', dir: 'ltr', locale: 'en' },
    { theme: 'light', dir: 'rtl', locale: 'ar' },
    { theme: 'dark', dir: 'ltr', locale: 'en' },
    { theme: 'dark', dir: 'rtl', locale: 'ar' },
  ],
  screens: [
    screen('landing', LANDING_TEMPLATE, 'view-landing', '/{locale}', measured(0.01)),
    screen('login', AUTH_TEMPLATE, 'view-login', '/{locale}/sign-in', deferred('PLT-1004')),
    screen(
      'forgot',
      AUTH_TEMPLATE,
      'view-forgot',
      '/{locale}/sign-in/forgot',
      deferred('PLT-1004'),
    ),
    screen('reset', AUTH_TEMPLATE, 'view-reset', '/{locale}/sign-in/reset', deferred('PLT-1004')),
    screen('dashboard', DASHBOARD_TEMPLATE, null, '/{locale}/admin', deferred('PLT-1005')),
  ],
  excludedViews: [
    {
      template: AUTH_TEMPLATE,
      view: 'view-landing',
      reason: 'the landing baseline comes from the legacy donor the port actually used',
    },
    {
      template: AUTH_TEMPLATE,
      view: 'view-dashboard',
      reason: 'superseded second dashboard; the live one is the Admin_Dashboard template',
    },
    {
      template: LANDING_TEMPLATE,
      view: 'view-login',
      reason: 'superseded by the Landing_Auth template the auth screens were ported from',
    },
    {
      template: LANDING_TEMPLATE,
      view: 'view-forgot',
      reason: 'superseded by the Landing_Auth template the auth screens were ported from',
    },
    {
      template: LANDING_TEMPLATE,
      view: 'view-reset',
      reason: 'superseded by the Landing_Auth template the auth screens were ported from',
    },
    {
      template: LANDING_TEMPLATE,
      view: 'view-dashboard',
      reason: 'superseded by the Admin_Dashboard template',
    },
  ],
});

/** Every screen × combination filename, as the capture names them. */
const allBaselineNames = (manifest: ReturnType<typeof manifestFixture>) =>
  manifest.screens.flatMap((s) =>
    manifest.combinations.map((c) => `${s.id}-${c.theme}-${c.dir}.png`),
  );

/** The index the capture writes: filename → what it was taken from. */
const fullIndex = (manifest: ReturnType<typeof manifestFixture>, checksum = SHA_A) =>
  Object.fromEntries(
    manifest.screens.flatMap((s) =>
      manifest.combinations.map((c) => [
        `${s.id}-${c.theme}-${c.dir}.png`,
        { screen: s.id, theme: c.theme, dir: c.dir, templateChecksum: checksum },
      ]),
    ),
  );

const KNOWN_TEMPLATES = new Set([LANDING_TEMPLATE, AUTH_TEMPLATE, DASHBOARD_TEMPLATE]);

/* ------------------------------------------------------------------ */
/* parseManifest                                                       */
/* ------------------------------------------------------------------ */

describe('parseManifest', () => {
  it('accepts a manifest whose screens carry a parity record', () => {
    const parsed = parseManifest(manifestFixture());

    expect(parsed?.screens.map((s: { id: string }) => s.id)).toEqual([
      'landing',
      'login',
      'forgot',
      'reset',
      'dashboard',
    ]);
  });

  it('refuses a manifest whose screen has no parity record at all', () => {
    // A screen with no parity declaration is a screen whose comparison
    // status nobody decided; the manifest refuses it rather than defaulting.
    const broken = manifestFixture();
    delete (broken.screens[0] as { parity?: unknown }).parity;

    expect(() => parseManifest(broken)).toThrow(/parity/i);
  });
});

/* ------------------------------------------------------------------ */
/* verifyManifest — the two-way reconciliation                         */
/* ------------------------------------------------------------------ */

describe('verifyManifest', () => {
  it('passes when every view is mapped or excluded with a reason', () => {
    expect(verifyManifest({ manifest: manifestFixture(), views: VIEWS })).toEqual([]);
  });

  it('fails when a mapped view does not exist in its template', () => {
    // Two findings, and that is the point: the bad mapping is one, and the
    // view it vacated (view-landing, now unmapped) is the other. The
    // reconciliation is two-way, so a mistake surfaces from both sides.
    const broken = manifestFixture();
    (broken.screens[0] as { view: string | null }).view = 'view-does-not-exist';

    const findings = verifyManifest({ manifest: broken, views: VIEWS });

    expect(findings).toHaveLength(2);
    expect(findings[0]?.message).toContain('view-does-not-exist');
    expect(findings[1]?.message).toContain('view-landing');
  });

  it('fails naming every view that is neither mapped nor excluded', () => {
    // THE teeth. The superseded second dashboard inside
    // EduFlow360_Template_Landing_Auth.html is real, and only an exclusion
    // row with a reason keeps it out of the baseline set. Delete the
    // exclusions and the reconciliation must fail naming exactly the six
    // views nothing accounts for — the same shape as a brand-new view.
    const withoutExclusions = { ...manifestFixture(), excludedViews: [] };

    const findings = verifyManifest({ manifest: withoutExclusions, views: VIEWS });

    const named = findings
      .map((f: { template: string; view: string }) => `${f.template}#${f.view}`)
      .sort();
    expect(named).toEqual(
      [
        `${AUTH_TEMPLATE}#view-dashboard`,
        `${AUTH_TEMPLATE}#view-landing`,
        `${LANDING_TEMPLATE}#view-dashboard`,
        `${LANDING_TEMPLATE}#view-forgot`,
        `${LANDING_TEMPLATE}#view-login`,
        `${LANDING_TEMPLATE}#view-reset`,
      ].sort(),
    );
  });

  it('fails when an exclusion carries no reason', () => {
    // An unexplained exclusion is an unmapped view with extra steps.
    const broken = manifestFixture();
    (broken.excludedViews[0] as { reason: string }).reason = '   ';

    const findings = verifyManifest({ manifest: broken, views: VIEWS });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/reason/i);
  });

  it('fails when parity is measured without a numeric tolerance', () => {
    const broken = manifestFixture();
    delete (broken.screens[0].parity as { maxDiffPixelRatio?: number }).maxDiffPixelRatio;

    const findings = verifyManifest({ manifest: broken, views: VIEWS });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/tolerance/i);
  });

  it('fails when parity is deferred without the story that will enforce it', () => {
    const broken = manifestFixture();
    delete (broken.screens[1].parity as { story?: string }).story;

    const findings = verifyManifest({ manifest: broken, views: VIEWS });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/PLT-1004/);
  });

  it('refuses a screen whose template the checksum baseline does not know', () => {
    // Composition with T2: a manifest may only baseline approved templates.
    // Two findings again, and again by design: the unknown template is one,
    // and the legacy view-landing the move vacated is the other.
    const broken = manifestFixture();
    (broken.screens[0] as { template: string }).template = 'EduFlow360_Template_Unknown.html';
    const views = new Map(VIEWS);
    views.set('EduFlow360_Template_Unknown.html', ['view-landing']);

    const findings = verifyManifest({
      manifest: broken,
      views,
      knownTemplates: KNOWN_TEMPLATES,
    });

    expect(findings).toHaveLength(2);
    expect(findings[0]?.message).toContain('EduFlow360_Template_Unknown.html');
    expect(findings[1]?.message).toContain('view-landing');
  });
});

/* ------------------------------------------------------------------ */
/* verifyTemplateChecksums — the capture refuses a dirty tree          */
/* ------------------------------------------------------------------ */

describe('verifyTemplateChecksums', () => {
  const baseline = { [LANDING_TEMPLATE]: SHA_A, [AUTH_TEMPLATE]: SHA_A };
  const file = (name: string, checksum: string) => ({ name, checksum });
  const tree = () => [file(LANDING_TEMPLATE, SHA_A), file(AUTH_TEMPLATE, SHA_A)];

  it('passes on a clean tree', () => {
    expect(verifyTemplateChecksums({ files: tree(), baseline, authorisations: new Map() })).toEqual(
      [],
    );
  });

  it('fails on a template edited without an owner authorisation', () => {
    // The composition T4 needs: the SAME decision T2's gate makes, reused,
    // so a screenshot can never be captured of a template whose edit is
    // still unapproved.
    const findings = verifyTemplateChecksums({
      files: [file(LANDING_TEMPLATE, SHA_B), file(AUTH_TEMPLATE, SHA_A)],
      baseline,
      authorisations: new Map(),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('MODIFIED');
  });
});

/* ------------------------------------------------------------------ */
/* verifyBaselines — existence and freshness                            */
/* ------------------------------------------------------------------ */

describe('verifyBaselines', () => {
  const manifest = manifestFixture();
  const TEMPLATE_OF: Record<string, string> = {
    landing: LANDING_TEMPLATE,
    login: AUTH_TEMPLATE,
    forgot: AUTH_TEMPLATE,
    reset: AUTH_TEMPLATE,
    dashboard: DASHBOARD_TEMPLATE,
  };
  const checksumsNow = () => ({
    [LANDING_TEMPLATE]: SHA_A,
    [AUTH_TEMPLATE]: SHA_A,
    [DASHBOARD_TEMPLATE]: SHA_A,
  });

  it('passes when every screen × combination has a fresh baseline on disk', () => {
    const index = fullIndex(manifest);

    const findings = verifyBaselines({
      manifest,
      index,
      files: new Set(Object.keys(index)),
      templateChecksums: checksumsNow(),
      templateOf: TEMPLATE_OF,
    });

    expect(findings).toEqual([]);
  });

  it('fails for every screen × combination with no baseline file', () => {
    // The full index is present but only ONE file exists on disk. The AC
    // wants twenty; nineteen missing is nineteen findings, each naming the
    // file and how to produce it.
    const index = fullIndex(manifest);
    const only = Object.keys(index)[0] as string;

    const findings = verifyBaselines({
      manifest,
      index,
      files: new Set([only]),
      templateChecksums: checksumsNow(),
      templateOf: TEMPLATE_OF,
    });

    expect(findings).toHaveLength(19);
    expect(findings[0]?.message).toMatch(/missing/i);
    expect(findings.some((f: { file: string }) => f.file === only)).toBe(false);
  });

  it('names a baseline the index records but the disk does not hold', () => {
    // The other misshape: the index remembers a file the repository lost.
    const index = fullIndex(manifest);
    const only = Object.keys(index)[1] as string;

    const findings = verifyBaselines({
      manifest,
      index,
      files: new Set(Object.keys(index).filter((name) => name !== only)),
      templateChecksums: checksumsNow(),
      templateOf: TEMPLATE_OF,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toBe(only);
    expect(findings[0]?.message).toMatch(/missing/i);
  });

  it('fails when a baseline records a checksum its template no longer has', () => {
    // T2 authorises the edit; this is what says the screenshots are stale.
    const index = fullIndex(manifest, SHA_A);

    const findings = verifyBaselines({
      manifest,
      index,
      files: new Set(Object.keys(index)),
      templateChecksums: { ...checksumsNow(), [AUTH_TEMPLATE]: SHA_B },
      templateOf: TEMPLATE_OF,
    });

    // Three auth screens × four combinations went stale together.
    const stale = findings.filter((f: { message: string }) => /stale/i.test(f.message));
    expect(stale).toHaveLength(12);
    expect(stale[0]?.message).toContain(SHA_B);
  });
});

/* ------------------------------------------------------------------ */
/* diffPixels — the comparison decision                                */
/* ------------------------------------------------------------------ */

/**
 * A minimal PNG encoder, test-only.
 *
 * The alternative is fixture binaries in the repository, which hides the
 * very thing under test: the diff must react to EXACTLY the pixels these
 * tests declare, so the tests must own the pixels.
 */
function crc32(buf: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

type Rgba = [number, number, number, number];

/** An 8-bit RGBA PNG, every pixel `color`, with an optional single `patch`. */
function encodePng(
  width: number,
  height: number,
  color: Rgba,
  patch?: { x: number; y: number; color: Rgba },
): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const p = rowStart + 1 + x * 4;
      const c = patch && patch.x === x && patch.y === y ? patch.color : color;
      raw[p] = c[0];
      raw[p + 1] = c[1];
      raw[p + 2] = c[2];
      raw[p + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];

describe('diffPixels', () => {
  const expected = () => encodePng(8, 8, BLACK);

  it('reports no difference for identical images', () => {
    const result = diffPixels({
      expected: expected(),
      actual: encodePng(8, 8, BLACK),
      threshold: 0.1,
    });

    expect(result.ratio).toBe(0);
    expect(result.differing).toBe(0);
    expect(result.firstDiff).toBeNull();
  });

  it('reports the position of a changed pixel and its ratio', () => {
    const actual = encodePng(8, 8, BLACK, { x: 5, y: 3, color: WHITE });

    const result = diffPixels({ expected: expected(), actual, threshold: 0.1 });

    expect(result.differing).toBe(1);
    expect(result.ratio).toBeCloseTo(1 / 64, 10);
    expect(result.firstDiff).toEqual({ x: 5, y: 3 });
  });

  it('ignores a change inside the per-pixel tolerance', () => {
    // One channel off by 10 of 255 under threshold 0.1 (25.5/255) is the
    // same pixel for a design diff; antialiasing and font hinting produce
    // exactly this noise.
    const actual = encodePng(8, 8, BLACK, { x: 0, y: 0, color: [10, 0, 0, 255] });

    const result = diffPixels({ expected: expected(), actual, threshold: 0.1 });

    expect(result.differing).toBe(0);
  });

  it('reports a dimension mismatch instead of comparing nonsense', () => {
    const result = diffPixels({
      expected: encodePng(8, 8, BLACK),
      actual: encodePng(6, 8, BLACK),
      threshold: 0.1,
    });

    expect(result.dimensionsMatch).toBe(false);
  });
});
