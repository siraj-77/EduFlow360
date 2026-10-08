import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOGUE, PERMISSION_KEYS } from './permission-catalogue.js';
import { SYSTEM_ROLES, UNASSIGNED_PERMISSION_KEYS } from './system-roles.js';

/**
 * `prisma/seed.mjs` resolves its permission and role vocabulary out of `src/` — by
 * **transpiling** the declarations with the TypeScript compiler already in the workspace,
 * because there is no runtime TS loader and adding one to a seed script is a larger change
 * than the problem deserves. The reader lives in `prisma/read-declaration.mjs`.
 *
 * That is a real trade: a text read can break where an import cannot. This file is the
 * insurance, and it asserts the three things that would break it —
 *
 * 1. the seed **declares no permission or role literal of its own**;
 * 2. what the shared reader produces **equals** what the application modules export;
 * 3. the writes are **idempotent**, because the script runs on every `db push`.
 *
 * ## It imports the seed's own reader rather than copying it
 *
 * The first version of this file carried its own extraction, on the reasoning that a copy
 * agreeing by construction would prove nothing. That was right about a *comparison* and wrong
 * about this: the thing worth proving is **"the seed resolves the right data"**, and a spec
 * with its own reader proves only that its reader works. Sharing one implementation means
 * this exercises the exact code path `seed.mjs` runs.
 *
 * ## What went wrong on the way, because both are traps
 *
 * - **Evaluating the literal directly does not work.** An `as const satisfies readonly X[]`
 *   literal contains TypeScript syntax — `as const`, `as readonly PermissionKey[]` — so plain
 *   `new Function` fails with `SyntaxError: Unexpected token ')'`. Hence the transpile.
 * - **Wrapping the extracted contents in `(...)` does not work either.** The brace match
 *   yields the array's *contents*, so a parenthesised wrap is a comma expression, and with the
 *   trailing comma every entry carries, `(a, b,)` is a syntax error. It must be `[...]`.
 */

/** The seed, and the shared reader it depends on. */
const SEED_PATH = join(process.cwd(), 'prisma', 'seed.mjs');
const READER_PATH = join(process.cwd(), 'prisma', 'read-declaration.mjs');

/** What the seed will actually resolve, via the reader it uses. */
async function whatTheSeedResolves<T>(fileName: string, exportName: string): Promise<T> {
  const { readConstArray } = (await import(READER_PATH)) as {
    readConstArray(file: string, name: string): unknown;
  };

  return readConstArray(fileName, exportName) as T;
}

