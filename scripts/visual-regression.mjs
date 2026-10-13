/**
 * `visual-regression` — the pure core of the `PLT-1003` T4 harness.
 *
 * ## What this harness decides, and what it deliberately does not
 *
 * The AC: "baseline screenshots exist for every templated screen in all
 * four combinations (landing, login, forgot, reset, dashboard × light/dark
 * × LTR/RTL), taken from the template HTML itself, so 'the product looks
 * like the approved design' becomes a screenshot diff rather than an
 * eyeball judgement."
 *
 * This file owns the DECISIONS of that harness and no browser: which views
 * must be baselined, whether a baseline is fresh, whether a captured
 * screenshot still matches its baseline. The browser half — opening the
 * template, setting theme and direction, pressing the shutter — is
 * `apps/web/scripts/visual-capture.mjs`, because that is the only place
 * `playwright` resolves. The spec that pins this file's behaviour is
 * `apps/api/src/config/visual-regression.spec.ts`.
 *
 * ## Three properties make a baseline a gate rather than decoration
 *
 * 1. **The mapping is complete, both ways.** Every view the approved
 *    templates declare is mapped to a screen or excluded with a reason —
 *    the `check-route-guards` rule applied to views. A view that appears
 *    in a later template revision fails naming itself, because a view
 *    nobody baselined is a view nobody compares.
 *
 * 2. **A baseline records the template it came from.** `PLT-1003` T2's
 *    authorisation makes an edit legal; it does not make the old
 *    screenshots true. A baseline whose recorded checksum no longer
 *    matches its template is stale and fails with the re-capture command.
 *
 * 3. **Capture refuses a dirty tree.** The capture reuses `verifyTemplates`
 *    from `check-templates.mjs` (T2) rather than re-deriving the decision,
 *    so a screenshot can never bless an edit the owner has not approved.
 *
 * Plain `.mjs`, like `check-route-guards.mjs` and `check-templates.mjs`, so
 * `node` runs it with no build step and `pnpm typecheck` does not cover it.
 *
 * JSDoc types:
 * @typedef {{ id: string, template: string, view: string | null, route: string, parity: Parity }} Screen
 * @typedef {{ theme: 'light' | 'dark', dir: 'ltr' | 'rtl', locale: string }} Combination
 * @typedef {{ template: string, view: string, reason: string }} Exclusion
 * @typedef {{ viewport: { width: number, height: number }, combinations: Combination[], screens: Screen[], excludedViews: Exclusion[] }} Manifest
 * @typedef {{ name: string, checksum: string }} TemplateFile
 * @typedef {{ screen?: string, template?: string, view?: string, file?: string, message: string }} Finding
 * @typedef {{ status: 'measured', maxDiffPixelRatio: number, reason?: string, measuredOn?: string } | { status: 'deferred', story: string, reason?: string }} Parity
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { REPO_ROOT } from './paths.mjs';
import { verifyTemplates } from './check-templates.mjs';

/** Where the harness's data lives, all relative to the repository root. */
export const MANIFEST_PATH = 'visual-regression.json';
export const BASELINE_DIRECTORY = 'apps/web/tests/visual/baselines';
export const BASELINE_INDEX = 'apps/web/tests/visual/baselines/index.json';

/** The four combinations the AC names: light/dark × LTR/RTL. */
const REQUIRED_COMBINATIONS = [
  { theme: 'light', dir: 'ltr', locale: 'en' },
  { theme: 'light', dir: 'rtl', locale: 'ar' },
  { theme: 'dark', dir: 'ltr', locale: 'en' },
  { theme: 'dark', dir: 'rtl', locale: 'ar' },
];

/* ------------------------------------------------------------------ */
/* The manifest                                                        */
/* ------------------------------------------------------------------ */

/**
 * The parity findings for one screen, shared by `parseManifest` (which
 * throws on malformed input) and `verifyManifest` (which reports).
 *
 * @param {Parity | undefined} parity
 * @param {string} screenId
 * @returns {Finding[]}
 */
