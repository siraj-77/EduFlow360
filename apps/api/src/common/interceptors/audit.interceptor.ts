import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { AUDIT_KEY } from '../guards/route-guards.decorator.js';
import type { MetadataTarget } from '../guards/session.guard.js';
import {
  readAuditActor,
  readAuditSubject,
  type AuditCarrier,
  type AuditSubject,
} from '../http/audit-actor.js';
import { toDeviceContext, type RequestWithAddress } from '../http/request-context.js';
import type { PrincipalCarrier } from '../guards/session.guard.js';
import {
  IAUDIT_REPOSITORY,
  type IAuditRepository,
} from '../../modules/audit/domain/repositories/audit-repository.js';
import {
  createAuditRecord,
  isStorableCorrelationId,
  type AuditDraft,
} from '../../modules/audit/domain/entities/audit-record.js';
import {
  IREASON_POLICY,
  type IReasonPolicy,
} from '../../modules/audit/domain/ports/reason-policy.js';

/**
 * `AuditInterceptor` — the reader that makes `@Audited('<ACTION>')` a control
 * rather than a comment (`PLT-402`, `AGENTS.md` 2.3, `ADR-013`).
 *
 * ## Registered globally, because anything else is the failure this repo has
 * already paid for
 *
 * `app.module.ts` registers it with `APP_INTERCEPTOR`, exactly as it registers
 * the three guards. A developer adding a sensitive action writes the decorator
 * and nothing else — which is the story's acceptance criterion, and which
 * per-controller opt-in registration would quietly not deliver. A control
 * whose absence from a file is invisible in review is not a control.
 *
 * ## The one thing it will not do: capture a snapshot
 *
 * `before_value` / `after_value` are `null` from this interceptor, always. A
 * snapshot requires reading the state BEFORE the action and again after, and
 * the only layer that can do that is the use-case that performs the change —
 * an interceptor sees a request, not a transaction. The columns exist, the
 * entity validates them, and the mechanism that fills them arrives with the
 * first state-changing use-case (`AGENTS.md` 6: a gap is recorded, not filled
 * with an invented design). What this file guarantees is the row EXISTS, with
 * who, from where, when, and why.
 *
 * ## Fail-closed, in both directions
 *
 * The success record failing fails the REQUEST (the caller was told "done" for
 * an action with no record — a lie that is undetectable from outside). The
 * FAILURE record failing does not: the original error is what the caller must
 * learn, and a swallowed 401 replaced by a 500 about the audit table is a
 * debugging trap. Both directions are asserted in the spec.
 */

/** A request carrying everything this interceptor reads. */
export interface AuditableRequest
  extends RequestWithAddress, AuditCarrier, Partial<PrincipalCarrier> {
  readonly headers?: Record<string, string | string[] | undefined> | undefined;
  readonly body?: unknown;
}

/** The header a caller may use to supply its own correlation id. */
const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Nest's metadata key for a controller's route prefix — `'path'`.
 *
 * Declared here because `@nestjs/common`'s v11 `index.js` re-exports only FOUR
 * constants from `./constants` (`APP_FILTER`, `APP_GUARD`, `APP_INTERCEPTOR`,
 * `APP_PIPE`) even though `index.d.ts` declares `PATH_METADATA`. Importing it
 * therefore yields `undefined` at runtime while `tsc`, lint and the build all
 * pass — and the first `reflector.get` call throws
 * `Cannot read properties of undefined (reading 'KEY')`, which names nothing
 * useful. The value is the literal `@Controller()` writes through
 * `SetMetadata`; restating it is restating the framework's contract, not
 * inventing a key, and the spec below asserts the round trip against a real
 * `@Controller` decorator so a rename in Nest fails here.
 */
const PATH_METADATA = 'path';

/**
 * The 400 body for a missing reason, as ONE frozen constant.
 *
 * It names the field and nothing else: not the action (which would confirm
 * which sensitive actions exist), not the record. A caller who can trigger
 * this already knows what they called.
 */
