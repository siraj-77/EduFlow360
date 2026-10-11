import { readFileSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `IAuditRepository` — the port shape, and the proof that no other shape
 * exists (`PLT-401` T3, `AGENTS.md` 2.7).
 *
 * ## The acceptance criterion is a NEGATIVE, and negatives need a scan
 *
 * "No code path in the repository layer can modify an existing audit record"
 * is not a property a unit test of the repository can demonstrate: a test
 * proves what the code DOES, and this is about what the codebase does not
 * contain. So this file reads the source tree, the same way
 * `check-route-guards.mjs` reads it — because the alternative is trusting
 * that nobody ever adds `update()` to an interface, which is trust in the one
 * behaviour an append-only table cannot survive.
 *
 * The check is deliberately blunt: it looks for the mutation CALLS that would
 * exist if a method existed, at the Prisma delegate level, where every write
 * in this repository ultimately goes. A future refactor that bypasses the
 * delegate with `$executeRaw` would evade it — and `$queryRaw`/`$executeRaw`
 * in production code is already banned by a separate convention with its own
 * integration proof (`audit-immutability.integration.spec.ts`). The database
 * trigger is what closes that door; this closes the door a developer would
 * walk through by accident.
 *
 * ## The one sanctioned exception, and why it stays
 *
 * `audit-immutability.integration.spec.ts` calls `prisma.auditRecord.update`
 * and `.delete` ON PURPOSE: it is the spec that proves the trigger refuses
 * them. Removing its permission to name them would remove the proof. It is
 * the only file allowed to.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// `.../src/modules/audit/domain/repositories` → `.../src`. Four levels up:
// repositories → domain → audit → modules → src. One too few and the glob
// silently matches nothing, which fails CLOSED for the "no mutation" test and
// makes the allowlist test below the thing that catches it.
const SRC_ROOT = join(HERE, '..', '..', '..', '..');
const PORT_FILE = join(HERE, 'audit-repository.ts');

/** The spec permitted to name a mutation, because proving the refusal is its job. */
const IMMUTABILITY_PROOF_SPEC = 'config/audit-immutability.integration.spec.ts';

/**
 * This file, which names every mutation in its own forbidden list.
 *
 * A checker that flags itself is a checker nobody can run: the strings have to
 * exist somewhere for the scan to be able to look for them. Named explicitly
 * rather than excluded by a `*.spec.ts` glob, because specs are exactly where
 * a real mutation call would be caught — this one exclusion must stay one
 * file wide.
 */
const THIS_SPEC = 'audit-repository.spec.ts';

/** Every mutation call shape Prisma exposes for a model delegate. */
const MUTATION_CALLS = [
  'auditRecord.update',
  'auditRecord.updateMany',
  'auditRecord.delete',
  'auditRecord.deleteMany',
  'auditRecord.upsert',
];

/**
 * Every `.ts` source file under `src/`, specs included — a mutation could hide anywhere.
 *
 * Normalised to forward slashes: `fs.globSync` returns whatever the host
 * separator is, and this repository is developed on Windows (`AGENTS.md` 14's
 * PowerShell notes say so). An `endsWith('config/audit-...')` comparison
 * against a `config\...` path is false on Windows and true on Linux, which is
 * a spec that passes for a reason nothing to do with the code.
 */
function sourceFiles(): readonly string[] {
  return globSync('**/*.ts', { cwd: SRC_ROOT })
    .map((file) => file.split('\\').join('/'))
    .sort();
}

// ═══════════════════════════════════════════════════════════════════════════
// The port itself.
// ═══════════════════════════════════════════════════════════════════════════
describe('IAuditRepository — the port declares exactly create() and query()', () => {
  const source = readFileSync(PORT_FILE, 'utf8');

  it('declares a create method, taking the optional transaction ADR-013 names', () => {
    // The signature is the ADR, not a convenience: a same-transaction write
    // means the insert must accept the caller's handle. Without the parameter
    // the port cannot honour ADR-013 at all, and no test would notice.
    expect(source).toMatch(/create\s*\(/);
    expect(source).toMatch(/transaction\??\s*:/);
  });

  it('declares a query method', () => {
    expect(source).toMatch(/query\s*\(/);
  });

  it('declares NO update and NO delete, in any spelling', () => {
    // Read out of the interface body rather than the whole file, so a prose
    // comment explaining what is absent cannot fail this — the header of this
    // very file says "no update" and must not.
    const body = source.slice(
      source.indexOf('interface IAuditRepository'),
      source.indexOf('}', source.indexOf('interface IAuditRepository')),
    );
    for (const forbidden of ['update', 'delete', 'remove', 'patch', 'write']) {
      expect(body).not.toMatch(new RegExp(`\\b${forbidden}\\s*\\(`));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The codebase-wide scan.
// ═══════════════════════════════════════════════════════════════════════════
describe('no audit mutation call exists in the codebase', () => {
  it('finds no update/delete/upsert against the audit delegate anywhere', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      if (file.endsWith(IMMUTABILITY_PROOF_SPEC) || file.endsWith(THIS_SPEC)) continue;
      const text = readFileSync(join(SRC_ROOT, file), 'utf8');
      for (const call of MUTATION_CALLS) {
        if (text.includes(call)) offenders.push(`${file} contains ${call}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('allows the immutability proof to name them, and only that file', () => {
    // The guard on the exception itself: an allowlist that grows by one file
    // per session is how a convention decays. This fails the moment a second
    // file joins the exception, forcing a conversation rather than a silent
    // widening. This spec names them too and is excluded for the reason above;
    // anything else that does is a finding.
    const naming = sourceFiles()
      .filter((file) => !file.endsWith(THIS_SPEC))
      .filter((file) => {
        const text = readFileSync(join(SRC_ROOT, file), 'utf8');
        return MUTATION_CALLS.some((call) => text.includes(call));
      });

    expect(naming).toEqual([IMMUTABILITY_PROOF_SPEC]);
  });
});
