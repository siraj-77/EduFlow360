import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `@playwright/test`, not `playwright`: the former is this package's direct
// dependency (playwright.config.ts imports it too) and the latter is only a
// transitive one, which pnpm's node_modules layout does not expose.
import { chromium } from '@playwright/test';

import { REPO_ROOT } from '../../../scripts/paths.mjs';
import {
  BASELINE_DIRECTORY,
  MANIFEST_PATH,
  baselineFilename,
  parseManifest,
  verifyTemplateChecksums,
} from '../../../scripts/visual-regression.mjs';

/**
 * `visual-capture` — the browser half of the `PLT-1003` T4 harness.
 *
 * `scripts/visual-regression.mjs` owns the DECISIONS (which views must be
 * baselined, whether a baseline is fresh, whether a capture still matches).
 * This file owns the only part that needs a browser: opening the template
 * document, putting it into a declared theme and direction, and pressing
 * the shutter. It lives under `apps/web/scripts/` rather than `scripts/`
 * because `playwright` resolves from here and nowhere else in the
 * repository.
 *
 * ## Three sides, three purposes
 *
 * - `--side template` — photograph every templated screen from the APPROVED
 *   HTML itself, in all four combinations, into `tests/visual/baselines/`,
 *   and write `index.json` recording the checksum each screenshot was taken
 *   from. This is the deliverable the AC names.
 * - `--side app` — photograph the app's own screens (only those the
 *   manifest marks `parity=measured`) into `tests/visual/actual/`.
 * - `--side compare` — diff the app photographs against the baselines and
 *   report the measured ratio against each screen's recorded tolerance.
 *
 * ## Why capture refuses a dirty tree
 *
 * A screenshot of a template mid-edit blesses the edit as the design. So
 * `--side template` runs `PLT-1003` T2's `verifyTemplates` first — the same
 * function, the same arguments — and refuses while any finding stands. The
 * honest path is the easy one: the failure prints the WORKLOG authorisation
 * line to add.
 *
 * ## Determinism, because a diff is worthless without it
 *
 * - **Theme** comes from the browser's `prefers-color-scheme`, exactly as
 *   the app's own theme script reads it — the same mechanism on both sides
 *   of every later comparison, so the two photographs are comparable.
 * - **RTL** is set the way the app sets it: `dir` and `lang` on `<html>`,
 *   plus the template's own `setLang` for translated copy.
 * - **Animations are disabled.** The templates carry infinite CSS
 *   animations (hero mesh, drifting orbs, marquee, pulsing badge); without
 *   this the same screenshot differs run to run.
 * - **A fresh context per photograph**, so no localStorage or focus state
 *   crosses combinations.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** `apps/web`, resolved from this file rather than `process.cwd()`. */
const WEB_ROOT = join(HERE, '..');

/** The manifest and its baseline directory, both repository-relative. */
const MANIFEST = join(REPO_ROOT, MANIFEST_PATH);
const TEMPLATE_DIRECTORY = join(REPO_ROOT, 'docs', 'template');
const BASELINE_DIR = join(REPO_ROOT, BASELINE_DIRECTORY);
const ACTUAL_DIR = join(REPO_ROOT, 'apps', 'web', 'tests', 'visual', 'actual');
const INDEX_PATH = join(BASELINE_DIR, 'index.json');

/**
 * `WEB_PORT`, read from the one place it is defined.
 *
 * Parsing the constant rather than repeating it is deliberate: the port's
 * whole history (`src/lib/web-port.ts`) is a silently-duplicated number
 * answering a readiness probe. A regex over the declaration keeps one
 * source of truth, and a miss throws rather than defaulting — 3000 is the
 * exact value that produced the 2026-09-29 incident.
 *
 * @returns {string}
 */
function webPort() {
  const source = readFileSync(join(WEB_ROOT, 'src', 'lib', 'web-port.ts'), 'utf8');
  const match = /WEB_PORT\s*=\s*(\d+)/.exec(source);
  if (match === null) {
    throw new Error('could not read WEB_PORT from src/lib/web-port.ts');
  }
  return match[1];
}

/**
 * `sha256(bytes)`, the shape `template-checksums.json` records, so a
 * baseline's index entry is directly comparable with the approved
 * checksum.
 *
 * @param {Buffer | string} content
 * @returns {string}
 */
function checksumOf(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * The arguments this script accepts, so a mis-typed run fails loudly
 * instead of capturing the wrong side.
 *
 * @returns {{ side: 'template' | 'app' | 'compare', only: string | null }}
 */
function parseArgs() {
  const argv = process.argv.slice(2);
  let side = 'template';
  let only = null;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--side') {
      const value = argv[i + 1];
      if (value !== 'template' && value !== 'app' && value !== 'compare') {
        throw new Error(`--side must be template, app or compare (got "${String(value)}")`);
      }
      side = value;
      i += 1;
    } else if (argv[i] === '--only') {
      only = argv[i + 1] ?? null;
      i += 1;
    } else {
      throw new Error(
        `unknown argument "${argv[i]}" — usage: --side template|app|compare [--only <screenId>]`,
      );
    }
  }

  return { side, only };
}