function parityFindings(parity, screenId) {
  if (parity === null || typeof parity !== 'object') {
    return [
      {
        screen: screenId,
        message:
          `screen "${screenId}" declares no parity record. Every screen must say either ` +
          'parity=measured with a tolerance, or parity=deferred with the story that will ' +
          'enforce it (PLT-1004, PLT-1005) — an undeclared screen is a comparison nobody decided.',
      },
    ];
  }

  if (parity.status === 'measured') {
    const tolerance = parity.maxDiffPixelRatio;
    const numeric = typeof tolerance === 'number' && Number.isFinite(tolerance);
    if (!numeric || tolerance < 0 || tolerance > 1) {
      return [
        {
          screen: screenId,
          message:
            `screen "${screenId}" is parity=measured but declares no usable tolerance: ` +
            'maxDiffPixelRatio must be a number between 0 and 1. The ported screens are ' +
            'deliberately not pixel-identical to the template, so the tolerance is the ' +
            'recorded measurement of that divergence — it may not be absent.',
        },
      ];
    }
    return [];
  }

  if (parity.status === 'deferred') {
    const story = typeof parity.story === 'string' ? parity.story.trim() : '';
    if (story === '') {
      return [
        {
          screen: screenId,
          message:
            `screen "${screenId}" is parity=deferred but names no story that will enforce it. ` +
            'A deferred comparison is a reviewable exemption (the shape of ' +
            'route-guards.allowlist.json and @Public), and an exemption without the ticket ' +
            'that closes it is an exemption nobody lifts — name it, e.g. PLT-1004.',
        },
      ];
    }
    return [];
  }

  return [
    {
      screen: screenId,
      message:
        `screen "${screenId}" has parity.status "${String(parity.status)}", which is neither ` +
        '"measured" nor "deferred".',
    },
  ];
}

/**
 * Validate the manifest file's shape, throwing on anything malformed.
 *
 * `verifyManifest` reports; this one throws, because it is the entry point
 * for reading `visual-regression.json` and a malformed manifest is a
 * broken harness, not a finding about the tree.
 *
 * @param {unknown} json
 * @returns {Manifest}
 */
export function parseManifest(json) {
  const manifest = /** @type {Manifest} */ (json);

  if (manifest === null || typeof manifest !== 'object') {
    throw new Error('visual-regression.json is not an object');
  }

  if (!Array.isArray(manifest.screens) || manifest.screens.length === 0) {
    throw new Error('visual-regression.json has no screens');
  }

  for (const screen of manifest.screens) {
    if (typeof screen.id !== 'string' || screen.id === '') {
      throw new Error('a screen has no id');
    }
    if (typeof screen.template !== 'string' || screen.template === '') {
      throw new Error(`screen "${screen.id}" names no template`);
    }
    if (typeof screen.route !== 'string' || !screen.route.startsWith('/')) {
      throw new Error(`screen "${screen.id}" has no route (must start with "/")`);
    }
    if (screen.view !== null && typeof screen.view !== 'string') {
      throw new Error(`screen "${screen.id}" has a view that is neither a string nor null`);
    }
    const findings = parityFindings(screen.parity, screen.id);
    if (findings.length > 0) {
      throw new Error(findings[0]?.message ?? 'invalid parity');
    }
  }

  if (!Array.isArray(manifest.combinations) || manifest.combinations.length === 0) {
    throw new Error('visual-regression.json declares no combinations');
  }

  for (const combination of manifest.combinations) {
    if (combination.theme !== 'light' && combination.theme !== 'dark') {
      throw new Error(`combination theme "${String(combination.theme)}" is not light or dark`);
    }
    if (combination.dir !== 'ltr' && combination.dir !== 'rtl') {
      throw new Error(`combination dir "${String(combination.dir)}" is not ltr or rtl`);
    }
  }

  if (!Array.isArray(manifest.excludedViews)) {
    throw new Error('visual-regression.json has no excludedViews array');
  }

  for (const exclusion of manifest.excludedViews) {
    if (typeof exclusion.template !== 'string' || typeof exclusion.view !== 'string') {
      throw new Error('an exclusion names no template/view pair');
    }
    if (typeof exclusion.reason !== 'string' || exclusion.reason.trim() === '') {
      throw new Error(`the exclusion of ${exclusion.template}#${exclusion.view} carries no reason`);
    }
  }

  return manifest;
}

