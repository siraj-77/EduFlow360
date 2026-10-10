import { describe, expect, it } from 'vitest';
import { PERMISSION_KEYS } from './permission-catalogue.js';
import {
  BOOTSTRAP_ROLE_NAME,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLES,
  UNASSIGNED_PERMISSION_KEYS,
} from './system-roles.js';

/**
 * The system roles — `PLT-205` T2, from the corpus §DoR for `PLT-EPIC-02`.
 *
 * ## What this file is protecting
 *
 * `ADR-003` forbids a cross-tenant `SUPER_ADMIN`, and `AGENTS.md` 2.1 makes the reason
 * concrete: one database per school, so there is no tenant above a school to administer.
 * `prisma-schema.spec.ts` already asserts the *word* is absent from the schema — but a role is
 * created by **name**, at seed time, in a script the schema gate never reads. So this is
 * where it would come back.
 *
 * The second thing this file protects is the **matrix**. `PLT-205` is a permission matrix,
 * and a matrix over one role has no role dimension: every row must be `ALLOW` and nothing is
 * proven. Five roles is what makes denials exist.
 */

/** The catalogue §DoR names exactly these five, with `Super Admin` removed. */
const CORPUS_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'];

describe('the system roles', () => {
  describe('ADR-003 — there is no cross-tenant role', () => {
    it('declares exactly the five the corpus names, and no sixth', () => {
      // The count is the assertion. A sixth system role is either a genuine requirement — in
      // which case the corpus §DoR must be amended and this test with it — or an invention.
      expect([...SYSTEM_ROLE_NAMES]).toEqual(CORPUS_ROLES);
    });

    it.each([
      ['SUPER_ADMIN'],
      ['SUPERADMIN'],
      ['SUPER_ADMINISTRATOR'],
      ['PLATFORM_ADMIN'],
      ['ROOT'],
    ])('never declares %s', (forbidden) => {
      expect(SYSTEM_ROLE_NAMES).not.toContain(forbidden);
    });

    it('names no role that implies authority above a school', () => {
      // Catches the shape rather than one spelling: any name suggesting a tier above the
      // school is the ADR-003 violation wearing a different word.
      const offenders = SYSTEM_ROLE_NAMES.filter((name) =>
        /^(SUPER|GLOBAL|ROOT|PLATFORM)_/i.test(name),
      );

      expect(offenders).toEqual([]);
    });

    it('gives every role a description, so an operator can tell them apart', () => {
      for (const role of SYSTEM_ROLES) {
        expect(role.description.length).toBeGreaterThan(10);
      }
    });

    it('gives every role a distinct description', () => {
      const descriptions = SYSTEM_ROLES.map((role) => role.description);

      expect(new Set(descriptions).size).toBe(descriptions.length);
    });
  });

  describe('grants reference real catalogue keys', () => {
    it('grants nothing a @RequirePermission could not name', () => {
      // A grant on a key outside the union could never be checked against a route, so it
      // would be an administrative fiction.
      const known = new Set<string>(PERMISSION_KEYS);

      for (const role of SYSTEM_ROLES) {
        for (const key of role.permissions) {
          expect(
            known,
            `${role.name} is granted '${key}', which is not in the catalogue`,
          ).toContain(key);
        }
      }
    });

    it('grants no key twice within one role', () => {
      for (const role of SYSTEM_ROLES) {
        expect(new Set(role.permissions).size).toBe(role.permissions.length);
      }
    });

    it('grants the bootstrap role the key the one gated route requires', () => {
      // THE regression test for the defect that started this work.
      // `GET /auth/oidc/link` gates on `AUTH_LINK_EXTERNAL_IDENTITY`, and the original seed
      // omitted it — so the only permission-gated route in the repository returned 403 for
      // the bootstrap administrator. Named individually so it cannot be dropped quietly.
      const bootstrap = SYSTEM_ROLES.find((role) => role.name === BOOTSTRAP_ROLE_NAME);

      expect(bootstrap?.permissions).toContain('AUTH_LINK_EXTERNAL_IDENTITY');
    });
  });

  describe('option A — no self-escalation', () => {
    it('withholds PERMISSION_ASSIGN from the bootstrap role', () => {
      // A role that can grant itself `PERMISSION_ASSIGN` makes the permission system
      // advisory: an administrator who wants a key can take it, and the audit trail records
      // housekeeping rather than escalation.
      const bootstrap = SYSTEM_ROLES.find((role) => role.name === BOOTSTRAP_ROLE_NAME);

      expect(bootstrap?.permissions).not.toContain('PERMISSION_ASSIGN');
    });

    it('grants PERMISSION_ASSIGN to no role at all', () => {
      // None of TEACHER / STUDENT / PARENT / STAFF is a plausible owner of the ability to
      // redesign the school's permission model, so the capability is seeded and unassigned.
      const holders = SYSTEM_ROLES.filter((role) =>
        role.permissions.includes('PERMISSION_ASSIGN'),
      ).map((role) => role.name);

      expect(holders).toEqual([]);
    });

    it('records the unassigned set as data, so it can be reported on later', () => {
      // `PLT-201` Task 5 needs to tell an operator "this capability exists and nobody has it".
      // That report needs a named list, not a comment someone re-derives.
      expect(UNASSIGNED_PERMISSION_KEYS).toContain('PERMISSION_ASSIGN');
    });

    it('grants the bootstrap role everything a fresh instance needs to be set up', () => {
      // The flip side of withholding: an administrator with none of these cannot enable a
      // module, cannot invite a teacher, and cannot apply a licence — an instance that cannot
      // be set up at all.
      const bootstrap = SYSTEM_ROLES.find((role) => role.name === BOOTSTRAP_ROLE_NAME);

      expect(bootstrap?.permissions).toEqual(
        expect.arrayContaining([
          'PLATFORM_MODULE_MANAGE',
          'SCHOOL_SETTINGS_MANAGE',
          'USER_CREATE',
          'USER_INVITE',
          'LICENCE_APPLY',
          'AUDIT_READ',
        ]),
      );
    });

    it('keeps licence and audit with the administrator, because the corpus says so', () => {
      // PLT-303/304 open "As a School Admin I want to activate my serial key" and PLT-403
      // opens "As an Admin I want to search audit records". Withholding these would leave an
      // instance that cannot be licensed and an audit trail nobody can read.
      const bootstrap = SYSTEM_ROLES.find((role) => role.name === BOOTSTRAP_ROLE_NAME);

      expect(bootstrap?.permissions).toEqual(
        expect.arrayContaining(['LICENCE_APPLY', 'LICENCE_UPGRADE', 'AUDIT_READ']),
      );
    });
  });

  describe('every role holds the platform-core read key, and nothing else', () => {
    it.each(['TEACHER', 'STUDENT', 'PARENT', 'STAFF'])(
      '%s holds exactly the platform-core read key, because no module exists to grant anything on',
      (name) => {
        // The truthful state for a role whose module has not shipped: the one
        // platform-core capability every signed-in account needs (PLT-204 reads the
        // caller's own permission set), and nothing else. A speculative grant here
        // would be a permission the admin UI lists and that does nothing.
        const role = SYSTEM_ROLES.find((candidate) => candidate.name === name);

        expect(role?.permissions).toEqual(['PERMISSION_READ_OWN']);
      },
    );

    it('says so in the description, so the single grant does not read as an oversight', () => {
      for (const role of SYSTEM_ROLES) {
        if (role.name === BOOTSTRAP_ROLE_NAME) continue;

        expect(role.description).toMatch(/platform-core read key/i);
      }
    });

    it('grants the bootstrap role the platform-core read key too', () => {
      // PLT-204 is for every signed-in account, including the administrator's.
      const bootstrap = SYSTEM_ROLES.find((role) => role.name === BOOTSTRAP_ROLE_NAME);

      expect(bootstrap?.permissions).toContain('PERMISSION_READ_OWN');
    });
  });

  describe('immutability is declared, not assumed', () => {
    it('freezes the role list and every grant list', () => {
      // `ADR-012`: system roles are immutable. `Object.freeze` is the cheapest honest part of
      // that — it does not stop a database write, and `system-roles.spec.ts` says so — but it
      // does stop a caller mutating the declaration the seed and the matrix both read.
      expect(Object.isFrozen(SYSTEM_ROLES)).toBe(true);
      expect(Object.isFrozen(SYSTEM_ROLE_NAMES)).toBe(true);

      for (const role of SYSTEM_ROLES) {
        expect(Object.isFrozen(role.permissions)).toBe(true);
      }
    });

    it('freezes the unassigned set', () => {
      expect(Object.isFrozen(UNASSIGNED_PERMISSION_KEYS)).toBe(true);
    });
  });

  describe('the catalogue and the roles partition the permission space', () => {
    it('accounts for every catalogue key as either granted or explicitly unassigned', () => {
      // The gap this closes: a permission that is neither granted to a role nor named as
      // unassigned is one nobody decided about. `PERMISSION_ASSIGN` is currently the only
      // one, and it is named — so the audit trail says "withheld on purpose" rather than
      // "nobody thought about it".
      const granted = new Set(SYSTEM_ROLES.flatMap((role) => role.permissions));
      const unassigned = new Set(UNASSIGNED_PERMISSION_KEYS);
      const unaccounted = PERMISSION_KEYS.filter(
        (key) => !granted.has(key) && !unassigned.has(key),
      );

      expect(
        unaccounted,
        `These permissions are granted to no role and are not named as deliberately ` +
          `unassigned: ${unaccounted.join(', ')}. Add a grant, or add the key to ` +
          `UNASSIGNED_PERMISSION_KEYS with a reason.`,
      ).toEqual([]);
    });

    it('never lists a key as both granted and unassigned', () => {
      const granted = new Set(SYSTEM_ROLES.flatMap((role) => role.permissions));
      const contradictions = UNASSIGNED_PERMISSION_KEYS.filter((key) => granted.has(key));

      expect(contradictions).toEqual([]);
    });
  });
});