const MISSING_REASON_BODY = Object.freeze({
  statusCode: 400,
  error: 'Bad Request',
  message: 'This action requires a reason, and the request did not carry one.',
});

/**
 * Read the `@Audited` action off a route, or `null` if it carries none.
 *
 * **Handler first, then class** — the same order `isPublicRoute` uses, for the
 * same reason: it is what stops one audited method from marking its whole
 * controller, and one marked controller from being overridden by an unmarked
 * method.
 *
 * Exported as a pure function so the rule is testable without an application
 * context, the arrangement `SessionGuard` and `CsrfGuard` both use.
 */
export function readAuditAction(reflector: Reflector, targets: readonly unknown[]): string | null {
  const action = reflector.getAllAndOverride<string | undefined>(
    AUDIT_KEY,
    // Narrowed with a predicate rather than declared `Function`, which this
    // repository bans; `typeof === 'function'` is the same test Nest's own
    // injector performs, and a non-callable target carries no metadata, so
    // dropping it changes no answer.
    targets.filter(
      (target): target is (...args: never[]) => unknown => typeof target === 'function',
    ),
  );

  return typeof action === 'string' && action.length > 0 ? action : null;
}

/**
 * The module this route belongs to: its controller's route prefix.
 *
 * `@Controller('auth')` is what puts the route under `/auth`, so it is what
 * the record should say. A controller with no prefix yields `''`, which the
 * entity refuses — a route that cannot name its own module is a wiring fault,
 * and it is reported as one at write time rather than stored as a blank.
 */
export function auditModuleOf(reflector: Reflector, controller: MetadataTarget): string {
  const prefix = reflector.get<string>(PATH_METADATA, controller);
  return typeof prefix === 'string' ? prefix : '';
}

/**
 * The caller's correlation id, when it supplied a usable one, and a fresh one
 * otherwise.
 *
 * Accepting the header at all is what makes the join to `error_logs`
 * (`PLT-501`) and to any upstream trace possible; REJECTING a malformed one
 * rather than storing it is what keeps that join trustworthy. A stored id the
 * reader cannot use is worse than one this system minted.
 */
export function correlationIdFor(request: AuditableRequest): string {
  const header = request.headers?.[CORRELATION_HEADER];
  // A duplicate header arrives as an array; the first is the one the caller
  // set first, and picking any other would be picking by attacker preference.
  const value = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isStorableCorrelationId(trimmed)) return trimmed;
  }

  return randomUUID();
}

/**
 * The whitelisted read of the request body.
 *
 * ONE key, `reason`. A body holds its subject's fields — and on
 * `/auth/login` it holds a PASSWORD — and an audit record is not a place any
 * of that may travel to. Everything below is a named, typed field, so the
 * body contributes exactly this one string and nothing else can.
 */
export function reasonOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const reason = (body as { reason?: unknown }).reason;
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** The verified principal, if `SessionGuard` attached one. Never throws. */
function principalOf(request: AuditableRequest): PrincipalCarrier['principal'] | null {
  return (request as PrincipalCarrier).principal ?? null;
}