/**
 * Reconcile the manifest against the views the templates actually declare.
 *
 * Both directions, because `route-guards` established that a one-way check
 * rots silently: a mapped view that vanished (the template no longer has
 * it) and a view nobody accounts for are the same defect seen from two
 * sides.
 *
 * @param {{
 *   manifest: Manifest,
 *   views: ReadonlyMap<string, readonly string[]>,
 *   knownTemplates?: ReadonlySet<string>,
 * }} tree
 * @returns {Finding[]}
 */
export function verifyManifest({ manifest, views, knownTemplates }) {
  /** @type {Finding[]} */
  const findings = [];

  const mapped = new Set();

  for (const screen of manifest.screens) {
    findings.push(...parityFindings(screen.parity, screen.id));

    if (knownTemplates !== undefined && !knownTemplates.has(screen.template)) {
      findings.push({
        screen: screen.id,
        message:
          `screen "${screen.id}" baselines ${screen.template}, which is not in the approved ` +
          'baseline of template-checksums.json. A screenshot of an unapproved document is ' +
          'not a baseline of the approved design.',
      });
      continue;
    }

    if (screen.view === null) continue;

    const declared = views.get(screen.template) ?? [];
    if (!declared.includes(screen.view)) {
      findings.push({
        screen: screen.id,
        message:
          `screen "${screen.id}" maps ${screen.template}#${screen.view}, but that template ` +
          'declares no such view. The mapping names a view that does not exist.',
      });
      continue;
    }

    mapped.add(`${screen.template}#${screen.view}`);
  }

  // Only templates at least one screen baselines are this harness's
  // business. An approved template nobody baselines is a fact about the
  // manifest, not a hole in a baseline set.
  const referenced = new Set(manifest.screens.map((screen) => screen.template));

  for (const [template, declared] of views) {
    if (!referenced.has(template)) continue;

    for (const view of declared) {
      const key = `${template}#${view}`;
      if (mapped.has(key)) continue;

      const exclusion = manifest.excludedViews.find(
        (candidate) => candidate.template === template && candidate.view === view,
      );

      if (exclusion === undefined) {
        findings.push({
          template,
          view,
          message:
            `${key} is declared by an approved template but no screen baselines it and no ` +
            'exclusion explains it. A view nobody baselined is a view nobody compares: map ' +
            'it in visual-regression.json, or exclude it with a reason.',
        });
        continue;
      }

      if (exclusion.reason.trim() === '') {
        findings.push({
          template,
          view,
          message: `${key} is excluded with a blank reason. An unexplained exclusion is an unmapped view with extra steps.`,
        });
      }
    }
  }

  return findings;
}

/**
 * Read the view ids a template declares: every `id="view-…"` in its markup.
 *
 * COMMENTS ARE STRIPPED FIRST. The repository has been bitten twice by
 * declaration parsers that read comment bodies as code (an apostrophe in
 * `AC-2's` swallowing a seed array; a `--warn:` inside a comment swallowing
 * a CSS declaration). A view id mentioned in a comment is not a declared
 * view.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function readTemplateViews(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  return [...withoutComments.matchAll(/\bid="(view-[^"]+)"/g)].map((match) => match[1]);
}

/* ------------------------------------------------------------------ */
/* Composition with T2 — capture refuses a dirty tree                  */
/* ------------------------------------------------------------------ */

/**
 * Re-export the T2 decision, because the capture composes with it.
 *
 * The capture must refuse to screenshot a template whose edit is not yet
 * owner-authorised, and the only honest way to say so is to run the same
 * check T2's gate runs, against the same arguments, rather than a
 * re-derivation that can quietly disagree with it.
 *
 * @param {{ files: readonly TemplateFile[], baseline: Readonly<Record<string, string>>, authorisations: ReadonlyMap<string, ReadonlySet<string>> }} tree
 * @returns {Finding[]}
 */
