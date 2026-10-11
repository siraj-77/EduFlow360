import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditModule } from './audit.module.js';
import { IAUDIT_REPOSITORY } from './domain/repositories/audit-repository.js';
import { IREASON_POLICY } from './domain/ports/reason-policy.js';
import { FrozenReasonPolicy } from './domain/services/reason-policy.js';
import { PrismaAuditRepository } from './infrastructure/postgres/prisma-audit-repository.js';
import { TEST_ENVIRONMENT } from '../../testing/test-environment.js';
import type { AppConfig } from '../../config/env.js';

/**
 * `AuditModule` — the two states, and the boot proof (`PLT-401` wiring).
 *
 * ## Why this spec builds the real module rather than inspecting the return
 *
 * `rbac.module.spec.ts` records why: a spec that inspects the returned object
 * "misses the class of defect the audit-repository itself surfaced —
 * `UnknownExportException` at BOOT". A provider and its `exports` entry are
 * two lines that must name the same symbol, and only booting proves they do.
 *
 * ## The two states
 *
 * | state | `IAUDitRepository` | effect on an `@Audited` route |
 * |---|---|---|
 * | no `DATABASE_URL` | not registered | the interceptor REFUSES the request |
 * | `DATABASE_URL` | registered | the record is written |
 *
 * The absent case is a supported configuration (`ADR-019`): a Google-only
 * deployment has no database, no session repository, and `SessionGuard`
 * refuses every authenticated route before an audited one is reached. The
 * interceptor is registered with `@Optional()` dependencies so the container
 * still boots — and a route that somehow IS reached is refused by name rather
 * than silently unrecorded.
 */

/** A valid persistence configuration: a database AND the school it belongs to. */
const withDb = (): AppConfig =>
  ({
    ...TEST_ENVIRONMENT,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/eduflow_test',
    SCHOOL_ID: randomUUID(),
  }) as AppConfig;
const withoutDb = (): AppConfig => TEST_ENVIRONMENT as AppConfig;

/**
 * Boot the module inside a real Nest module graph, and resolve from it.
 *
 * `resolveOptional` swallows the "provider does not exist" throw and answers
 * `undefined` instead, because Nest's `get` still throws for an absent token
 * even with `{ strict: false }` — the flag relaxes which CONTEXT is searched,
 * not whether a missing provider is an error.
 */
async function resolveFrom(config: AppConfig, token: unknown): Promise<unknown> {
  @Module({ imports: [AuditModule.forRoot(config)] })
  class Host {}

  const moduleRef = await Test.createTestingModule({ imports: [Host] }).compile();
  return moduleRef.get(token as never, { strict: false });
}

/** The resolution above, with a missing provider reported as `undefined`. */
async function resolveOptional(config: AppConfig, token: unknown): Promise<unknown> {
  @Module({ imports: [AuditModule.forRoot(config)] })
  class Host {}

  try {
    const moduleRef = await Test.createTestingModule({ imports: [Host] }).compile();
    return moduleRef.get(token as never, { strict: false });
  } catch (error) {
    if (error instanceof Error && /could not find|does not exist/i.test(error.message)) {
      return undefined;
    }
    throw error;
  }
}

describe('AuditModule — with DATABASE_URL', () => {
  it('resolves a real PrismaAuditRepository for IAUDIT_REPOSITORY', async () => {
    const resolved = await resolveFrom(withDb(), IAUDIT_REPOSITORY);

    expect(resolved).toBeInstanceOf(PrismaAuditRepository);
  });

  it('resolves the frozen default policy for IREASON_POLICY', async () => {
    const resolved = await resolveFrom(withDb(), IREASON_POLICY);

    expect(resolved).toBeInstanceOf(FrozenReasonPolicy);
  });
});

describe('AuditModule — without DATABASE_URL', () => {
  it('registers no repository, so the interceptor would refuse by name', async () => {
    const resolved = await resolveOptional(withoutDb(), IAUDIT_REPOSITORY);

    expect(resolved).toBeUndefined();
  });

  it('registers no policy either, so nothing can demand a reason silently', async () => {
    const resolved = await resolveOptional(withoutDb(), IREASON_POLICY);

    expect(resolved).toBeUndefined();
  });
});