/** Put one template document into a declared direction and language, and
 * activate its view. App screens set their own `dir`/`lang` through the
 * locale route, so this deliberately runs only for the template side. */
async function activateView(page, { combination, view }) {
  await page.evaluate(
    ({ dir, locale, viewId }) => {
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', locale);

      const setLang = /** @type {undefined | ((code: string) => void)} */ (
        /** @type {*} */ (window).setLang
      );
      if (locale !== 'en' && typeof setLang === 'function') {
        setLang(locale);
      }

      if (viewId !== null) {
        document.querySelectorAll('.view').forEach((element) => element.classList.remove('active'));
        document.getElementById(viewId)?.classList.add('active');
        window.scrollTo(0, 0);
      }
    },
    { dir: combination.dir, locale: combination.locale, viewId: view },
  );
}

/**
 * Put the template document itself under the browser.
 *
 * The template is fulfilled from disk rather than loaded over `file://`:
 * `file://` gives every document an opaque origin with surprising
 * localStorage behaviour, and the templates write localStorage (the saved
 * language). A fulfilled route costs six lines and makes the document
 * behave exactly as it does in a real browser tab.
 *
 * @param {import('playwright').Page} page
 * @param {string} templateName
 */
async function serveTemplate(page, templateName) {
  const html = readFileSync(join(TEMPLATE_DIRECTORY, templateName));
  await page.route('**/*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
  );
  await page.goto('http://visual-baseline.local/', { waitUntil: 'load' });
}

