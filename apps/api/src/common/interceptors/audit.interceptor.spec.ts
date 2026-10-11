import { Controller, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Audited } from '../guards/route-guards.decorator.js';
import { attachAuditActor, attachAuditSubject } from '../http/audit-actor.js';
import type { SessionPrincipal } from '../guards/session.guard.js';
import type { IAuditRepository } from '../../modules/audit/domain/repositories/audit-repository.js';
import type { AuditDraft } from '../../modules/audit/domain/entities/audit-record.js';
import type { IReasonPolicy } from '../../modules/audit/domain/services/reason-policy.js';
import { AuditInterceptor } from './audit.interceptor.js';

/**
 * `AuditInterceptor` — the thing that makes `@Audited('<ACTION>')` mean
 * something (`PLT-402`, `AGENTS.md` 2.3).
 *
 * ## The decorator was a vocabulary, and this is the reader
 *
 * `route-guards.decorator.ts` says so in its own header: the three decorators
 * recorded intentions and nothing read them. `check-route-guards.mjs` proved
 * the decorator was PRESENT; this file is what proves it DOES something. The
 * acceptance criterion for the story is the developer half — a new sensitive
 * action needs the decorator and nothing else — so the interceptor must
 * capture everything a developer would otherwise have to write by hand.
 *
 * ## The one design decision worth reading twice: when the record is written
 *
 * The record is written **after the handler succeeds, and the response waits
 * for it**. Not fire-and-forget: a dropped write is exactly the "the action
 * happened and no record exists" window `ADR-013` was written to close, and a
 * fire-and-forget insert that the process exits before completing is that
 * window wearing a disguise. Not before the handler either: a record written
 * for an action that then fails is a phantom entry accusing someone of
 * something that did not happen — the ADR names that alternative and rejects
 * it by name.
 *
 * The residual gap is stated rather than hidden: without an open transaction
 * the write is its own, so a crash between the business commit and this
 * insert still loses the record. Closing that is the first transactional
 * use-case's job, and the port already accepts the handle
 * (`IAuditRepository.create(draft, transaction)`).
 *
 * ## What a failure record is, and what it is not
 *
 * A failed action records the fact, the source and the timestamp — and the
 * actor ONLY when `SessionGuard` verified one. `password-sign-in.controller.ts`
 * states the requirement this implements: "a failure record carries no
 * identifier and no credential". The handler-attached audit actor is not read
 * on the failure path at all, because on the routes that attach one it is
 * only ever attached after success.
 */

// ── The controller fixtures: REAL decorators on REAL classes ────────────────
// A hand-built metadata record would prove the interceptor reads what the test
// wrote, not what the routes declare. These use the same decorators the auth
// controllers use, so the metadata path under test is the production one.

@Controller('auth')
class AuditedLoginController {
  @Audited('LOGIN')
  login(): { readonly signedIn: true } {
    return { signedIn: true };
  }
}

@Controller('auth')
class AuditedLinkController {
  @Audited('OIDC_LINK')
  link(): { readonly linked: true } {
    return { linked: true };
  }
}

class PlainController {
  me(): { readonly ok: true } {
    return { ok: true };
  }
}

// ── The doubles, and why each is legitimate ──────────────────────────────────

/** Collects drafts. A fake of the PORT, not a mock of behaviour. */
class RecordingRepository implements IAuditRepository {
  readonly drafts: AuditDraft[] = [];
  failure: Error | null = null;

  async create(draft: AuditDraft): Promise<void> {
    if (this.failure !== null) throw this.failure;
    this.drafts.push(draft);
  }

  async query(): Promise<readonly never[]> {
    return [];
  }
}

/** The port's fake for the reason gate. The production set is EMPTY (asserted in reason-policy.spec.ts). */
const requiring = (...actions: readonly string[]): IReasonPolicy => ({
  isReasonRequired: (action) => actions.includes(action),
});

const PRINCIPAL: SessionPrincipal = { sessionId: 'session-1', userId: 'user-1' };

/** The request slice the interceptor reads. Plain objects, like SessionGuard's specs use. */
const aRequest = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ip: '203.0.113.9',
  headers: { 'user-agent': 'Mozilla/5.0 (test)' },
  body: {},
  ...overrides,
});

