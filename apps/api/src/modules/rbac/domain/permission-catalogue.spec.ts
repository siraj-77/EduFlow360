import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOGUE,
  PERMISSION_KEYS,
  type PermissionDefinition,
} from './permission-catalogue.js';

/**
 * The permission catalogue — `ADR-012`, `PLT-201`.
 *
 * ## The defect this file exists to make impossible
 *
 * `GET /auth/oidc/link` was the only permission-gated route in the repository, and its key
 * `AUTH_LINK_EXTERNAL_IDENTITY` was **not** among the eight keys the seed created. So the
 * one route the RBAC engine actually gated returned **403 for the bootstrap administrator** —
 * correct fail-closed behaviour, on a route nobody could use.
 *
 * Nothing caught it, because the permission key lived in **two unrelated places**: a
 * `@RequirePermission('X')` string in a controller, and a hand-written array in
 * `prisma/seed.mjs`. Nothing reconciled them. Both tests below are the reconciliation, and
 * both directions are needed:
 *
 * - **route → catalogue.** A gated route whose key is not in the catalogue is the bug above.
 * - **catalogue → usage.** A catalogue key nothing references is dead weight that will be
 *   granted to a role and quietly do nothing.
 *
 * One direction would have caught today's bug. The other catches the mistake that replaces
 * it.
 *
 * ## Why the catalogue lists only keys in USE today
 *
 * `PLT-201` Task 2 names `ATTENDANCE_MARK` and `FINANCE_INVOICE_REVERSE` as examples, and
 * `PLT-203` names `GRADE_ENTER`. **None is listed here**, because no route gates on any of
 * them: there is no attendance, finance or grading module, and `AGENTS.md` §6 forbids
 * inventing the absence of one.
 *
 * A catalogue is not a wish list. Each entry is seeded into `permissions`, granted to a role,
 * and checked by the usage test — so a speculative entry would be a grant that appears to
 * work and does not. They are added when their module lands, which is what `PLT-201`'s
 * "living document" acceptance criterion means in practice.
 */

/**
 * Source roots scanned for `@RequirePermission`.
 *
 * **`controllers/` only, specs excluded** — and both restrictions are load-bearing.
 *
 * The concern is *"a gated ROUTE whose key is not seeded"*, and routes live in controllers.
 * Scanning everything wider produced two kinds of false positive on the first run:
 *
 * - **spec fixtures.** `permission-ownership-over-http.spec.ts` declares controllers gated on
 *   `GRADE_ENTER`, `STUDENT_READ` and `STOCK_READ`; `permission-cache-over-http.spec.ts` uses
 *   `FINANCE_INVOICE_REVERSE`. Those are test doubles for keys whose modules do not exist, and
 *   requiring them in the catalogue would mean **adding catalogue entries for modules that do
 *   not exist** — `AGENTS.md` §6's named failure. They are out of scope by construction.
 * - **documentation.** `route-guards.decorator.ts:6` carries `<PERMISSION_KEY>` in a JSDoc
 *   table and `decide-ownership.ts:17` names `GRADE_ENTER` while explaining the rule. Comments
 *   are skipped the same way `check-route-guards.mjs` skips them: a line that trims to a
 *   leading `*` or `//` is prose, not a route.
 *
 * A consequence worth stating: this test therefore cannot be satisfied by adding a key that no
 * real route uses. That is the `catalogue key -> usage` direction's job.
 */
const CONTROLLER_DIRECTORIES = ['src'] as const;

/** Every non-spec `.ts` file under a `controllers/` directory, plus the route guards. */
function controllerFiles(directory: string): readonly string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      found.push(...controllerFiles(path));
      continue;
    }

    if (!path.endsWith('.ts') || path.endsWith('.d.ts') || path.endsWith('.spec.ts')) continue;

    // `controllers/` is the real surface. `route-guards.decorator.ts` is included because it
    // DEFINES the decorator, and its own doc comment uses the placeholder `<PERMISSION_KEY>`
    // — which the comment skip below already discards.
    if (path.includes(`${join('', 'controllers')}`) || path.endsWith('route-guards.decorator.ts')) {
      found.push(path);
    }
  }

  return found;
}

/** A documentation line, by the same rule `check-route-guards.mjs` uses. */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
}

/**
 * Every key a `@RequirePermission` names on a real controller, read from the source tree.
 *
 * Parsed rather than imported, because importing the controllers would need a Nest application
 * context. The decorator form is a single string literal on one line, which is exactly the
 * constraint `check-route-guards.mjs` already relies on for the same reason.
 */
function permissionKeysInSource(): ReadonlyMap<string, readonly string[]> {
  const usage = new Map<string, string[]>();

  for (const root of CONTROLLER_DIRECTORIES) {
    for (const file of controllerFiles(root)) {
      const source = readFileSync(file, 'utf8');

      source.split('\n').forEach((line, index) => {
        if (isCommentLine(line)) return;

        const match = /@RequirePermission\(\s*'([^']*)'\s*\)/.exec(line);
        const key = match?.[1];
        if (key === undefined) return;

        const sites = usage.get(key) ?? [];
        sites.push(`${file}:${index + 1}`);
        usage.set(key, sites);
      });
    }
  }

  return usage;
}

const catalogueKeys = new Set(PERMISSION_KEYS);

