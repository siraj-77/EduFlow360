import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { API_ROOT, REPO_ROOT } from './paths.mjs';

/**
 * `check-route-guards` — the CI check `AGENTS.md` 2.3 requires and that did
 * not exist until now.
 *
 * > "A route with no `@RequirePermission` and no `@Public('<reason>')` is a
 * > defect. A CI static check must fail on any controller route carrying
 * > neither."
 *
 * That sentence was prose for the whole life of this repository. The rule was
 * documented, cited by tests as authority, and mechanically enforced by
 * nothing — which `SSOT.md` itself recorded: "`check-route-guards` does not
 * exist, so `AGENTS.md` 2.3's 'CI must fail on a missing
 * `@RequirePermission`' is prose."
 *
 * This is that check. Plain `.mjs` so `node` runs it with no build step; the
 * types are therefore JSDoc, and `pnpm typecheck` does not cover this file.
 *
 * ## Why it reads source instead of reflecting over the compiled app
 *
 * Because a reflection-based check only sees what has been *registered*, and
 * runs after the process has already booted. A missing decorator would then be
 * a runtime surprise rather than a build failure. Reading the decorator text
 * puts the failure where a developer is still typing.
 *
 * ## What it enforces, in both directions
 *
 * 1. Every controller route carries `@RequirePermission` **or** `@Public`.
 * 2. Every route carrying `@Public` appears in the checked-in allowlist.
 * 3. Every allowlist entry has a non-empty reason.
 *
 * JSDoc types:
 * @typedef {{ file: string, line: number, message: string }} Finding
 * @typedef {{ file: string, reason?: string }} AllowlistEntry
 */

/** @type {string[]} */
const ROUTE_DECORATORS = ['@Get', '@Post', '@Put', '@Patch', '@Delete', '@All', '@Controller'];
const PERMISSION = '@RequirePermission';
const PUBLIC = '@Public(';

/**
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {string[]}
 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

/**
 * Every route declaration lacking a guard.
 * @param {string[]} files
 * @returns {Finding[]}
 */
/**
 * The decorator block attached to the route declared on line `i`.
 *
 * Why this exists: the first version of this checker read ONLY `lines[i - 1]`,
 * so a decorator split across lines —
 *
 *     @Public(
 *       'a reason long enough that Prettier wrapped it',
 *     )
 *     @Get('/thing')
 *
 * — was reported as an unguarded route. That fails CLOSED, so it could not let a
 * defect through, but it teaches the only lesson that matters: if formatting a
 * decorator makes a gate complain, people learn to reformat past the gate. A
 * check that punishes correct formatting stops being read as a real control.
 *
 * So this walks outward from the route decorator, tracking parenthesis depth,
 * and absorbs contiguous decorator lines in BOTH directions — the repo's
 * convention puts `@Public` above `@Get`, but TypeScript permits either, and a
 * checker that only understands one order is a checker that will eventually be
 * wrong.
 *
 * The downward walk is deliberately conservative, because it is the direction
 * that can create a BYPASS: absorbing blindly below would let an unguarded route
 * borrow a guard belonging to the next method. So it absorbs only lines that are
 * themselves decorator-ish — inside unbalanced parens, or opening with `@` — and
 * stops at the first line that is neither. A method signature ends the walk.
 *
 * @param {string[]} lines
 * @param {number} i index of the route decorator line
 * @returns {string}
 */
export function decoratorContext(lines, i) {
  const MAX_LINES = 24;
  const parens = (raw) => {
    let d = 0;
    for (const ch of raw) {
      if (ch === '(') d++;
      else if (ch === ')') d--;
    }
    return d;
  };
  const isBoundary = (t) => t === '' || t.startsWith('*') || t.startsWith('//');

  /** @type {string[]} */
  const above = [];
  let depth = 0;
  for (let j = i - 1; j >= 0 && above.length < MAX_LINES; j--) {
    const raw = lines[j] ?? '';
    const t = raw.trim();
    if (isBoundary(t)) break;
    above.unshift(raw);
    depth += parens(raw);
    // Balanced and beginning with a decorator means we hold a whole decorator.
    if (depth === 0 && t.startsWith('@')) break;
  }

  /** @type {string[]} */
  const below = [];
  depth = parens(lines[i] ?? '');
  for (let k = i + 1; k < lines.length && below.length < MAX_LINES; k++) {
    const raw = lines[k] ?? '';
    const t = raw.trim();
    if (isBoundary(t)) break;
    if (depth === 0 && !t.startsWith('@')) break; // a method signature: stop
    below.push(raw);
    depth += parens(raw);
    if (depth === 0 && !t.startsWith('@')) break;
  }

  return [...above, lines[i] ?? '', ...below].join('\n');
}

