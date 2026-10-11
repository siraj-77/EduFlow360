/**
 * One row of `audit_records`: the evidence that a sensitive action happened
 * (`AGENTS.md` 2.7, `PLT-401` T1, `ADR-013`).
 *
 * ## Why this file exists when the table already exists
 *
 * `schema.prisma` already declares `AuditRecord`, and `schema.prisma` is
 * infrastructure vocabulary — `@db.Uuid`, `@map`, column names. This is the
 * domain vocabulary: what the system asserts about a record BEFORE it is
 * handed to storage. The two answer different questions. "Does the column
 * accept this" is the database's question; "is this a findable, joinable,
 * truthful record" is this one, and the database cannot ask it.
 *
 * ## What this entity does not decide
 *
 * WHICH actions are sensitive — that is the `@Audited('<ACTION>')` decorator
 * on the route, and `check-route-guards.mjs` is what proves one is present.
 * WHETHER a reason was mandatory — that is `reason-policy.ts`. This file
 * validates the record both of those decisions produce.
 *
 * ## There is no update, and there is no delete
 *
 * Not "discouraged": absent. `IAuditRepository` exposes `create()` and
 * `query()` and nothing else, and `audit-repository.spec.ts` walks the source
 * tree asserting no update/delete method for this repository exists anywhere
 * in the codebase. The database-level half — the `REVOKE` and the
 * `BEFORE UPDATE OR DELETE` trigger — is `PLT-401` T2 and is proven in
 * `audit-immutability.integration.spec.ts`. Either half alone is a
 * convention; together they are the invariant.
 */

/**
 * What a caller supplies. `id` and `occurredAt` are absent on purpose — they
 * are assigned by storage (`schema.prisma`'s `uuid()` and `now()` defaults),
 * so a draft that carried a timestamp would be a draft that can disagree with
 * the row it becomes.
 *
 * Nullable rather than optional for the identity fields, because the writer
 * builds one object with a definite answer for every field, and
 * `exactOptionalPropertyTypes` then makes "absent" and "explicitly undefined"
 * the same statement at every call site instead of two.
 */
export interface AuditDraft {
  /** The `@Audited('<ACTION_KEY>')` argument. What happened. */
  readonly action: string;
  /** Where it happened — the controller's route prefix. */
  readonly module: string;
  /** Joins this row to the request and to `error_logs` (`PLT-501`). */
  readonly correlationId: string;
  /** The account, when one was established. `null` on an unattributable action. */
  readonly actorId: string | null;
  /** The role held at the time, when the writer knew it. */
  readonly actorRole: string | null;
  /** The socket peer. `AGENTS.md` 2.13 redaction does not apply — this is an address, not a credential. */
  readonly ipAddress: string | null;
  /** The user-agent, when one was presented. */
  readonly deviceInfo: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  /** The state before the action, when the writer captured one. */
  readonly beforeValue: unknown;
  /** The state after the action, when the writer captured one. */
  readonly afterValue: unknown;
  /** Why, for the actions whose policy demands it. Prose — the only multi-line field. */
  readonly reason: string | null;
}

/** The stored form: a draft that storage has stamped. */
export interface AuditRecord extends AuditDraft {
  readonly id: string;
  readonly occurredAt: Date;
}

/** Why a draft was refused. One reason per refusal, so a test can name it. */
export type AuditRecordRejection =
  | 'action-missing'
  | 'action-malformed'
  | 'action-too-long'
  | 'module-missing'
  | 'module-malformed'
  | 'module-too-long'
  | 'correlation-missing'
  | 'correlation-malformed'
  | 'correlation-too-long'
  | 'identifier-malformed'
  | 'identifier-too-long'
  | 'device-too-long'
  | 'reason-too-long'
  | 'snapshot-not-serialisable';

export type AuditRecordCreation =
  | { readonly ok: true; readonly record: AuditDraft }
  | { readonly ok: false; readonly reason: AuditRecordRejection };

/** What a writer supplies: the required three, and every optional field it knows. */
export interface AuditRecordInput {
  readonly action: string;
  readonly module: string;
  readonly correlationId: string;
  readonly actorId?: string | null | undefined;
  readonly actorRole?: string | null | undefined;
  readonly ipAddress?: string | null | undefined;
  readonly deviceInfo?: string | null | undefined;
  readonly entityType?: string | null | undefined;
  readonly entityId?: string | null | undefined;
  readonly beforeValue?: unknown;
  readonly afterValue?: unknown;
  readonly reason?: string | null | undefined;
}

/**
 * The transport bounds, in the shape `password-sign-in.dto.ts` established.
 *
 * These bound what this system can be made to WRITE — an action key, a module
 * name, a correlation id — and they are deliberately generous: `AuditKey` is
 * a `string` (`ADR-012` puts the catalogue in code, so a new module's key
 * needs no schema change), and a bound tight enough to be policy would start
 * refusing keys nobody has invented yet. The corpus specifies no lengths and
 * none is claimed here as policy.
 */
const ACTION_MAX = 128;
const MODULE_MAX = 64;
const CORRELATION_MAX = 128;
const IDENTIFIER_MAX = 256;
const DEVICE_MAX = 512;
const REASON_MAX = 1024;

/**
 * Does this value carry a control character?
 *
 * A char-code walk rather than a `/[\u0000-\u001f]/` regex, because the
 * `no-control-regex` lint rule refuses the regex form — and it is right to:
 * a control character inside a regex is almost always an accident. Here it
 * would be the intent, which is exactly when a suppression is the wrong
 * answer and an explicit loop is the right one. `0x7f` (DEL) is included: it
 * is not in the C0 range and it is still not printable.
 *
 * The characters ban is for the machine fields only — see the header.
 */