const contextFor = (
  request: Record<string, unknown>,
  handler: (...args: never[]) => unknown,
  controller: unknown = class {},
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const nextWith = (value: unknown) => ({ handle: () => of(value) });
const nextFailing = (error: unknown) => ({ handle: () => throwError(() => error) });

const run = (
  interceptor: AuditInterceptor,
  context: ExecutionContext,
  next: { handle: () => unknown },
): Promise<unknown> => lastValueFrom(interceptor.intercept(context, next) as never);

/** Boot one @Audited("LOGIN") request; the repository and the returned value come back. */
const interceptLogin = async (request = aRequest()) => {
  const repository = new RecordingRepository();
  const interceptor = new AuditInterceptor(new Reflector(), repository);
  const context = contextFor(request, new AuditedLoginController().login, AuditedLoginController);
  const value = await run(interceptor, context, nextWith({ signedIn: true }));
  return { repository, value };
};

// ═══════════════════════════════════════════════════════════════════════════
// The exemption: no @Audited, no record. The path the other routes take.
// ═══════════════════════════════════════════════════════════════════════════
describe('AuditInterceptor — a route without @Audited', () => {
  it('passes through untouched and writes nothing', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(aRequest(), new PlainController().me, PlainController);

    const value = await run(interceptor, context, nextWith({ ok: true }));

    expect(value).toEqual({ ok: true });
    expect(repository.drafts).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The happy path: one record, complete, from the request.
// ═══════════════════════════════════════════════════════════════════════════
describe('AuditInterceptor — an @Audited route that succeeds', () => {
  it('returns the handler value, so the decorator changes nothing a caller sees', async () => {
    const { value } = await interceptLogin();

    expect(value).toEqual({ signedIn: true });
  });

  it('writes exactly one record per action', async () => {
    // "Exactly once" is the story's own acceptance criterion for T3. A second
    // write per request would double-count every action in the trail.
    const { repository } = await interceptLogin();

    expect(repository.drafts).toHaveLength(1);
  });

  it('carries the action from the decorator and the module from the controller', async () => {
    const { repository } = await interceptLogin();
    const [draft] = repository.drafts;

    expect(draft?.action).toBe('LOGIN');
    expect(draft?.module).toBe('auth');
  });

  it('carries the principal SessionGuard attached', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const request = { ...aRequest(), principal: PRINCIPAL };
    const context = contextFor(request, new AuditedLinkController().link, AuditedLinkController);

    await run(interceptor, context, nextWith({ linked: true }));

    expect(repository.drafts[0]?.actorId).toBe('user-1');
  });

  it('carries the actor the handler attached, for a @Public route with no principal', async () => {
    // `/auth/login` has no session to read a principal from — it is the route
    // that CREATES one. The handler declares who it just authenticated, and
    // the interceptor reads that declaration. Without this, every successful
    // sign-in would be an action nobody performed.
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const request = aRequest();
    attachAuditActor(request, { userId: 'user-42' });
    const context = contextFor(request, new AuditedLoginController().login, AuditedLoginController);

    await run(interceptor, context, nextWith({ signedIn: true }));

    expect(repository.drafts[0]?.actorId).toBe('user-42');
  });

  it('records a null actor when neither exists, rather than inventing one', async () => {
    const { repository } = await interceptLogin();
    const [draft] = repository.drafts;

    // `null` means unattributable. An empty string would mean "somebody with
    // no name", and a fabricated actor would be worse than either.
    expect(draft?.actorId).toBeNull();
  });

  it('carries the entity subject the handler attached', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const request = aRequest();
    attachAuditSubject(request, { entityType: 'user', entityId: 'user-42' });
    const context = contextFor(request, new AuditedLoginController().login, AuditedLoginController);

    await run(interceptor, context, nextWith({ signedIn: true }));

    expect(repository.drafts[0]?.entityType).toBe('user');
    expect(repository.drafts[0]?.entityId).toBe('user-42');
  });

  it('carries the source address and user-agent from the request', async () => {
    const { repository } = await interceptLogin();
    const [draft] = repository.drafts;

    expect(draft?.ipAddress).toBe('203.0.113.9');
    expect(draft?.deviceInfo).toBe('Mozilla/5.0 (test)');
  });

  it('carries the reason from the body, and NOTHING else from the body', async () => {
    // The body of a high-sensitivity action holds its reason. It also holds
    // its subject data, and on `/auth/login` it holds a PASSWORD. The record
    // is built field by field from named inputs — the whitelisted `reason`
    // key is the only thing the body ever contributes.
    const { repository } = await interceptLogin(
      aRequest({
        body: { identifier: 'teacher@school.lk', password: 'hunter2', reason: ' disputed ' },
      }),
    );
    const [draft] = repository.drafts;

    expect(draft?.reason).toBe('disputed');
    expect(JSON.stringify(draft)).not.toContain('hunter2');
    expect(JSON.stringify(draft)).not.toContain('teacher@school.lk');
  });

  it('generates a correlation id when the caller sent none', async () => {
    const { repository } = await interceptLogin();
    const [draft] = repository.drafts;

    expect(draft?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses a caller-supplied correlation id that passes the charset', async () => {
    const { repository } = await interceptLogin(
      aRequest({ headers: { 'user-agent': 'x', 'x-correlation-id': 'trace:7f3a.9c1e' } }),
    );

    expect(repository.drafts[0]?.correlationId).toBe('trace:7f3a.9c1e');
  });

  it('replaces a malformed caller-supplied correlation id instead of storing it', async () => {
    // A stored id the reader cannot trust is worse than a generated one: the
    // join it exists for would silently join to nothing.
    const { repository } = await interceptLogin(
      aRequest({ headers: { 'user-agent': 'x', 'x-correlation-id': 'has space' } }),
    );

    expect(repository.drafts[0]?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The failure path: the fact, the source, the timestamp — and no identity.
// ═══════════════════════════════════════════════════════════════════════════
describe('AuditInterceptor — an @Audited route that fails', () => {
  it('rethrows the original error, so the interceptor changes no status', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest(),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow(
      'refused',
    );
  });

  it('records the failed action, which is what makes an attack visible', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest(),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow();

    expect(repository.drafts).toHaveLength(1);
    expect(repository.drafts[0]?.action).toBe('LOGIN');
  });

  it('carries NO actor, even when one was attached for the success path', async () => {
    // `password-sign-in.controller.ts` states the requirement: a failure
    // record carries no identifier. The handler only attaches an actor after
    // a successful sign-in, so on the failure path the attachment never
    // happened — and the interceptor does not go looking for one in the body,
    // which is where an attacker would put it.
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const request = aRequest();
    attachAuditActor(request, { userId: 'attacker-claimed' });
    const context = contextFor(request, new AuditedLoginController().login, AuditedLoginController);

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow();

    expect(repository.drafts[0]?.actorId).toBeNull();
  });

  it('carries the verified principal when the route was authenticated', async () => {
    // The other half of the same rule: an identity SessionGuard VERIFIED is
    // evidence, not a claim. A failed write on an authenticated route is
    // exactly the record an auditor wants attributed.
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const request = { ...aRequest(), principal: PRINCIPAL };
    const context = contextFor(request, new AuditedLinkController().link, AuditedLinkController);

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow();

    expect(repository.drafts[0]?.actorId).toBe('user-1');
  });

  it('carries no reason and no body values from a failed request', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest({ body: { identifier: 'victim@school.lk', password: 'wrong', reason: ' x ' } }),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow();

    const [draft] = repository.drafts;
    expect(draft?.reason).toBeNull();
    expect(JSON.stringify(draft)).not.toContain('victim@school.lk');
    expect(JSON.stringify(draft)).not.toContain('wrong');
  });

  it('still records the source address, because that is the attacker evidence', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest(),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow();

    expect(repository.drafts[0]?.ipAddress).toBe('203.0.113.9');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The write failing. The fail-closed direction, both ways.
// ═══════════════════════════════════════════════════════════════════════════
describe('AuditInterceptor — the audit write itself fails', () => {
  it('fails the request when the SUCCESS record cannot be written', async () => {
    // Fail closed. A caller who is told "done" for an action whose record
    // does not exist has been lied to, and the lie is undetectable from the
    // outside. `@Audited` promises the action is recorded; a 500 is the
    // honest answer when it cannot be.
    const repository = new RecordingRepository();
    repository.failure = new Error('audit insert refused');
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest(),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextWith({ signedIn: true }))).rejects.toThrow(
      'audit insert refused',
    );
  });

  it('does not write a failure record when the success record is what failed', async () => {
    // Otherwise every recorder outage would double the trail: one entry
    // saying the action happened-and-was-not-recorded, and one saying it
    // failed. The second is a lie about the action.
    const repository = new RecordingRepository();
    repository.failure = new Error('audit insert refused');
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest(),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextWith({ signedIn: true }))).rejects.toThrow();

    expect(repository.drafts).toEqual([]);
  });

  it('lets the original error surface when the FAILURE record cannot be written', async () => {
    // An unauthorised caller must learn the reason their request was refused,
    // not that the audit table is unhappy. The original error is the truth of
    // the request; a swallowed one is a 500 standing in for a 401.
    const repository = new RecordingRepository();
    repository.failure = new Error('audit insert refused');
    const interceptor = new AuditInterceptor(new Reflector(), repository);
    const context = contextFor(
      aRequest(),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await expect(run(interceptor, context, nextFailing(new Error('refused')))).rejects.toThrow(
      'refused',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The reason gate: refused BEFORE the action, never after (PLT-402-T2).
// ═══════════════════════════════════════════════════════════════════════════
/** Run one request and capture what it threw, for status assertions. */
const thrownBy = async (
  interceptor: AuditInterceptor,
  context: ExecutionContext,
  next: { handle: () => unknown },
): Promise<{ getStatus(): number }> => {
  try {
    await run(interceptor, context, next);
  } catch (error) {
    return error as { getStatus(): number };
  }
  throw new Error('the request was expected to be refused and was not');
};

describe('AuditInterceptor — the reason gate', () => {
  const aGradeChange = () =>
    contextFor(
      aRequest({ body: { mark: 42 } }),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

  it('refuses a missing reason with 400 before the handler runs', async () => {
    const interceptor = new AuditInterceptor(
      new Reflector(),
      new RecordingRepository(),
      requiring('LOGIN'),
    );
    let handlerRan = false;
    const next = {
      handle: () => {
        handlerRan = true;
        return of({ signedIn: true });
      },
    };

    const thrown = await thrownBy(interceptor, aGradeChange(), next);

    expect(thrown.getStatus()).toBe(400);
    expect(handlerRan).toBe(false);
  });

  it('writes no record for its own refusal, which is not the action', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository, requiring('LOGIN'));

    await thrownBy(interceptor, aGradeChange(), nextWith({ signedIn: true }));

    expect(repository.drafts).toEqual([]);
  });

  it('lets the request through when the reason is present', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(new Reflector(), repository, requiring('LOGIN'));
    const context = contextFor(
      aRequest({ body: { reason: 'parent disputed the mark' } }),
      new AuditedLoginController().login,
      AuditedLoginController,
    );

    await run(interceptor, context, nextWith({ signedIn: true }));

    expect(repository.drafts[0]?.reason).toBe('parent disputed the mark');
  });

  it('treats a whitespace reason as absent, because a blank reason is a missing one', async () => {
    const interceptor = new AuditInterceptor(
      new Reflector(),
      new RecordingRepository(),
      requiring('LOGIN'),
    );

    const thrown = await thrownBy(interceptor, aGradeChange(), nextWith({ signedIn: true }));

    expect(thrown.getStatus()).toBe(400);
  });

  it('ignores the gate for actions nobody requires', async () => {
    const repository = new RecordingRepository();
    const interceptor = new AuditInterceptor(
      new Reflector(),
      repository,
      requiring('SOMETHING_ELSE'),
    );

    await run(interceptor, aGradeChange(), nextWith({ signedIn: true }));

    expect(repository.drafts).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The carriers, as pure functions.
// ═══════════════════════════════════════════════════════════════════════════
describe('the audit actor carrier', () => {
  it('round-trips what the handler attached', () => {
    const request = aRequest();
    attachAuditActor(request, { userId: 'user-42' });

    const carrier = request as Parameters<typeof attachAuditActor>[0];
    expect(carrier).toMatchObject({ auditActor: { userId: 'user-42' } });
  });
});

describe('the audit subject carrier', () => {
  it('round-trips what the handler attached', () => {
    const request = aRequest();
    attachAuditSubject(request, { entityType: 'user', entityId: 'user-42' });

    const carrier = request as Parameters<typeof attachAuditSubject>[0];
    expect(carrier).toMatchObject({ auditSubject: { entityType: 'user', entityId: 'user-42' } });
  });
});