export function verifyTemplateChecksums(tree) {
  return verifyTemplates(tree);
}

/* ------------------------------------------------------------------ */
/* Baseline freshness                                                  */
/* ------------------------------------------------------------------ */

/** The filename a screen × combination baseline is stored under. */
export const baselineFilename = (screenId, combination) =>
  `${screenId}-${combination.theme}-${combination.dir}.png`;

/**
 * Decide whether the baseline set on disk still describes the design.
 *
 * Three failure shapes, and all three have a repair command in their
 * message because a check whose honest path is hard to find teaches people
 * to bypass it:
 *
 * - **missing** — the screen × combination has no baseline file at all.
 * - **stale** — the baseline exists but records a checksum its template no
 *   longer has (the template was edited and re-approved since capture).
 * - **orphan** — the index names a file no screen requires (the manifest
 *   shrank; the baseline should have been deleted with it).
 *
 * @param {{
 *   manifest: Manifest,
 *   index: Readonly<Record<string, { screen: string, theme: string, dir: string, templateChecksum: string }>>,
 *   files: ReadonlySet<string>,
 *   templateChecksums: Readonly<Record<string, string>>,
 *   templateOf: Readonly<Record<string, string>>,
 * }} tree
 * @returns {Finding[]}
 */
export function verifyBaselines({ manifest, index, files, templateChecksums, templateOf }) {
  /** @type {Finding[]} */
  const findings = [];

  const required = new Map();
  for (const screen of manifest.screens) {
    for (const combination of manifest.combinations) {
      required.set(baselineFilename(screen.id, combination), { screen, combination });
    }
  }

  for (const [filename, { screen, combination }] of required) {
    const entry = index[filename];

    if (entry === undefined) {
      findings.push({
        file: filename,
        message:
          `no baseline is recorded for ${screen.id} (${combination.theme}/${combination.dir}): ` +
          `${filename} is missing from the baseline index. Capture it with ` +
          '`pnpm visual:capture` and commit the file with its index entry.',
      });
      continue;
    }

    if (!files.has(filename)) {
      findings.push({
        file: filename,
        message:
          `${filename} is in the baseline index but MISSING from disk. Either restore the ` +
          'file or re-run `pnpm visual:capture` to regenerate the set.',
      });
      continue;
    }

    const template = templateOf[screen.id];
    const current = template === undefined ? undefined : templateChecksums[template];
    if (template === undefined || current === undefined) {
      findings.push({
        file: filename,
        message:
          `no template is recorded for screen "${screen.id}", so ${filename}'s freshness ` +
          'cannot be established. The manifest must name its template.',
      });
      continue;
    }

    if (entry.templateChecksum !== current) {
      findings.push({
        file: filename,
        message:
          `${filename} is STALE: it was captured from ${template} at checksum ` +
          `${entry.templateChecksum}, but that template is now ${current}. The template was ` +
          'edited and re-approved (PLT-1003 T2) since this screenshot was taken, so the ' +
          'screenshot no longer describes the approved design. Re-capture with ' +
          '`pnpm visual:capture` and review the diff before committing.',
      });
    }
  }

  const requiredNames = new Set(required.keys());
  for (const filename of Object.keys(index)) {
    if (requiredNames.has(filename)) continue;

    findings.push({
      file: filename,
      message:
        `${filename} is in the baseline index but no screen requires it. Delete the file and ` +
        'its index entry in the same change that removed the screen — an orphan baseline ' +
        'claims an approval nothing looks at.',
    });
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/* The diff                                                            */
/* ------------------------------------------------------------------ */

/**
 * Decode an 8-bit non-interlaced PNG into RGBA pixels.
 *
 * Hand-rolled over `node:zlib` rather than adding an image dependency:
 * every other gate in this repository parses its own inputs
 * (`check-route-guards`, `check-templates`, `read-declaration.mjs`), and
 * Playwright screenshots are exactly this shape — 8-bit, colour type 6
 * (RGBA), no interlacing.
 *
 * @param {Buffer} png
 * @returns {{ width: number, height: number, data: Uint8Array }}
 */
export function decodePng(png) {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG (bad signature)');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let interlace = 0;
  /** @type {Buffer[]} */
  const idat = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
      if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
      if (colorType !== 6 && colorType !== 2) {
        throw new Error(`unsupported PNG colour type ${colorType} (expected 2 or 6)`);
      }
      if (interlace !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length; // length + type + data + crc
  }

  if (width === 0 || height === 0) throw new Error('PNG has no IHDR');
  if (idat.length === 0) throw new Error('PNG has no IDAT');

  const channels = colorType === 6 ? 4 : 3;
  const bpp = channels;
  const stride = width * bpp;
  const inflated = inflateSync(Buffer.concat(idat));

  if (inflated.length < height * (1 + stride)) {
    throw new Error('PNG IDAT is shorter than its declared dimensions');
  }

  /** @type {Uint8Array} RGBA, one entry per channel per pixel. */
  const out = new Uint8Array(width * height * 4);
  /** @type {number[]} The previous row's reconstructed bytes, for Up/Paeth. */
  let previous = new Array(stride).fill(0);
  let current = new Array(stride).fill(0);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + stride);
    const filter = inflated[rowStart];
    const row = inflated.subarray(rowStart + 1, rowStart + 1 + stride);

    for (let i = 0; i < stride; i += 1) {
      const raw = row[i];
      const a = i >= bpp ? current[i - bpp] : 0; // left
      const b = previous[i]; // up
      const c = i >= bpp ? previous[i - bpp] : 0; // up-left

      let value;
      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + a;
          break;
        case 2:
          value = raw + b;
          break;
        case 3:
          value = raw + Math.floor((a + b) / 2);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`unsupported PNG row filter ${filter}`);
      }
      current[i] = value & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * bpp;
      const dst = (y * width + x) * 4;
      out[dst] = current[src];
      out[dst + 1] = current[src + 1];
      out[dst + 2] = current[src + 2];
      out[dst + 3] = channels === 4 ? current[src + 3] : 255;
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  return { width, height, data: out };
}