describe('prisma/seed.mjs', () => {
  describe('it reads its vocabulary rather than restating it', () => {
    it('declares no permission key literally', () => {
      // The defect this whole story exists to prevent was a hand-written array in this file
      // drifting from the routes. One `key: '...'` here would be that array again.
      const source = readFileSync(SEED_PATH, 'utf8');

      expect(
        source,
        'seed.mjs declares a permission key literally. It must read PERMISSION_CATALOGUE from ' +
          'src/modules/rbac/domain/permission-catalogue.ts, or the seed and the routes can ' +
          'drift apart again.',
      ).not.toMatch(/key:\s*'/);
    });

    it('declares no role name literally', () => {
      const source = readFileSync(SEED_PATH, 'utf8');

      expect(source).not.toMatch(/name:\s*'[A-Z_]+'/);
    });

    it('takes both vocabularies from the shared reader', () => {
      const source = readFileSync(SEED_PATH, 'utf8');

      expect(source).toContain("from './read-declaration.mjs'");
      expect(source).toContain("readConstArray('permission-catalogue.ts', 'PERMISSION_CATALOGUE')");
      expect(source).toContain("readConstArray('system-roles.ts', 'SYSTEM_ROLES')");
    });

    it('imports nothing a bare `node` cannot resolve', () => {
      // `seed.mjs` runs under plain node with no TS loader, so an import of a `.ts` file would
      // fail at runtime. This asserts that stays the only option.
      const source = readFileSync(SEED_PATH, 'utf8');
      const imports = [...source.matchAll(/^import .*from '([^']+)'/gm)].map((match) => match[1]);

      for (const specifier of imports) {
        expect(
          specifier,
          `seed.mjs imports '${specifier}'. It runs under plain node with no TypeScript ` +
            'loader, so a source import would fail at runtime.',
        ).toMatch(/^(@prisma\/client|node:|\.\/)/);
      }
    });

    it('puts the TypeScript compiler behind createRequire, anchored to its own file', () => {
      // A bare `import ts from 'typescript'` would resolve relative to however node was
      // invoked; `createRequire(import.meta.url)` anchors it to this module.
      const reader = readFileSync(READER_PATH, 'utf8');

      expect(reader).toContain('createRequire(import.meta.url)');
      expect(reader).toContain("require('typescript')");
    });
  });

  describe('what the seed resolves equals what the application exports', () => {
    it('resolves PERMISSION_CATALOGUE identically', async () => {
      // The assertion that matters. If the reader drifted from the declaration, the seed would
      // quietly insert different permissions than the application gates on — which is the
      // original defect, one indirection further away.
      const resolved = await whatTheSeedResolves<unknown>(
        'permission-catalogue.ts',
        'PERMISSION_CATALOGUE',
      );

      expect(resolved).toEqual(JSON.parse(JSON.stringify(PERMISSION_CATALOGUE)));
    });

    it('resolves SYSTEM_ROLES identically', async () => {
      const resolved = await whatTheSeedResolves<unknown>('system-roles.ts', 'SYSTEM_ROLES');

      expect(resolved).toEqual(JSON.parse(JSON.stringify(SYSTEM_ROLES)));
    });

    it('resolves the same permission COUNT, so a truncated read cannot pass', async () => {
      const resolved = await whatTheSeedResolves<unknown[]>(
        'permission-catalogue.ts',
        'PERMISSION_CATALOGUE',
      );

      expect(resolved).toHaveLength(PERMISSION_CATALOGUE.length);
    });

    it('throws a message naming the file when a declaration cannot be found', async () => {
      // A refactor that renames or re-shapes the export must fail as a shape error, not seed
      // `undefined` and let the first `db push` explain it.
      const { readConstArray } = (await import(READER_PATH)) as {
        readConstArray(file: string, name: string): unknown;
      };

      expect(() => readConstArray('permission-catalogue.ts', 'NO_SUCH_EXPORT')).toThrow(
        /NO_SUCH_EXPORT[\s\S]*permission-catalogue\.ts/,
      );
    });
  });

  describe('what the seed will therefore create', () => {
    it('creates five roles, all declared as system roles', () => {
      expect(SYSTEM_ROLES).toHaveLength(5);
    });

    it('grants nothing outside the catalogue', () => {
      const known = new Set<string>(PERMISSION_KEYS);
      const unknown = SYSTEM_ROLES.flatMap((role) =>
        role.permissions.filter((key) => !known.has(key)).map((key) => `${role.name}:${key}`),
      );

      expect(unknown).toEqual([]);
    });

    it('leaves exactly the named keys unassigned', () => {
      // Every catalogue key is either granted to a role or named as deliberately withheld, so
      // no permission is in a state nobody decided about.
      const granted = new Set(SYSTEM_ROLES.flatMap((role) => role.permissions));
      const unassigned = PERMISSION_KEYS.filter((key) => !granted.has(key));

      expect([...unassigned].sort()).toEqual([...UNASSIGNED_PERMISSION_KEYS].sort());
    });

    it('grants the bootstrap role the key the one gated route requires', () => {
      // `GET /auth/oidc/link` gates on this. The original seed omitted it, so the only
      // permission-gated route returned 403 for the bootstrap administrator.
      const bootstrap = SYSTEM_ROLES.find((role) => role.name === 'SCHOOL_ADMIN');

      expect(bootstrap?.permissions).toContain('AUTH_LINK_EXTERNAL_IDENTITY');
    });
  });

  describe('idempotence — the script runs on every db push', () => {
    it('issues no bare .create() or .createMany() for RBAC data', () => {
      // A `create` in the permission/role/grant section makes the second run fail on a unique
      // constraint, which is a broken dev database rather than a wrong answer.
      const source = readFileSync(SEED_PATH, 'utf8');

      expect([...source.matchAll(/\.(?:create|createMany)\(/g)]).toEqual([]);
    });

    it('still uses ONE nested create, for the UserRole join, which cannot be an upsert', () => {
      // `UserRole`'s unique input is the composite (schoolId, userId, roleId) and `userId` does
      // not exist until the user is created — so this one genuinely cannot be upserted. Named
      // so a future second `create` is visibly a decision rather than an oversight.
      const source = readFileSync(SEED_PATH, 'utf8');

      expect(source).toMatch(/roles:\s*\{\s*create:\s*\[/);
    });

    it('re-asserts isSystemRole on every run, so a bad row self-corrects', () => {
      // A role a previous version created with the flag unset would otherwise persist as a
      // deletable custom role, and `ADR-012`'s immutability would be quietly false.
      //
      // Counted rather than pattern-matched across the `update:` block: the two occurrences
      // are the `update` and the `create`, and the explanatory comment between them is longer
      // than any sensible regex window — which is exactly the kind of assertion that breaks
      // the next time someone writes a useful comment.
      const source = readFileSync(SEED_PATH, 'utf8');
      const occurrences = source.match(/isSystemRole:\s*true/g) ?? [];

      expect(
        occurrences,
        'seed.mjs must set isSystemRole: true in BOTH branches of the role upsert — once in ' +
          '`update` so an existing wrong row is corrected, once in `create`.',
      ).toHaveLength(2);
    });

    it('never clears isSystemRole on a role it did not create', () => {
      // The mirror: an upsert that writes `isSystemRole: false` would quietly un-immutabilise
      // every system role on the next seed.
      const source = readFileSync(SEED_PATH, 'utf8');

      expect(source).not.toMatch(/isSystemRole:\s*false/);
    });
  });
});