describe('the permission catalogue', () => {
  describe('route key -> catalogue', () => {
    it('contains EVERY key a @RequirePermission names', () => {
      // THE test. It fails on `AUTH_LINK_EXTERNAL_IDENTITY` until the catalogue exists,
      // and it is the one that would have caught the real 403.
      const usage = permissionKeysInSource();
      const missing = [...usage.entries()]
        .filter(([key]) => !catalogueKeys.has(key as PermissionDefinition['key']))
        .map(([key, sites]) => `  ${key}  (${sites.join(', ')})`);

      expect(
        missing,
        `@RequirePermission names keys that are not in PERMISSION_CATALOGUE.\n` +
          `A gated route whose key is not seeded returns 403 for every role, including the ` +
          `bootstrap administrator:\n${missing.join('\n')}`,
      ).toEqual([]);
    });

    it('finds at least one gated route, so the test above is not vacuously true', () => {
      // A reconciliation test that passes because it scanned nothing is worse than no test —
      // `D35`, "a gate that exits 0 testing nothing is hollow, not green". If the last gated
      // route is ever removed, THIS fails, so the empty case above can never be reached
      // silently.
      expect(permissionKeysInSource().size).toBeGreaterThan(0);
    });

    it('names the declaring file and line, so a failure is actionable', () => {
      const usage = permissionKeysInSource();
      const sites = [...usage.values()].flat();

      for (const site of sites) expect(site).toMatch(/^src[/\\].+:\d+$/);
    });
  });

  describe('catalogue key -> usage', () => {
    it('has no entry that nothing references', () => {
      // The mirror image. A catalogue key with no route and no grant is a permission that
      // appears in the admin UI, can be assigned, and does nothing — the failure mode where
      // a permission system looks complete and is not.
      const referenced = new Set([
        ...permissionKeysInSource().keys(),
        ...new Set(PERMISSION_CATALOGUE.map((permission) => permission.key)),
      ]);

      // `PERMISSION_CATALOGUE` trivially contains itself, so the real check is that every
      // entry is *either* gated by a route *or* declared as reserved with a stated reason.
      const ungated = PERMISSION_CATALOGUE.filter(
        (permission) => !permissionKeysInSource().has(permission.key),
      );

      for (const permission of ungated) {
        expect(
          permission.reservedFor,
          `Permission '${permission.key}' gates no route. If it is a real capability awaiting ` +
            `its module, say so in 'reservedFor' so this test can tell a deliberate reservation ` +
            `from a dead entry. If it is neither, delete it.`,
        ).toBeTruthy();
      }

      expect(referenced.size).toBeGreaterThan(0);
    });
  });

  describe('the shape ADR-012 asks for', () => {
    it('names every key MODULE_ACTION', () => {
      // `ADR-012`: "Permission Catalogue Declared in Code, Synced to the Database", keys
      // shaped `MODULE_ACTION`. A key that is not is either a typo or a second convention,
      // and both are invisible at runtime.
      for (const permission of PERMISSION_CATALOGUE) {
        expect(
          permission.key,
          `'${permission.key}' is not MODULE_ACTION. Expected MODULE_ACTION in SCREAMING_SNAKE.`,
        ).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/);

        expect(permission.key.startsWith(`${permission.module}_`)).toBe(true);
        expect(permission.key.endsWith(`_${permission.action}`)).toBe(true);
      }
    });

    it('gives every entry a description an administrator can act on', () => {
      for (const permission of PERMISSION_CATALOGUE) {
        expect(permission.description.length).toBeGreaterThan(10);
      }
    });

    it('never contains SUPER_ADMIN, or any cross-tenant role', () => {
      // `ADR-003`: "Do not add a `SUPER_ADMIN` cross-tenant role. There is nothing to be
      // cross-tenant about." `prisma-schema.spec.ts` already asserts the word is absent from
      // the schema; this asserts it is absent from the code that GRANTS permissions, which is
      // where a cross-tenant capability would actually appear.
      const offenders = PERMISSION_CATALOGUE.filter((permission) =>
        /SUPER_?ADMIN|CROSS_?TENANT|CROSS_?SCHOOL/i.test(
          `${permission.key} ${permission.module} ${permission.action}`,
        ),
      );

      expect(offenders.map((permission) => permission.key)).toEqual([]);
    });

    it('has no duplicate keys — a duplicate would silently shadow one definition', () => {
      expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    });

    it('is sorted, so a diff shows what changed rather than where it moved', () => {
      expect([...PERMISSION_KEYS]).toEqual([...PERMISSION_KEYS].sort());
    });

    it('keeps module and action lowercase-free, matching the key exactly', () => {
      // The key is derived from these two, and `prisma.permission` stores them separately.
      // If they disagreed, the admin UI would show one module while the key said another.
      for (const permission of PERMISSION_CATALOGUE) {
        expect(permission.module).toBe(permission.module.toUpperCase());
        expect(permission.action).toBe(permission.action.toUpperCase());
        expect(permission.key).toBe(`${permission.module}_${permission.action}`);
      }
    });
  });

  describe('the keys themselves', () => {
    it('includes AUTH_LINK_EXTERNAL_IDENTITY, which the live route requires', () => {
      // Named individually because it is the one whose absence shipped a 403 on the only
      // gated route in the repository.
      expect(catalogueKeys.has('AUTH_LINK_EXTERNAL_IDENTITY')).toBe(true);
    });

    it('holds exactly the keys this repository actually uses, and no speculative ones', () => {
      // Nine: the eight the seed carried, plus the one the live route needed and the seed
      // was missing. Anything more would be a permission for a module that does not exist.
      expect(PERMISSION_KEYS).toEqual([
        'AUDIT_READ',
        'AUTH_LINK_EXTERNAL_IDENTITY',
        'LICENCE_APPLY',
        'LICENCE_UPGRADE',
        'PERMISSION_ASSIGN',
        'PLATFORM_MODULE_MANAGE',
        'SCHOOL_SETTINGS_MANAGE',
        'USER_CREATE',
        'USER_INVITE',
      ]);
    });
  });
});