function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * The correlation id charset.
 *
 * A uuid, a trace id, `svc:req-42` — anything another system might have put in
 * an `x-correlation-id` header, and nothing that could carry a delimiter of
 * its own. `PLT-501` owns the request-side format; this only guarantees the
 * stored value cannot forge a boundary in the systems that read it back.
 */
const CORRELATION_CHARS = /^[A-Za-z0-9._:-]+$/;

/**
 * Is this a correlation id worth storing?
 *
 * Exported because TWO callers must agree or the agreement is worthless: the
 * entity validates what it is handed, and `audit.interceptor.ts` decides
 * whether a caller-supplied `x-correlation-id` header is trustworthy enough
 * to keep before the entity ever sees it. Two copies of one charset is one
 * charset away from storing an id the reader cannot use.
 */
export function isStorableCorrelationId(value: string): boolean {
  return CORRELATION_CHARS.test(value) && value.length <= CORRELATION_MAX;
}

/** A trimmed non-empty string, or `null`. */
function text(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Can this value be stored in a `Json` column without losing any of itself?
 *
 * Two failures, because there are two ways a snapshot can be wrong:
 *
 *  1. **It throws.** `JSON.stringify` refuses a cycle and refuses a bigint
 *     (`AGENTS.md` 2.5's minor units are the realistic case — a fee amount is
 *     exactly the kind of thing a before/after pair would carry). The throw
 *     happens at INSERT time, which turns a sensitive action that already
 *     committed into a 500 with no audit row: the window `ADR-013` exists to
 *     close. Caught here, it is a domain error the caller can see.
 *  2. **It lies.** A function-valued key serialises to nothing, so the stored
 *     snapshot would claim to be the state when a field had been dropped from
 *     it. A round-trip comparison does NOT catch this — `'{}'` equals `'{}'` —
 *     so the walk below is what does.
 *
 * The walk runs only after the stringify has succeeded, which is what makes it
 * terminate: a cycle throws there, so no cycle reaches the walk.
 */
function snapshotSerialisable(value: unknown): boolean {
  try {
    JSON.stringify(value);
  } catch {
    return false;
  }
  return carriesNoUnsupportedValues(value);
}

function carriesNoUnsupportedValues(value: unknown): boolean {
  const type = typeof value;
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') {
    return false;
  }
  if (value === null || type !== 'object') return true;
  if (Array.isArray(value)) return value.every(carriesNoUnsupportedValues);
  return Object.values(value as Record<string, unknown>).every(carriesNoUnsupportedValues);
}

/**
 * Build a valid draft, or say exactly why it cannot be.
 *
 * The order is deliberate: **required fields first**, because a draft with no
 * action is refused as `action-missing` and not as `action-too-long` — a
 * caller debugging a missing field should not be handed a bound. Then shape,
 * then size, and the snapshots last because they are the only check that can
 * itself throw.
 */
export function createAuditRecord(input: AuditRecordInput): AuditRecordCreation {
  const action = text(input.action);
  if (action === null) return { ok: false, reason: 'action-missing' };
  if (hasControlChars(action)) return { ok: false, reason: 'action-malformed' };
  if (action.length > ACTION_MAX) return { ok: false, reason: 'action-too-long' };

  const module = text(input.module);
  if (module === null) return { ok: false, reason: 'module-missing' };
  if (hasControlChars(module)) return { ok: false, reason: 'module-malformed' };
  if (module.length > MODULE_MAX) return { ok: false, reason: 'module-too-long' };

  const correlationId = text(input.correlationId);
  if (correlationId === null) return { ok: false, reason: 'correlation-missing' };
  // Charset and bound are separate rejections, because the two have different
  // remedies and a caller debugging one should not be handed the other. The
  // interceptor header check collapses both into one yes/no through
  // `isStorableCorrelationId` above, which is the same rule read from the
  // other side.
  if (!CORRELATION_CHARS.test(correlationId)) return { ok: false, reason: 'correlation-malformed' };
  if (correlationId.length > CORRELATION_MAX) return { ok: false, reason: 'correlation-too-long' };

  for (const identifier of [
    input.actorId,
    input.actorRole,
    input.ipAddress,
    input.entityType,
    input.entityId,
  ]) {
    const value = text(identifier);
    if (value !== null && hasControlChars(value)) {
      return { ok: false, reason: 'identifier-malformed' };
    }
    if (value !== null && value.length > IDENTIFIER_MAX) {
      return { ok: false, reason: 'identifier-too-long' };
    }
  }

  const deviceInfo = text(input.deviceInfo);
  if (deviceInfo !== null && deviceInfo.length > DEVICE_MAX) {
    return { ok: false, reason: 'device-too-long' };
  }

  const reason = text(input.reason);
  if (reason !== null && reason.length > REASON_MAX) {
    return { ok: false, reason: 'reason-too-long' };
  }

  // An absent snapshot is absent, not malformed: the writer supplies the
  // fields it knows and omits the rest, and the mapping below turns an absent
  // one into `null` rather than refusing the record.
  for (const value of [input.beforeValue, input.afterValue]) {
    if (value === undefined) continue;
    if (!snapshotSerialisable(value)) return { ok: false, reason: 'snapshot-not-serialisable' };
  }

  return {
    ok: true,
    record: {
      action,
      module,
      correlationId,
      actorId: text(input.actorId),
      actorRole: text(input.actorRole),
      ipAddress: text(input.ipAddress),
      deviceInfo,
      entityType: text(input.entityType),
      entityId: text(input.entityId),
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      reason,
    },
  };
}