export function auditRoutes(files) {
  /** @type {Finding[]} */
  const findings = [];

  for (const file of files) {
    const rel = relative(API_ROOT, file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    for (const [i, line] of lines.entries()) {
      // A comment line mentioning a decorator is documentation, not a route.
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
      if (!ROUTE_DECORATORS.some((d) => line.includes(d))) continue;
      // `@Controller` is a class declaration, not a route handler.
      if (line.includes('@Controller')) continue;

      const window = decoratorContext(lines, i);
      const guarded = window.includes(PERMISSION) || window.includes(PUBLIC);

      if (!guarded) {
        findings.push({
          file: rel,
          line: i + 1,
          message:
            `Route has neither ${PERMISSION} nor ${PUBLIC}...) ` +
            '(AGENTS.md 2.3: a route with no @RequirePermission and no ' +
            "@Public('<reason>') is a defect).",
        });
      }
    }
  }

  return findings;
}

/** Locate every `@Public` usage, for the allowlist reconciliation.
 * @param {string[]} files
 * @returns {{ file: string, line: number }[]}
 */
export function findPublicRoutes(files) {
  /** @type {{ file: string, line: number }[]} */
  const found = [];
  for (const file of files) {
    const rel = relative(API_ROOT, file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    for (const [i, line] of lines.entries()) {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
      if (line.includes(PUBLIC)) found.push({ file: rel, line: i + 1 });
    }
  }
  return found;
}

/**
 * Reconcile the decorator against the checked-in allowlist.
 * @param {{ file: string, line: number }[]} publicRoutes
 * @param {string} allowlistPath
 * @returns {Finding[]}
 */
export function auditAllowlist(publicRoutes, allowlistPath) {
  /** @type {Finding[]} */
  const findings = [];

  /** @type {{ routes?: AllowlistEntry[] }} */
  let allowlist;
  try {
    allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch (cause) {
    return [
      {
        file: relative(API_ROOT, allowlistPath).replace(/\\/g, '/'),
        line: 1,
        message: `allowlist is missing or unparseable: ${cause.message}`,
      },
    ];
  }

  const entries = allowlist.routes ?? [];
  const declared = new Set(entries.map((e) => e.file));

  for (const r of publicRoutes) {
    if (!declared.has(r.file)) {
      findings.push({
        file: r.file,
        line: r.line,
        message:
          'Route carries @Public but is not listed in route-guards.allowlist.json. ' +
          'AGENTS.md 2.3 requires every exemption to be checked in with its justification.',
      });
    }
  }

  for (const e of entries) {
    if (!e.reason || e.reason.trim().length === 0) {
      findings.push({
        file: e.file,
        line: 1,
        message: 'Allowlist entry has no justification.',
      });
    }
  }

  return findings;
}

/** @returns {{ ok: boolean, findings: Finding[], checked: number }} */
export function run() {
  const files = walk(join(API_ROOT, 'src'));
  const findings = [
    ...auditRoutes(files),
    ...auditAllowlist(findPublicRoutes(files), join(REPO_ROOT, 'route-guards.allowlist.json')),
  ];
  return { ok: findings.length === 0, findings, checked: files.length };
}

if (process.argv[1] && process.argv[1].endsWith('check-route-guards.mjs')) {
  const result = run();
  if (result.ok) {
    console.log(`check-route-guards OK — ${result.checked} source files, every route guarded.`);
    process.exit(0);
  }
  console.error(`\ncheck-route-guards FAILED — ${result.findings.length} finding(s):\n`);
  for (const f of result.findings) console.error(`  ${f.file}:${f.line}  ${f.message}`);
  console.error('');
  process.exit(1);
}