/** `--side template`: the AC's deliverable. */
async function captureTemplate(manifest, only) {
  const checksumBaseline = JSON.parse(
    readFileSync(join(REPO_ROOT, 'template-checksums.json'), 'utf8'),
  );
  const files = readdirSync(TEMPLATE_DIRECTORY)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => ({ name, checksum: checksumOf(readFileSync(join(TEMPLATE_DIRECTORY, name))) }));

  // THE COMPOSITION: refuse an unapproved tree before the first shutter
  // click, using T2's own decision over T2's own inputs.
  const { parseAuthorisations } = await import('../../../scripts/check-templates.mjs');
  const worklog = readFileSync(join(REPO_ROOT, 'docs', 'work', 'WORKLOG.md'), 'utf8');
  const findings = verifyTemplateChecksums({
    files,
    baseline: checksumBaseline.files,
    authorisations: parseAuthorisations(worklog),
  });
  if (findings.length > 0) {
    console.error('visual-capture REFUSED — the approved templates do not match their baseline:\n');
    for (const finding of findings) {
      console.error(`  - ${finding.message}\n`);
    }
    console.error(
      'A screenshot of an unapproved template would bless the edit as the design. ' +
        'Apply the authorisation above, then re-run.',
    );
    process.exit(1);
  }

  const screens = only === null ? manifest.screens : manifest.screens.filter((s) => s.id === only);
  if (screens.length === 0) {
    throw new Error(`no screen with id "${String(only)}" in the manifest`);
  }

  mkdirSync(BASELINE_DIR, { recursive: true });

  const browser = await chromium.launch();
  /** @type {Record<string, { screen: string, theme: string, dir: string, templateChecksum: string }>} */
  const index = existsSync(INDEX_PATH) ? JSON.parse(readFileSync(INDEX_PATH, 'utf8')) : {};

  try {
    for (const screen of screens) {
      const html = readFileSync(join(TEMPLATE_DIRECTORY, screen.template));
      const templateChecksum = checksumOf(html);

      for (const combination of manifest.combinations) {
        // A fresh context per photograph: no localStorage, focus or scroll
        // state crosses combinations.
        const context = await browser.newContext({
          viewport: manifest.viewport,
          colorScheme: combination.theme,
        });
        const page = await context.newPage();

        await serveTemplate(page, screen.template);
        await activateView(page, { combination, view: screen.view });

        const filename = baselineFilename(screen.id, combination);
        const path = join(BASELINE_DIR, filename);
        await page.screenshot({ path, fullPage: true, animations: 'disabled' });

        index[filename] = {
          screen: screen.id,
          theme: combination.theme,
          dir: combination.dir,
          templateChecksum,
        };

        console.log(
          `captured ${filename} from ${screen.template}${screen.view === null ? '' : `#${screen.view}`} ` +
            `(${combination.theme}/${combination.dir})`,
        );
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
  console.log(
    `\n${screens.length} screen(s) × ${manifest.combinations.length} combination(s) captured; ` +
      'the baseline index now records the checksum each photograph was taken from.',
  );
}

/** `--side app`: photograph the app's own screens, measured parity only. */
async function captureApp(manifest, only) {
  const port = webPort();
  const baseURL = `http://localhost:${port}`;

  const screens = manifest.screens.filter((screen) => screen.parity.status === 'measured');
  const selected = only === null ? screens : screens.filter((s) => s.id === only);
  if (selected.length === 0) {
    console.error(
      `visual-capture: no screen with id "${String(only)}" has parity=measured, so there is ` +
        'nothing to photograph on the app side. Deferred screens are photographed by the ' +
        'story named in the manifest.',
    );
    process.exit(1);
  }

  mkdirSync(ACTUAL_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const screen of selected) {
      for (const combination of manifest.combinations) {
        const context = await browser.newContext({
          viewport: manifest.viewport,
          colorScheme: combination.theme,
        });
        const page = await context.newPage();

        const url = `${baseURL}${screen.route.replace('{locale}', combination.locale)}`;
        // A generous timeout because `next dev` compiles the route on first
        // request: a cold `/ar` routinely exceeds Playwright's 30s default,
        // the same budget lesson `playwright.config.ts` records.
        const response = await page
          .goto(url, { waitUntil: 'load', timeout: 120_000 })
          .catch((error) => {
            console.error(
              `visual-capture: could not reach ${url} — is the web dev server running? ` +
                'Start it with `pnpm dev:web` — the capture must not silently test whatever ' +
                'else is listening (the lesson of the 2026-09-29 port incident).',
            );
            throw error;
          });

        // The app sets its own `dir` and `lang` through the locale route, so
        // the template-side activation deliberately does not run here.

        const filename = baselineFilename(screen.id, combination);
        await page.screenshot({
          path: join(ACTUAL_DIR, filename),
          fullPage: true,
          animations: 'disabled',
        });
        console.log(
          `photographed ${filename} from ${url} (HTTP ${response?.status() ?? '?'}, ` +
            `${combination.theme}/${combination.dir})`,
        );
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

/** `--side compare`: the app photographs against the baselines. */
async function compare(manifest) {
  const { diffPixels } = await import('../../../scripts/visual-regression.mjs');

  const measured = manifest.screens.filter((screen) => screen.parity.status === 'measured');
  if (measured.length === 0) {
    console.log('visual-compare: no screen has parity=measured; nothing to compare yet.');
    return;
  }

  /** @type {{ file: string, message: string }[]} */
  const findings = [];
  const rows = [];

  for (const screen of measured) {
    for (const combination of manifest.combinations) {
      const filename = baselineFilename(screen.id, combination);
      const baselinePath = join(BASELINE_DIR, filename);
      const actualPath = join(ACTUAL_DIR, filename);

      if (!existsSync(baselinePath) || !existsSync(actualPath)) {
        findings.push({
          file: filename,
          message:
            `${filename} is missing (baseline ${existsSync(baselinePath) ? 'present' : 'absent'}, ` +
            `actual ${existsSync(actualPath) ? 'present' : 'absent'}); capture both sides first.`,
        });
        continue;
      }

      const result = diffPixels({
        expected: readFileSync(baselinePath),
        actual: readFileSync(actualPath),
        threshold: 0.1,
      });

      if (!result.dimensionsMatch) {
        // Not a finding: two full-page photographs of different documents
        // have different heights, and that is the normal case. The row above
        // reports both sizes so the difference is visible; the RATIO is what
        // the tolerance judges.
        rows.push(
          `  note: ${filename} sizes differ (baseline ${result.expected.width}×${result.expected.height}, ` +
            `app ${result.actual.width}×${result.actual.height}) — the overlap was compared.`,
        );
      }

      const ratio = result.ratio ?? 0;
      const tolerance = /** @type {{ maxDiffPixelRatio: number }} */ (screen.parity)
        .maxDiffPixelRatio;
      const size = result.dimensionsMatch
        ? ''
        : ` [size: baseline ${result.expected.width}×${result.expected.height}, ` +
          `app ${result.actual.width}×${result.actual.height}, comparing ${result.comparedWidth}×${result.comparedHeight}]`;
      rows.push(
        `${filename}: ${(ratio * 100).toFixed(2)}% differing pixels ` +
          `(tolerance ${(tolerance * 100).toFixed(2)}%)${size}`,
      );

      if (ratio > tolerance) {
        findings.push({
          file: filename,
          message:
            `${filename} has drifted: ${(ratio * 100).toFixed(2)}% of pixels differ from the ` +
            `approved template, past the ${(tolerance * 100).toFixed(2)}% tolerance recorded in ` +
            `visual-regression.json. First difference at ` +
            `${result.firstDiff === null ? 'n/a' : `(${result.firstDiff.x}, ${result.firstDiff.y})`}.`,
        });
      }
    }
  }

  for (const row of rows) console.log(row);

  if (findings.length > 0) {
    console.error(`\nvisual-compare FAILED — ${findings.length} finding(s):`);
    for (const finding of findings) console.error(`  - ${finding.message}`);
    process.exit(1);
  }

  console.log('\nvisual-compare OK — every measured screen is inside its recorded tolerance.');
}

/** Entry point. */
async function main() {
  const { side, only } = parseArgs();
  const manifest = parseManifest(JSON.parse(readFileSync(MANIFEST, 'utf8')));

  if (side === 'template') await captureTemplate(manifest, only);
  if (side === 'app') await captureApp(manifest, only);
  if (side === 'compare') await compare(manifest);
}

main().catch((error) => {
  console.error(/** @type {Error} */ (error).message);
  process.exit(1);
});
