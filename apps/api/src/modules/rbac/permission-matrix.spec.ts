import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRoutes } from '../../../../../scripts/check-route-guards.mjs';
import { API_ROOT, REPO_ROOT } from '../../../../../scripts/paths.mjs';

/**
 * The permission matrix, reconciled against the source tree.
 *
 * ## Why this file exists
 *
 * `AGENTS.md` 9 says two things that were prose until now:
 *
 * > "Every new sensitive route adds a row to the RBAC permission-matrix fixture."
 * > "Do not merge a route without updating it — this is `PLT-205`'s living matrix."
 *
 * `PLT-205` asks for a matrix of Role x Module x Action x expected outcome. That is a
 * story about *seed data* — which role holds which key — and it cannot be written
 * until the catalogue exists. This file is the half that CAN be written now: a row per
 * ROUTE, saying which permission gates it, what is audited on it and which licence
 * feature it needs.
 *
 * The important property is not the contents, it is the **reconciliation**. A checked-in
 * fixture nobody compares against the source is a historical document, which is the
 * failure mode `route-guards.allowlist.json` states and `check-route-guards.mjs` already
 * guards against in both directions. So every assertion below is bidirectional: a route
 * with no row fails, AND a row whose route no longer exists fails.
 *
 * ## What it deliberately does NOT claim
 *
 * The `entitlement` and `audited` columns record what a route's decorators SAY. Neither
 * is enforced by anything in this repository: `@RequireEntitlement` is Epic 03 and
 * `@Audited` writes nothing until `PLT-402`. The fixture says so in its own header, and
 * this spec asserts the source agrees — so nobody later reads a populated `audited`
 * column as evidence that a record is being kept.
 */

/** One row of the checked-in fixture. */
interface MatrixRow {
  readonly file: string;
  readonly route: string;
  readonly permission: string | null;
  readonly entitlement: string | null;
  readonly audited: string | null;
  readonly owner: string;
  readonly notes: string;
}

interface Matrix {
  readonly routes: readonly MatrixRow[];
}

const loadMatrix = (): Matrix =>
  JSON.parse(readFileSync(join(REPO_ROOT, 'route-permissions.json'), 'utf8')) as Matrix;

/**
 * Every non-spec TypeScript file under `apps/api/src`.
 *
 * The same walk `check-route-guards.mjs` performs, inlined rather than imported
 * because that script does not export it. Globs are written as path joins rather than
 * patterns so this file cannot be broken by a pattern.
 */