/** The device slice: address when there is one, user-agent when there is one, nulls otherwise. */
function deviceOf(request: AuditableRequest): {
  readonly ipAddress: string | null;
  readonly deviceInfo: string | null;
} {
  const device = toDeviceContext(request);
  return {
    // `null`, not the throttle's `'unknown-source'`: a throttle NEEDS one
    // shared bucket for unaddressable callers, and an audit row needs to know
    // that the address was unknown. Two different jobs.
    ipAddress: device.device?.ipAddress ?? null,
    deviceInfo: device.device?.userAgent ?? null,
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Optional()
    @Inject(IAUDIT_REPOSITORY)
    private readonly repository?: IAuditRepository,
    @Optional()
    @Inject(IREASON_POLICY)
    private readonly reasonPolicy?: IReasonPolicy,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = readAuditAction(this.reflector, [context.getHandler(), context.getClass()]);
    if (action === null) return next.handle();

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const module = auditModuleOf(this.reflector, context.getClass());

    // The reason gate fires BEFORE the handler is called at all —
    // `ADR-013`: "rejected with 400 when reason is absent — the rejection
    // happens before the transaction opens". A reason demanded after the
    // action is a reason nobody gives.
    if (this.reasonPolicy?.isReasonRequired(action) === true && reasonOf(request.body) === null) {
      throw new BadRequestException(MISSING_REASON_BODY);
    }

    // The observable is built from a promise rather than piped, so the
    // sequencing below is plain sequential code: run, record, release. A
    // fire-and-forget write is the failure mode this avoids.
    return from(this.recorded(next, request, module, action));
  }

  /**
   * Run the handler, write exactly one record for its outcome, and only then
   * let the response through.
   */
  private async recorded(
    next: CallHandler,
    request: AuditableRequest,
    module: string,
    action: string,
  ): Promise<unknown> {
    let value: unknown;

    try {
      value = await lastValueFrom(next.handle());
    } catch (error) {
      // The failure record is best-effort ON PURPOSE: the original error is
      // what the caller must learn, and a recorder outage must not replace a
      // 401 with a 500 about the audit table. It is reported, not swallowed.
      try {
        await this.write(request, module, action, {
          actor: principalOf(request)?.userId ?? null,
          subject: null,
          reason: null,
        });
      } catch (recordError) {
        console.error(
          `AuditInterceptor could not record the failure of ${action}: ` +
            `${recordError instanceof Error ? recordError.message : String(recordError)}. ` +
            'The request still fails with its original error.',
        );
      }
      throw error;
    }

    // The success record is NOT best-effort. A caller told "done" for an
    // action with no record has been lied to in the one direction this
    // control exists to prevent.
    await this.write(request, module, action, {
      // Handler-declared actor only here: on the success path the handler has
      // had the chance to say who it authenticated. Never read on the failure
      // path — `password-sign-in.controller.ts` states why.
      actor: principalOf(request)?.userId ?? readAuditActor(request)?.userId ?? null,
      subject: readAuditSubject(request),
      reason: reasonOf(request.body),
    });

    return value;
  }

  /**
   * Validate the draft through the domain and append it. Throws when it
   * cannot — which is the fail-closed behaviour the callers above implement.
   */
  private async write(
    request: AuditableRequest,
    module: string,
    action: string,
    captured: {
      readonly actor: string | null;
      readonly subject: AuditSubject | null;
      readonly reason: string | null;
    },
  ): Promise<void> {
    if (this.repository === undefined) {
      // A no-database deployment reached an @Audited route. Refusing is the
      // only honest answer: the route promised a record and there is nowhere
      // to put one, and the alternative is an action that looks audited and
      // is not. `AuditModule.forRoot` registers no repository without
      // `DATABASE_URL`, and every such deployment's routes are `@Public`
      // sign-in routes that cannot produce a session anyway.
      throw new Error(
        `No ${String(IAUDIT_REPOSITORY.description)} is registered, so the @Audited(${action}) ` +
          'record cannot be written. This is a wiring fault, not a caller error: either the ' +
          'deployment has no DATABASE_URL, or AuditModule was not registered.',
      );
    }

    const device = deviceOf(request);
    const draft: AuditDraft = {
      action,
      module,
      correlationId: correlationIdFor(request),
      actorId: captured.actor,
      actorRole: null,
      ipAddress: device.ipAddress,
      deviceInfo: device.deviceInfo,
      entityType: captured.subject?.entityType ?? null,
      entityId: captured.subject?.entityId ?? null,
      beforeValue: null,
      afterValue: null,
      reason: captured.reason,
    };

    const creation = createAuditRecord(draft);
    if (!creation.ok) {
      throw new Error(
        `The @Audited(${action}) record was refused by the domain (${creation.reason}). ` +
          'This is a wiring fault: the interceptor built a record the entity will not accept.',
      );
    }

    await this.repository.create(creation.record);
  }
}
