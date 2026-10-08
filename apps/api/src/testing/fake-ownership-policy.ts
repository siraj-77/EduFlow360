import {
  type IOwnershipPolicy,
  type IOwnershipPolicyRegistry,
  type OwnershipEntityType,
  type OwnershipSubject,
  type OwnershipVerdict,
} from '../modules/rbac/domain/ports/ownership-policy.js';

/**
 * Test doubles for the ownership layer.
 *
 * ## What these stand in for, stated rather than glossed
 *
 * `AGENTS.md` 2.3 requires teacher→own classes, parent→own children and vendor→own outlet.
 * **None of those relationships exists in this repository** — no class table, no guardian
 * link, no parent-child edge, no outlet table. The `User` model's comment says ownership
 * "resolves through abstract ports, and the domains that would own those relationships do
 * not exist yet."
 *
 * So these doubles are NOT a model of the school domain. They are a **harness for the
 * engine**: they let `PLT-203`'s negative security tests run today against the real guard,
 * the real registry and a real socket, using relationships that exist only inside the test.
 *
 * That distinction is the point. A fabricated `teacher_class_assignments` table in `domain/`
 * would be `AGENTS.md` 6's named failure — an invented structure indistinguishable from a
 * designed one. A fake in `src/testing/`, labelled as a fake, is the honest form of the same
 * coverage: when the academic module lands it supplies a real policy and **these doubles are
 * deleted**, and the tests keep working because they were written against the port.
 */

/** One relationship, held in memory, for the duration of a test. */
export interface OwnedRecord {
  /** The `entityType` this record answers for. */
  readonly entityType: OwnershipEntityType;
  /** The record's own id, as it appears in the request. */
  readonly recordId: string;
  /** The users who own it. Empty means nobody owns it — which is not the same as absent. */
  readonly ownerIds: readonly string[];
}

/**
 * A policy over an in-memory list of owned records.
 *
 * Written as a class rather than a closure so the duplicate-registration error in
 * `StaticOwnershipPolicyRegistry` can name it — two anonymous policies claiming one type
 * produce an error naming `Object`, which helps nobody.
 */
export class FakeOwnershipPolicy implements IOwnershipPolicy {
  readonly entityType: OwnershipEntityType;

  /** Every subject this policy was asked about, in order. */
  readonly asked: OwnershipSubject[] = [];

  constructor(
    entityType: OwnershipEntityType,
    private readonly records: readonly OwnedRecord[],
  ) {
    this.entityType = entityType;
  }

  async assertOwnership(subject: OwnershipSubject): Promise<OwnershipVerdict> {
    this.asked.push(subject);

    const recordId = readRecordId(subject);

    // No id in the request is NOT an owned record. Answering OWNED because the lookup found
    // nothing would be the fail-OPEN direction, and it is the mistake a real policy is most
    // likely to make — an empty `WHERE` matches every row.
    if (recordId === undefined) return 'NOT_OWNED';

    const record = this.records.find(
      (candidate) => candidate.entityType === subject.entityType && candidate.recordId === recordId,
    );

    if (record === undefined) return 'NOT_OWNED';

    return record.ownerIds.includes(subject.userId) ? 'OWNED' : 'NOT_OWNED';
  }
}

/**
 * Pull the record id out of the opaque attributes, wherever the module put it.
 *
 * A real policy knows its own URL and payload shape; this one accepts any of them so the
 * tests do not encode a routing convention the core was deliberately kept ignorant of. The
 * core passing `params`/`query`/`body` separately is itself asserted in
 * `permission-ownership-over-http.spec.ts`.
 */
function readRecordId(subject: OwnershipSubject): string | undefined {
  for (const source of ['params', 'query', 'body'] as const) {
    const bag = subject.attributes[source];
    if (bag === null || typeof bag !== 'object') continue;

    for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
      if (typeof value === 'string' && key.toLowerCase().endsWith('id')) return value;
    }
  }

  return undefined;
}

/**
 * A registry that records its lookups, wrapping the **real**
 * `StaticOwnershipPolicyRegistry`.
 *
 * Delegating rather than reimplementing lookup is deliberate: the duplicate-registration
 * behaviour is production code, and a fake that reimplemented it would be testing itself.
 */
export class RecordingOwnershipPolicyRegistry implements IOwnershipPolicyRegistry {
  /** Every `find` call, in order. Proves a lookup that must not happen did not happen. */
  readonly lookups: OwnershipEntityType[] = [];

  constructor(private readonly inner: IOwnershipPolicyRegistry) {}

  async find(entityType: OwnershipEntityType): Promise<IOwnershipPolicy | undefined> {
    this.lookups.push(entityType);
    return this.inner.find(entityType);
  }
}