function apiSourceFiles(dir: string = join(API_ROOT, 'src'), out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) apiSourceFiles(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const routes = (): ReturnType<typeof collectRoutes> => collectRoutes(apiSourceFiles());
const rows = (): readonly MatrixRow[] => loadMatrix().routes;

/** The identity of a route in both the fixture and the inventory. */
const identity = (file: string, route: string): string => `${file} :: ${route}`;

// ═══════════════════════════════════════════════════════════════════════════
// The fixture is readable and shaped as declared.
// ═══════════════════════════════════════════════════════════════════════════
describe('route-permissions.json', () => {
  it('parses, and is not empty', () => {
    expect(Array.isArray(rows())).toBe(true);
    expect(rows().length).toBeGreaterThan(0);
  });

  it('states in its own header that entitlement and audit enforce nothing', () => {
    // The load-bearing honesty check. A fixture whose header claimed these were
    // enforced would be a lie in a file people cite, and `AGENTS.md` 6's failure mode
    // in its most quotable form.
    const raw = readFileSync(join(REPO_ROOT, 'route-permissions.json'), 'utf8');

    expect(raw).toMatch(/PLT-402/);
    expect(raw).toMatch(/Epic 03/);
    expect(raw).toMatch(/NOTHING/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Reconciliation, both directions.
// ═══════════════════════════════════════════════════════════════════════════
describe('every route in the tree has a matrix row', () => {
  it('finds no route missing from the fixture', () => {
    // The property AGENTS.md 9 asks for. Keyed on METHOD plus path so the row survives
    // a file rename, and on the file as well so two controllers cannot both claim
    // `GET /` .
    const declared = new Set(rows().map((row) => identity(row.file, row.route)));
    const missing = routes()
      .filter((route) => !declared.has(identity(route.file, route.route)))
      .map((route) => `${route.file}:${route.line} ${route.route}`);

    expect(missing).toEqual([]);
  });

  it('finds no row whose route no longer exists', () => {
    // The other direction, and the one that decays quietly. A deleted controller
    // leaves a row behind, the row keeps citing a file that is not scanned, and the
    // fixture becomes a list of intentions rather than a description of the product.
    const present = new Set(routes().map((route) => identity(route.file, route.route)));
    const orphans = rows()
      .filter((row) => !present.has(identity(row.file, row.route)))
      .map((row) => identity(row.file, row.route));

    expect(orphans).toEqual([]);
  });

  it('parsed every route, rather than quietly skipping the ones it cannot read', () => {
    // A checker that silently matches nothing is worse than no checker, because it is
    // indistinguishable from a passing one. `collectRoutes` reports an unreadable
    // decorator as `<unparsed>`, and this is what turns that into a failure.
    const unparsed = routes()
      .filter((route) => route.route.endsWith('<unparsed>'))
      .map((route) => `${route.file}:${route.line}`);

    expect(unparsed).toEqual([]);
  });

  it('has exactly one row per route, so a duplicate cannot shadow a real one', () => {
    const identities = rows().map((row) => identity(row.file, row.route));

    expect(new Set(identities).size).toBe(identities.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The fixture agrees with the decorators, not merely with itself.
// ═══════════════════════════════════════════════════════════════════════════
describe('each row agrees with the route it describes', () => {
  const rowFor = (file: string, route: string): MatrixRow | undefined =>
    rows().find((row) => identity(row.file, row.route) === identity(file, route));

  it('declares the permission the route-s decorator actually declares', () => {
    // The reconciliation that has teeth. A row claiming a permission the route does not
    // gate is worse than no row: it is a document that says the route is protected
    // while the decorator reads as though it were not.
    const disagreements = routes()
      .map((route) => ({
        where: `${route.file}:${route.line} ${route.route}`,
        declared: route.permission,
        recorded: rowFor(route.file, route.route)?.permission ?? null,
      }))
      .filter(({ declared, recorded }) => declared !== recorded);

    expect(disagreements).toEqual([]);
  });

  it('declares a permission for a route that carries @Public', () => {
    // A `@Public` route with a recorded permission is a contradiction in the fixture, and
    // it is the shape a copy-paste takes. The guard honours `@Public`, so the recorded
    // permission would be silently inert.
    const contradictions = rows()
      .filter((row) => {
        const route = routes().find(
          (candidate) =>
            identity(candidate.file, candidate.route) === identity(row.file, row.route),
        );
        return route?.publicRoute === true && row.permission !== null;
      })
      .map((row) => identity(row.file, row.route));

    expect(contradictions).toEqual([]);
  });

  it('records a permission for every route that is NOT @Public', () => {
    // The converse, and it is the one that matters. `AGENTS.md` 2.3: a route with
    // neither `@RequirePermission` nor `@Public` is a defect, and `check-route-guards`
    // fails the build on it — but only for files it can scan, and only for a decorator
    // in a shape it recognises. Asserted from the fixture side as well so a route that
    // slipped past the static check is still visible here.
    const missing = routes()
      .filter((route) => !route.publicRoute)
      .filter((route) => rowFor(route.file, route.route)?.permission == null)
      .map((route) => identity(route.file, route.route));

    expect(missing).toEqual([]);
  });

  it('records every permission key in MODULE_ACTION shape, which is what the schema holds', () => {
    // `Permission.key` is a `MODULE_ACTION` string written by a deploy-time sync
    // (`ADR-012`). A key in any other shape could never match a row, so the route would
    // be unreachable for everyone — permanently, and invisibly, because an unmatchable
    // key and a denied permission produce the same 403.
    const malformed = rows()
      .filter((row) => row.permission !== null)
      .filter((row) => !/^[A-Z]+(_[A-Z0-9]+)+$/.test(row.permission as string))
      .map((row) => identity(row.file, row.route));

    expect(malformed).toEqual([]);
  });

  it('gives every row a non-empty justification, so a row is never bare', () => {
    // The same rule `route-guards.allowlist.json` holds its reasons to. A row with no
    // `notes` says which permission and nothing about why, which is not reviewable.
    const bare = rows()
      .filter((row) => typeof row.notes !== 'string' || row.notes.trim().length === 0)
      .map((row) => identity(row.file, row.route));

    expect(bare).toEqual([]);
  });

  it('points every @Public row at the allowlist that justifies it', () => {
    // Two fixtures describing the same exemptions is two documents that can disagree.
    // The justification for an exemption lives in ONE place, and the matrix points at it.
    const allowlist = JSON.parse(
      readFileSync(join(REPO_ROOT, 'route-guards.allowlist.json'), 'utf8'),
    ) as { routes?: Array<{ file: string }> };
    const justified = new Set((allowlist.routes ?? []).map((entry) => entry.file));

    const unjustified = rows()
      .filter((row) => {
        const route = routes().find(
          (candidate) =>
            identity(candidate.file, candidate.route) === identity(row.file, row.route),
        );
        return route?.publicRoute === true && !justified.has(row.file);
      })
      .map((row) => identity(row.file, row.route));

    expect(unjustified).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The claim this fixture is most likely to be misread for.
// ═══════════════════════════════════════════════════════════════════════════
describe('the columns that record intent rather than enforcement', () => {
  it('says out loud WHO writes a populated `audited` column', () => {
    // A fixture column headed `audited` is exactly the kind of artefact a
    // reviewer reads as "so this IS audited" — so the header names the
    // mechanism, and the spec fails if that sentence is ever removed while
    // the column remains.
    //
    // It used to assert `/@Audited writes no row/` and `/PLT-402 is the story
    // that will write/`, which was the honest statement until 2026-10-11.
    // `PLT-402` shipped then, and the fixture's own header moved on; this
    // test asserts the NEW truth — that the interceptor is what writes, and
    // that `PLT-402` is still named, so the sentence cannot be dropped without
    // a review of whether it is still true.
    const raw = readFileSync(join(REPO_ROOT, 'route-permissions.json'), 'utf8');
    const auditedColumnPopulated = rows().some((row) => row.audited !== null);

    expect(auditedColumnPopulated).toBe(true);
    expect(raw).toMatch(/AuditInterceptor \(PLT-402\)/);
    expect(raw).toMatch(/audit_enforced_by/);
  });

  it('records no entitlement for any sign-in route, and explains why', () => {
    // A Basic-edition school must be able to sign in. An entitlement on `POST /auth/login`
    // would lock a Basic school out of the product entirely — the failure mode the
    // allowlist entry for that route already names.
    const signIn = rows().filter((row) => row.route === 'POST /auth/login');

    expect(signIn).toHaveLength(1);
    expect(signIn[0]?.entitlement).toBeNull();
    expect(signIn[0]?.notes).toMatch(/sign in/i);
  });
});