/**
 * Compare two PNGs pixel-by-pixel with a per-pixel tolerance.
 *
 * A pixel "differs" when any channel moves by more than `threshold * 255`
 * — the same family of measure Playwright uses, and deliberately per-pixel
 * rather than per-image: the question is "how much of this screen is no
 * longer the approved design", which a ratio answers and a boolean does not.
 *
 * ## Why the comparison runs over the OVERLAP
 *
 * The baseline is a full-page photograph of the template and the capture
 * is a full-page photograph of the app. Two documents with different
 * content heights are the NORMAL case here — the whole point of the
 * divergence manifest is that the port is not a copy — so refusing to
 * compare anything when the heights differ would make the harness useless
 * on its first real run. The result therefore carries `widthDelta` and
 * `heightDelta` and compares the common region; the compare mode prints
 * the deltas so a layout that grew or shrank is visible rather than
 * silently left uncompared.
 *
 * @param {{ expected: Buffer, actual: Buffer, threshold: number }} pair
 * @returns {{
 *   dimensionsMatch: boolean,
 *   expected: { width: number, height: number },
 *   actual: { width: number, height: number },
 *   comparedWidth: number,
 *   comparedHeight: number,
 *   total: number,
 *   differing: number,
 *   ratio: number,
 *   firstDiff: { x: number, y: number } | null,
 * }}
 */
