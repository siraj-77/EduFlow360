import { describe, expect, it } from 'vitest';
import { createAuditRecord, type AuditRecordRejection, type AuditDraft } from './audit-record.js';

/**
 * The append-only record's own validation (`PLT-401` T1, `AGENTS.md` 2.7).
 *
 * ## Why validation lives in the domain and not in the DTO
 *
 * `audit_records` is the evidence. A row that reaches the table malformed is a
 * row an auditor cannot trust: an empty `action` cannot be filtered, a blank
 * `correlation_id` cannot join to a request, and a `reason` of spaces answers
 * "why was this fee reversed" with nothing. The DTO validates what a CALLER
 * sent; this validates what the SYSTEM is about to write, which for an audit
 * row is a different question — the caller's input may be perfectly legal and
 * the derived record still be wrong.
 *
 * ## What is NOT here, and must never be added here
 *
 * No clock, no id generator (`AGENTS.md` 2.4). `id` and `occurredAt` are
 * assigned by storage: the database's `uuid()` default and `now()` default,
 * exactly as `schema.prisma` declares. An entity that minted its own timestamp
 * would be an entity that can be constructed with one time and stored with
 * another.
 *
 * The length bounds are **transport bounds**, in the shape
 * `password-sign-in.dto.ts` established: they bound what this system can be
 * made to write, they are not a policy about what an action key may mean
 * (`AuditKey` is a `string` by design — a new module's key is not a schema
 * change), and the corpus specifies no lengths, so none is presented as one.
 */

/** The one valid draft, mutated per case. Every field the writer can supply. */
const valid = (): AuditDraft => ({
  action: 'LOGIN',
  module: 'auth',
  correlationId: '6f1b7c2e-0f3d-4b8a-9c1e-2d4f6a8b0c2d',
});

const create = (input: Parameters<typeof createAuditRecord>[0]) => createAuditRecord(input);

/** The rejection reason for a draft that must be refused, or `null` if accepted. */
const rejectionFor = (
  input: Parameters<typeof createAuditRecord>[0],
): AuditRecordRejection | null => {
  const result = create(input);
  return result.ok ? null : result.reason;
};

