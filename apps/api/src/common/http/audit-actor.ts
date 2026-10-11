/**
 * What a handler declares about the action it just performed, for the audit
 * record the interceptor will write (`PLT-402`).
 *
 * ## Why a handler attaches anything at all
 *
 * The interceptor reads the actor from the principal `SessionGuard` attached.
 * That works on every authenticated route and on exactly none of the ones
 * that matter most here: `/auth/login`, `/auth/oidc/callback` and
 * `/auth/setup/complete` are `@Public` — they are the routes that CREATE the
 * principal an authenticated route would read. Left alone, every successful
 * sign-in would produce an audit row nobody performed.
 *
 * So the handler, at the one moment it knows who it just authenticated,
 * declares it. This is not audit-write code — the story's promise that a
 * developer adds "the decorator and a reason field" is about the RECORD, and
 * these two lines are the record's subject, the same way `@Body()` is the
 * record's input.
 *
 * ## What this is deliberately NOT
 *
 * Not a second authentication path. `SessionGuard` attaches `principal` after
 * verifying a session server-side; anything attached here is the handler's own
 * assertion about a request it already refused-or-accepted. The interceptor
 * reads it only on the SUCCESS path, and never for a failed request — see
 * `audit.interceptor.ts` for why that direction matters.
 *
 * `PrincipalCarrier` in `session.guard.ts` is the same shape for the same
 * reason, and stays the same shape: one request object, two named slots, no
 * shared mutable state.
 */

/** Who performed the action, when the handler knows and no principal does. */
export interface AuditActor {
  /** The local account the handler authenticated or acted as. */
  readonly userId: string;
}

/** What the action was performed on, when the handler knows. */
export interface AuditSubject {
  readonly entityType: string;
  readonly entityId: string;
}

/**
 * The audit subject for an authentication action: the account it acted on.
 *
 * A helper rather than an inline literal, so the controllers that attach one
 * cannot drift into three spellings of "a user" — and so the entity type has
 * one definition to grep when the first module with its own subjects arrives.
 */
export function auditSubjectFor(userId: string): AuditSubject {
  return { entityType: 'user', entityId: userId };
}

/** The slice of a request these attachments live on. */
export interface AuditCarrier {
  auditActor?: AuditActor | undefined;
  auditSubject?: AuditSubject | undefined;
}

/** Declare the actor. Called after a successful sign-in, and nowhere else. */
export function attachAuditActor(carrier: AuditCarrier, actor: AuditActor): void {
  carrier.auditActor = actor;
}

/** Declare the entity subject. Called where the handler knows what it acted on. */
export function attachAuditSubject(carrier: AuditCarrier, subject: AuditSubject): void {
  carrier.auditSubject = subject;
}

/** The declared actor, or `null`. Never throws: absence is a normal state on a @Public route. */
export function readAuditActor(carrier: AuditCarrier | null | undefined): AuditActor | null {
  return carrier?.auditActor ?? null;
}

/** The declared subject, or `null`. */
export function readAuditSubject(carrier: AuditCarrier | null | undefined): AuditSubject | null {
  return carrier?.auditSubject ?? null;
}
