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
 * @typedef {{ file: string, line: number, method: string, path: string, route: string,
 *             permission: string | null, publicRoute: boolean, window: string }} CollectedRoute
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
 * Why this exists: the first version of this checker read ONLY `lines[i - 1]`, so a
 * decorator split across lines —
 *
 *     @Public(
 *       'a reason long enough that Prettier wrapped it',
 *     )
 *     @Get('/thing')
 *
 * — was reported as an unguarded route. That fails CLOSED, so it could not let a
 * defect through, but it teaches the only lesson that matters: if formatting a
 * decorator makes a gate complain, people learn to reformat past the gate. A check
 * that punishes correct formatting stops being read as a real control.
 *
 * So this walks outward from the route decorator, tracking parenthesis depth, and
 * absorbs contiguous decorator lines in BOTH directions — the repo's convention puts
 * `@Public` above `@Get`, but TypeScript permits either, and a checker that only
 * understands one order is a checker that will eventually be wrong.
 *
 * Both walks are deliberately conservative, because they are the direction that can
 * create a BYPASS: absorbing blindly would let an unguarded route borrow a guard
 * belonging to the next method. So each absorbs only lines that are themselves
 * decorator-ish — inside unbalanced parens, or opening with `@` — and stops at the
 * first line that is neither. A method signature ends the walk.
 *
 * Both walks absorb a WHOLE stack, not one line. See the second version of the upward
 * walk below for why that turned out to matter: `AGENTS.md` 2.3 requires `@Audited`
 * on sensitive routes, so a guarded route here routinely carries three decorators, and
 * a walk that stopped after the first reported the guard as absent.
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

  /**
   * The upward walk, second version.
   *
   * The first version broke as soon as it had read ONE balanced line beginning with
   * `@` — on the rule "that line is a whole decorator, so stop". True of the line it
   * had just read, and wrong as a stopping condition: `AGENTS.md` 2.3 requires
   * `@Audited` on every sensitive route, so the required shape of a guarded route is
   *
   *     @Public('<reason>')
   *     @Audited('<ACTION>')
   *     @Post('thing')
   *
   * and the checker reported a guard two lines up as absent. `PLT-107`'s two routes
   * are the first in this repository to stack decorators, and `pnpm check:route-guards`
   * failed on both.
   *
   * It failed CLOSED, which is why the fix belongs here rather than in the routes.
   * Both workarounds were worse: reordering so `@Public` sits immediately above the
   * route decorator satisfies a checker whose bug is that it reads one line, and the
   * next person to add `@HttpCode` above `@Post` reintroduces it silently; and
   * dropping `@Audited` contradicts `AGENTS.md` 2.3.
   *
   * So this now mirrors the downward walk exactly: absorb contiguous decorator-ish
   * lines — inside unbalanced parens, or opening with `@` — and stop at the first line
   * that is neither. A method signature ends the walk, so a route still cannot borrow
   * the next route's guard, which is the property the "one route borrows the next"
   * case in `route-guards.spec.ts` exists to protect.
   */
  const above = [];
  let depth = 0;
  for (let j = i - 1; j >= 0 && above.length < MAX_LINES; j--) {
    const raw = lines[j] ?? '';
    const t = raw.trim();
    if (isBoundary(t)) break;
    // Balanced and not a decorator: an ordinary statement. Stop rather than absorb it,
    // or a field declaration above a route would be read as part of its guard block.
    if (depth === 0 && !t.startsWith('@')) break;
    above.unshift(raw);
    depth += parens(raw);
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

/**
 * The route inventory: every declared route, with the path a browser would call.
 *
 * ## Why this exists separately from `auditRoutes`
 *
 * `auditRoutes` answers "is this route guarded?". The permission matrix needs a
 * different question — "what routes exist?" — and a guard check cannot answer it,
 * because a guarded route and an unguarded one are equally present in the tree.
 *
 * So this composes the two primitives that already exist rather than adding a third
 * way of finding a route: `decoratorContext` for "which decorators belong to this
 * route", and the same comment-line exclusion `auditRoutes` applies, so a route
 * mentioned in a doc comment is not a route.
 *
 * ## The path is composed from the CONTROLLER prefix and the METHOD argument
 *
 * `@Controller('auth')` + `@Get('oidc/link')` is `GET /auth/oidc/link`. That is the
 * string a matrix row is keyed on, because it is the only identifier of a route that
 * survives a refactor of the file it lives in — a line number does not, and a method
 * name alone collides across controllers.
 *
 * ## It FAILS CLOSED on a route it cannot parse
 *
 * A decorator written in a shape this parser does not recognise is still a route, and
 * a matrix keyed on parseable routes alone would quietly omit it — which is the exact
 * "a check that silently matches nothing" failure `route-guards.spec.ts` exists to
 * rule out. So an unparseable route decorator yields `path: null`, and the matrix test
 * refuses to pass while any route is unparsed. A parser that cannot read the tree is a
 * gate that has stopped gating.
 *
 * @param {string[]} files
 * @returns {CollectedRoute[]}
 */
export function collectRoutes(files) {
  /** @type {CollectedRoute[]} */
  const collected = [];

  for (const file of files) {
    const rel = relative(API_ROOT, file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    const controllerPrefix = readControllerPrefix(lines);
    const methodPattern = /@(Get|Post|Put|Patch|Delete|All)\b/;

    for (const [i, line] of lines.entries()) {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;

      const match = methodPattern.exec(line);
      if (!match) continue;

      const method = match[1].toUpperCase();
      const argument = readStringArgument(line);
      const window = decoratorContext(lines, i);

      collected.push({
        file: rel,
        line: i + 1,
        method,
        // `null` rather than a guess when the argument cannot be read.
        path: argument === null ? null : composePath(controllerPrefix, argument),
        route:
          argument === null
            ? `${method} <unparsed>`
            : `${method} ${composePath(controllerPrefix, argument)}`,
        permission: readPermissionKey(window),
        publicRoute: window.includes(PUBLIC),
        window,
      });
    }
  }

  return collected;
}

/**
 * The `@Controller('prefix')` path in a file, or `''` for `@Controller()`.
 *
 * The FIRST controller in the file is used. A file with two controller classes is not
 * a shape this repository uses — one class per file, `AGENTS.md` 3 — so the second
 * would be a parser limitation rather than a route this misses silently: it is the
 * same string for every route in the file, and the matrix test still requires a row
 * per route, which is the property that matters.
 *
 * @param {string[]} lines
 * @returns {string}
 */
function readControllerPrefix(lines) {
  for (const line of lines) {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
    if (!line.includes('@Controller')) continue;

    const argument = readStringArgument(line);
    return argument ?? '';
  }
  return '';
}

/**
 * The first single- or double-quoted string in a decorator line, or `null`.
 *
 * `null` means "could not read it", which the caller turns into an unparsed route
 * rather than an empty path — an empty path would look like a valid root route and
 * would quietly reconcile against a matrix row.
 *
 * @param {string} line
 * @returns {string | null}
 */
function readStringArgument(line) {
  const match = /(['"])((?:[^'"\\]|\\.)*)\1/.exec(line);
  return match ? match[2] : null;
}

/**
 * Join a controller prefix and a method path into one leading-slash path.
 *
 * Empty segments are dropped rather than producing `//`, which is what a bare
 * `@Get()` or a bare `@Controller()` produces.
 *
 * @param {string} prefix
 * @param {string} path
 * @returns {string}
 */
export function composePath(prefix, path) {
  const segments = [prefix, path]
    .flatMap((part) => part.split('/'))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return `/${segments.join('/')}`;
}

/**
 * The `@RequirePermission('<KEY>')` key in a decorator window, or `null`.
 *
 * Read from the WINDOW rather than the file, so a key belonging to one route is never
 * attributed to another. That is the property `decoratorContext`'s own header is about,
 * and it is the difference between a matrix that reconciles and one that agrees with
 * itself by accident.
 *
 * @param {string} window
 * @returns {string | null}
 */
export function readPermissionKey(window) {
  const match = /@RequirePermission\(\s*(['"])((?:[^'"\\]|\\.)*)\1\s*\)/.exec(window);
  return match ? match[2] : null;
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