export function diffPixels({ expected, actual, threshold }) {
  const a = decodePng(expected);
  const b = decodePng(actual);

  const comparedWidth = Math.min(a.width, b.width);
  const comparedHeight = Math.min(a.height, b.height);

  const limit = threshold * 255;
  let differing = 0;
  /** @type {{ x: number, y: number } | null} */
  let firstDiff = null;

  for (let y = 0; y < comparedHeight; y += 1) {
    for (let x = 0; x < comparedWidth; x += 1) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;

      const delta = Math.max(
        Math.abs((a.data[i] ?? 0) - (b.data[j] ?? 0)),
        Math.abs((a.data[i + 1] ?? 0) - (b.data[j + 1] ?? 0)),
        Math.abs((a.data[i + 2] ?? 0) - (b.data[j + 2] ?? 0)),
        Math.abs((a.data[i + 3] ?? 0) - (b.data[j + 3] ?? 0)),
      );
      if (delta <= limit) continue;

      differing += 1;
      if (firstDiff === null) firstDiff = { x, y };
    }
  }

  const total = comparedWidth * comparedHeight;
  return {
    dimensionsMatch: a.width === b.width && a.height === b.height,
    expected: { width: a.width, height: a.height },
    actual: { width: b.width, height: b.height },
    comparedWidth,
    comparedHeight,
    total,
    differing,
    ratio: total === 0 ? 0 : differing / total,
    firstDiff,
  };
}

/* ------------------------------------------------------------------ */
/* Entry point — the check mode                                       */
/* ------------------------------------------------------------------ */

/**
 * The check: manifest reconciles, every baseline exists and is fresh.
 *
 * Browser-free by design, so it runs in the same CI step family as
 * `check:templates` with no Playwright install.
 */
function main() {
  const manifestPath = join(REPO_ROOT, MANIFEST_PATH);
  if (!existsSync(manifestPath)) {
    console.error(
      `visual-regression FAILED — ${MANIFEST_PATH} does not exist. The manifest maps every ` +
        'templated screen to its template view and its app route; see scripts/visual-regression.mjs.',
    );
    process.exit(1);
  }

  const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));

  // The views each template declares, read from the approved documents.
  const templateDirectory = join(REPO_ROOT, 'docs', 'template');
  const views = new Map();
  for (const name of readdirSync(templateDirectory)
    .filter((n) => n.endsWith('.html'))
    .sort()) {
    views.set(name, readTemplateViews(readFileSync(join(templateDirectory, name), 'utf8')));
  }

  // The approved template names, from T2's baseline.
  const checksumBaseline = JSON.parse(
    readFileSync(join(REPO_ROOT, 'template-checksums.json'), 'utf8'),
  );
  const knownTemplates = new Set(Object.keys(checksumBaseline.files));

  const manifestFindings = verifyManifest({ manifest, views, knownTemplates });

  const indexPath = join(REPO_ROOT, BASELINE_INDEX);
  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
  const baselineDirectory = join(REPO_ROOT, BASELINE_DIRECTORY);
  const files = new Set(existsSync(baselineDirectory) ? readdirSync(baselineDirectory) : []);

  const templateOf = Object.fromEntries(manifest.screens.map((s) => [s.id, s.template]));
  const templateChecksums = checksumBaseline.files;

  const baselineFindings = verifyBaselines({
    manifest,
    index,
    files,
    templateChecksums,
    templateOf,
  });

  const findings = [...manifestFindings, ...baselineFindings];

  if (findings.length > 0) {
    console.error(`visual-regression FAILED — ${findings.length} finding(s):\n`);
    for (const finding of findings) {
      console.error(`  - ${finding.message}\n`);
    }
    process.exit(1);
  }

  const expectedCount = manifest.screens.length * REQUIRED_COMBINATIONS.length;
  console.log(
    `visual-regression OK — ${manifest.screens.length} screen(s) × ${manifest.combinations.length} ` +
      `combination(s) = ${expectedCount} baseline(s) present and fresh; every template view is ` +
      'mapped or excluded with a reason',
  );
}

// Only when run directly, so the spec can import the pure functions without
// executing a filesystem check. Same convention as check-templates.mjs.
if (process.argv[1] !== undefined && process.argv[1].endsWith('visual-regression.mjs')) {
  main();
}