// ═══════════════════════════════════════════════════════════════════════════
// The three fields nothing else can substitute for.
// ═══════════════════════════════════════════════════════════════════════════
describe('createAuditRecord — the required fields', () => {
  it('accepts a minimal draft: action, module, correlation', () => {
    // The returned draft is the NORMALISED form: every identity field present
    // with a definite answer, unknowns as null. A draft that omitted its nulls
    // would be a draft whose shape depends on what the writer happened to
    // know, and every reader would then need the same conditional spreads.
    const result = create(valid());

    expect(result).toEqual({
      ok: true,
      record: {
        action: 'LOGIN',
        module: 'auth',
        correlationId: '6f1b7c2e-0f3d-4b8a-9c1e-2d4f6a8b0c2d',
        actorId: null,
        actorRole: null,
        ipAddress: null,
        deviceInfo: null,
        entityType: null,
        entityId: null,
        beforeValue: null,
        afterValue: null,
        reason: null,
      },
    });
  });

  it('refuses a blank action, because an unnameable action cannot be filtered', () => {
    // `   ` is the case a `.length > 0` check passes and a trim check does not.
    expect(rejectionFor({ ...valid(), action: '   ' })).toBe('action-missing');
  });

  it('refuses a missing action', () => {
    expect(rejectionFor({ ...valid(), action: '' })).toBe('action-missing');
  });

  it('refuses a blank module, because the record must say where it came from', () => {
    expect(rejectionFor({ ...valid(), module: '\t\n' })).toBe('module-missing');
  });

  it('refuses a blank correlation id, because the row must join to a request', () => {
    // `AGENTS.md` 2.15: correlation IDs are what makes a log and its audit row
    // the same event. A blank one is a row that joins to nothing.
    expect(rejectionFor({ ...valid(), correlationId: ' ' })).toBe('correlation-missing');
  });

  it('accepts a correlation id that is not a uuid, because PLT-501 owns the format', () => {
    // A caller-supplied `x-correlation-id` is not ours to shape. The charset
    // check below is the whole contract; the uuid shape is this system's own
    // generator's habit, not a rule for everyone else's.
    const result = create({ ...valid(), correlationId: 'trace:7f3a.9c1e' });

    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Normalisation: the stored form is the trimmed form.
// ═══════════════════════════════════════════════════════════════════════════
describe('createAuditRecord — normalisation', () => {
  it('trims the machine fields it was given', () => {
    const result = create({ ...valid(), action: '  GRADE_MODIFIED  ', module: ' exams ' });

    expect(result.ok && result.record.action).toBe('GRADE_MODIFIED');
    expect(result.ok && result.record.module).toBe('exams');
  });

  it('turns blank optionals into null, never into a stored empty string', () => {
    // An empty string in `actor_id` is a row that says "we knew who and it was
    // nobody". `null` says "unknown", which is the truth when a @Public route
    // acted before any principal existed.
    const result = create({ ...valid(), actorId: '  ', reason: '   ' });

    expect(result.ok && result.record.actorId).toBeNull();
    expect(result.ok && result.record.reason).toBeNull();
  });

  it('trims a supplied reason', () => {
    const result = create({ ...valid(), reason: '  parent disputed the mark  ' });

    expect(result.ok && result.record.reason).toBe('parent disputed the mark');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The machine fields carry no control characters.
// ═══════════════════════════════════════════════════════════════════════════
describe('createAuditRecord — the machine fields carry no control characters', () => {
  it('refuses a newline inside the action', () => {
    // A row whose `action` contains `\n` is a row that can forge a second line
    // in anything that renders the value as text. Machine fields are
    // single-line; a reason is prose and is not held to this.
    expect(rejectionFor({ ...valid(), action: 'LOGIN\nSIGNUP' })).toBe('action-malformed');
  });

  it('refuses a NUL inside the module', () => {
    expect(rejectionFor({ ...valid(), module: 'auth\u0000' })).toBe('module-malformed');
  });

  it('refuses control characters inside an identifier', () => {
    expect(rejectionFor({ ...valid(), actorId: 'user\u0007' })).toBe('identifier-malformed');
    // ESC, the one that starts an ANSI sequence — a stored identifier that
    // could repaint an auditor's terminal is not a cosmetic problem.
    expect(rejectionFor({ ...valid(), entityType: 'user\u001b[31m' })).toBe('identifier-malformed');
  });

  it('refuses a malformed correlation id', () => {
    expect(rejectionFor({ ...valid(), correlationId: 'has space' })).toBe('correlation-malformed');
    expect(rejectionFor({ ...valid(), correlationId: 'sla/sh' })).toBe('correlation-malformed');
  });

  it('permits a newline inside a reason, which is prose', () => {
    const result = create({ ...valid(), reason: 'fee reversed twice\nsee ticket 41' });

    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Transport bounds.
// ═══════════════════════════════════════════════════════════════════════════
describe('createAuditRecord — transport bounds', () => {
  it('refuses an action beyond the transport bound', () => {
    expect(rejectionFor({ ...valid(), action: 'A'.repeat(129) })).toBe('action-too-long');
  });

  it('refuses a module beyond the transport bound', () => {
    expect(rejectionFor({ ...valid(), module: 'm'.repeat(65) })).toBe('module-too-long');
  });

  it('refuses a correlation id beyond the transport bound', () => {
    expect(rejectionFor({ ...valid(), correlationId: 'c'.repeat(129) })).toBe(
      'correlation-too-long',
    );
  });

  it('refuses an identifier beyond the transport bound', () => {
    expect(rejectionFor({ ...valid(), ipAddress: '1'.repeat(257) })).toBe('identifier-too-long');
  });

  it('refuses a device string beyond the transport bound', () => {
    // A user-agent is the one field a caller fully controls, so its bound is
    // the one a caller can hit deliberately.
    expect(rejectionFor({ ...valid(), deviceInfo: 'd'.repeat(513) })).toBe('device-too-long');
  });

  it('refuses a reason beyond the transport bound', () => {
    expect(rejectionFor({ ...valid(), reason: 'r'.repeat(1025) })).toBe('reason-too-long');
  });

  it('accepts a value at each bound, because off-by-one is the bug here', () => {
    const result = create({
      ...valid(),
      action: 'A'.repeat(128),
      module: 'm'.repeat(64),
      correlationId: 'c'.repeat(128),
      reason: 'r'.repeat(1024),
    });

    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The snapshots must be storable.
// ═══════════════════════════════════════════════════════════════════════════
describe('createAuditRecord — the snapshots are JSON, and must survive being so', () => {
  it('accepts a structured before/after pair', () => {
    const result = create({
      ...valid(),
      beforeValue: { status: 'PRESENT' },
      afterValue: { status: 'ABSENT', reason: 'medical' },
    });

    expect(result.ok && result.record.afterValue).toEqual({ status: 'ABSENT', reason: 'medical' });
  });

  it('refuses a circular snapshot, which would fail the INSERT at request time', () => {
    // The failure this prevents is a 500 on a sensitive action whose audit row
    // cannot be built — an action that committed with no record, which is the
    // exact window ADR-013 exists to close. Refused here, it is a domain error
    // the caller can see.
    const circular: Record<string, unknown> = { status: 'PRESENT' };
    circular.self = circular;

    expect(rejectionFor({ ...valid(), beforeValue: circular })).toBe('snapshot-not-serialisable');
  });

  it('refuses a bigint snapshot, which JSON cannot carry', () => {
    expect(rejectionFor({ ...valid(), afterValue: { amountMinor: 10n } })).toBe(
      'snapshot-not-serialisable',
    );
  });

  it('refuses a snapshot that cannot be read back as itself', () => {
    // `JSON.stringify` dropping `undefined` silently is survivable; a value
    // that serialises to something it is not is not. Functions are the case.
    expect(rejectionFor({ ...valid(), beforeValue: { fn: () => 'x' } })).toBe(
      'snapshot-not-serialisable',
    );
  });
});
