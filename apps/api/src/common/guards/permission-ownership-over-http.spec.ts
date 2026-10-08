import { Controller, Get, Injectable, type CanActivate } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from './permission.guard.js';
import { OwnsResource } from './owns-resource.decorator.js';
import { RequirePermission } from './route-guards.decorator.js';
import { attachPrincipal } from './session.guard.js';
import {
  IPERMISSION_GRANT_READER,
  type IPermissionGrantReader,
} from '../../modules/rbac/domain/ports/permission-grant-reader.js';
import { IOWNERSHIP_POLICY_REGISTRY } from '../../modules/rbac/domain/ports/ownership-policy.js';
import { StaticOwnershipPolicyRegistry } from '../../modules/rbac/infrastructure/adapters/static-ownership-policy-registry.js';
import {
  FakeOwnershipPolicy,
  RecordingOwnershipPolicyRegistry,
  type OwnedRecord,
} from '../../testing/fake-ownership-policy.js';

/**
 * `PLT-203` over a real socket: the three negative security tests, plus the composition
 * claims that only a real request can settle.
 *
 * ## Why this file exists rather than more unit tests on the guard
 *
 * `decide-ownership.spec.ts` proves the RULE. This file proves the rule is **wired**, and
 * three specific things about the wiring are invisible from a unit test with a mocked
 * `ExecutionContext`:
 *
 * 1. `PermissionGuard` actually reads `@OwnsResource` from real route metadata.
 * 2. Role is asked **before** scope, so a caller who lacks the permission is never told
 *    whether they would also have failed ownership.
 * 3. Both denials produce the **same** 403 body, while the operator log distinguishes them —
 *    which is `PLT-203`'s first acceptance criterion, and the only place its two halves
 *    (identical on the wire, distinct in the log) can both be true at once.
 *
 * ## What is real and what is a double
 *
 * Real: the Nest application graph, the real `PermissionGuard`, real `Reflector` metadata
 * resolution, real HTTP over a kernel-assigned TCP port, real status codes and bodies.
 *
 * Doubled: `IPermissionGrantReader` and `IOwnershipPolicyRegistry`'s contents. **No database
 * and no school domain exists** — there is no class table, no guardian link and no outlet
 * table, which is why the relationships below live in memory and are labelled as fakes. See
 * `fake-ownership-policy.ts` for why that is the honest form of this coverage.
 *
 * ## The three negative security tests `PLATFORM_CORE_PLAN.md` 4 mandates
 *
 * - a teacher cannot touch another teacher's class **even holding `GRADE_ENTER`**
 * - a parent cannot read a child that is not theirs
 * - a vendor cannot read beyond its own outlet
 *
 * Each is asserted in the shape that matters: **with the permission granted.** A denial
 * proven while the caller lacks the role proves nothing about ownership, because the
 * permission check would have refused anyway.
 */

/** Teacher A owns class-1 and homeroom-2. Teacher B owns nothing here. */
const TEACHER_A = 'user-teacher-a';
const TEACHER_B = 'user-teacher-b';
/** Parent P1 is linked to child-1 only. */
const PARENT_P1 = 'user-parent-p1';
const PARENT_P2 = 'user-parent-p2';
/** Vendor V1 is scoped to outlet-1 only. */
const VENDOR_V1 = 'user-vendor-v1';

const RECORDS: readonly OwnedRecord[] = [
  { entityType: 'class', recordId: 'class-1', ownerIds: [TEACHER_A] },
  { entityType: 'class', recordId: 'class-2', ownerIds: [TEACHER_B] },
  { entityType: 'student', recordId: 'child-1', ownerIds: [PARENT_P1] },
  { entityType: 'student', recordId: 'child-2', ownerIds: [PARENT_P2] },
  { entityType: 'outlet', recordId: 'outlet-1', ownerIds: [VENDOR_V1] },
  { entityType: 'outlet', recordId: 'outlet-2', ownerIds: [] },
];

/**
 * A session guard stand-in.
 *
 * Stands in for `SessionGuard` so the file can reach the *granted* case without a database.
 * It does exactly one thing — attach the principal named by the `x-test-user` header — and
 * that is enough to make the second question reachable. The real `SessionGuard` is covered
 * by `session.guard.spec.ts` and `permission-guards-over-http.spec.ts`; duplicating it here
 * would test nothing about ownership.
 */
@Injectable()
class HeaderSessionGuard implements CanActivate {
  canActivate(context: { switchToHttp(): { getRequest(): Record<string, unknown> } }): boolean {
    const request = context.switchToHttp().getRequest();

    // From `.headers`, not the request root. Express lowercases incoming header names and
    // hangs them off `headers`; reading `request['x-test-user']` finds nothing and the
    // guard returns false, which Nest renders as its own `403 Forbidden resource` — a
    // refusal that looks like a permission decision and is not one. That ambiguity cost a
    // full debugging cycle here, which is why it is spelled out.
    const headers = asRecord(request['headers']);
    const userId = headers['x-test-user'];

    if (typeof userId !== 'string' || userId.length === 0) return false;

    attachPrincipal(request as Parameters<typeof attachPrincipal>[0], {
      sessionId: `session-for-${userId}`,
      userId,
    });
    return true;
  }
}

/** Narrow an unknown to an indexable record without a cast or an `any`. */
function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object'
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

/** Always grants. Isolates the ownership question from the permission question. */
const GRANT_ALL: IPermissionGrantReader = {
  isGranted: () => Promise.resolve(true),
};

const DENY_ALL: IPermissionGrantReader = {
  isGranted: () => Promise.resolve(false),
};

// ---------------------------------------------------------------------------
// Routes. Declared here, in the spec, on purpose.
//
// They are NOT added to the production route tree: no academic module exists to own them,
// and `route-permissions.json` reconciles the real tree in both directions, so a
// test-only controller there would fail the gate for a route that has no business existing
// yet. Declaring them locally proves the guard's behaviour without pretending the domain
// has shipped.
// ---------------------------------------------------------------------------

@Controller('spec/class')
class ClassController {
  /** Teacher A's own class. Must succeed. */
  @Get('own')
  @RequirePermission('GRADE_ENTER')
  @OwnsResource('class')
  own(): { readonly ok: true } {
    return { ok: true };
  }

  /** Another teacher's class, same permission. Must be refused. */
  @Get('other')
  @RequirePermission('GRADE_ENTER')
  @OwnsResource('class')
  other(): { readonly ok: true } {
    return { ok: true };
  }

  /** Same as `other`, but with NO `@OwnsResource`. Must succeed — proves the decorator is what refused. */
  @Get('unscoped')
  @RequirePermission('GRADE_ENTER')
  unscoped(): { readonly ok: true } {
    return { ok: true };
  }

  /** Ownership-scoped but with NO `@RequirePermission`. Must be refused as unmarked. */
  @Get('unmarked')
  @OwnsResource('class')
  unmarked(): { readonly ok: true } {
    return { ok: true };
  }

  /** Scoped to an entity type no policy is registered for. Must be refused. */
  @Get('unregistered')
  @RequirePermission('GRADE_ENTER')
  @OwnsResource('timetable_slot')
  unregistered(): { readonly ok: true } {
    return { ok: true };
  }
}

@Controller('spec/parent')
class ParentController {
  @Get('own-child')
  @RequirePermission('STUDENT_READ')
  @OwnsResource('student')
  ownChild(): { readonly ok: true } {
    return { ok: true };
  }

  @Get('other-child')
  @RequirePermission('STUDENT_READ')
  @OwnsResource('student')
  otherChild(): { readonly ok: true } {
    return { ok: true };
  }
}

@Controller('spec/vendor')
class VendorController {
  @Get('own-outlet')
  @RequirePermission('STOCK_READ')
  @OwnsResource('outlet')
  ownOutlet(): { readonly ok: true } {
    return { ok: true };
  }

  @Get('other-outlet')
  @RequirePermission('STOCK_READ')
  @OwnsResource('outlet')
  otherOutlet(): { readonly ok: true } {
    return { ok: true };
  }
}

interface Harness {
  readonly get: (path: string, userId?: string) => Promise<{ status: number; body: string }>;
  readonly registry: RecordingOwnershipPolicyRegistry;
  close(): Promise<void>;
}

let harness: Harness;
let warn: ReturnType<typeof vi.spyOn>;

async function boot(options: {
  readonly grants: IPermissionGrantReader;
  readonly policies?: readonly FakeOwnershipPolicy[];
  readonly withOwnershipRegistry?: boolean;
}): Promise<Harness> {
  const policies = options.policies ?? [
    new FakeOwnershipPolicy('class', RECORDS),
    new FakeOwnershipPolicy('student', RECORDS),
    new FakeOwnershipPolicy('outlet', RECORDS),
  ];

  const registry = new RecordingOwnershipPolicyRegistry(
    new StaticOwnershipPolicyRegistry(policies),
  );

  const moduleRef = await Test.createTestingModule({
    controllers: [ClassController, ParentController, VendorController],
    providers: [
      Reflector,
      HeaderSessionGuard,
      { provide: IPERMISSION_GRANT_READER, useValue: options.grants },
      ...(options.withOwnershipRegistry === false
        ? []
        : [{ provide: IOWNERSHIP_POLICY_REGISTRY, useValue: registry }]),
      { provide: APP_GUARD, useClass: HeaderSessionGuard },
      { provide: APP_GUARD, useClass: PermissionGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  const server = app.getHttpServer() as {
    listen(port: number): unknown;
    close(cb?: () => void): void;
  };
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address() as { port: number } | null;
  const port = address?.port ?? 0;

  return {
    registry,
    get: async (path, userId) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: userId === undefined ? {} : { 'x-test-user': userId },
      });
      return { status: response.status, body: await response.text() };
    },
    close: () => app.close(),
  };
}

beforeEach(() => {
  // The guard logs a diagnosis on every refusal. Captured so the tests can assert on it —
  // `PLT-203` requires the denial reason to be distinguishable in logs, and that claim is
  // only testable if something reads the log.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

describe("PLT-203 — a teacher may not touch another teacher's class", () => {
  it("REFUSES teacher B on teacher A's class, WHILE HOLDING GRADE_ENTER", async () => {
    harness = await boot({ grants: GRANT_ALL });
    try {
      // Holding the permission is stated in the harness, not assumed: `GRANT_ALL` means
      // any denial below came from the OWNERSHIP question and nothing else. Without this a
      // 403 would prove nothing — the permission check would have produced it anyway.
      const response = await harness.get('/spec/class/other?classId=class-1', TEACHER_B);

      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });

  it('ALLOWS teacher A on their OWN class', async () => {
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/class/own?classId=class-1', TEACHER_A);
      expect(response.status).toBe(200);
    } finally {
      await harness.close();
    }
  });

  it('REFUSES a class that EXISTS but is owned by nobody — an empty owner set is not a wildcard', async () => {
    // `outlet-2` has `ownerIds: []`. A policy written as `owners.length > 0 ? ... : OWNED`
    // would open it to everyone, and that inversion is easy to write and invisible in
    // review.
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/vendor/other-outlet?outletId=outlet-2', VENDOR_V1);
      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });

  it('REFUSES when the request carries NO record id, rather than treating the lookup as vacuously true', async () => {
    // The empty-`WHERE` mistake: a policy that finds nothing and concludes "not excluded"
    // would allow this. It must not.
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/class/other', TEACHER_B);
      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — a parent may not read a child that is not theirs', () => {
  it("REFUSES parent P2 reading P1's child, WHILE HOLDING STUDENT_READ", async () => {
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/parent/other-child?studentId=child-1', PARENT_P2);
      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });

  it('ALLOWS parent P1 reading their own child', async () => {
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/parent/own-child?studentId=child-1', PARENT_P1);
      expect(response.status).toBe(200);
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — a vendor may not read beyond its own outlet', () => {
  it('REFUSES vendor V1 on an outlet it does not own, WHILE HOLDING STOCK_READ', async () => {
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/vendor/other-outlet?outletId=outlet-2', VENDOR_V1);
      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });

  it('ALLOWS vendor V1 on its own outlet', async () => {
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/vendor/own-outlet?outletId=outlet-1', VENDOR_V1);
      expect(response.status).toBe(200);
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — the decorator is what refuses, not the route', () => {
  it('ALLOWS the same request when @OwnsResource is absent', async () => {
    // The control case for every negative test above. If `/unscoped` were also refused,
    // the refusals would be coming from something else — a mis-declared guard, the session
    // stand-in — and the ownership tests would be proving nothing.
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/class/unscoped?classId=class-1', TEACHER_B);
      expect(response.status).toBe(200);
    } finally {
      await harness.close();
    }
  });

  it('REFUSES an @OwnsResource route that carries no @RequirePermission', async () => {
    // Ownership is the SECOND question. A route that never states a role requirement is
    // refused before ownership is reached, because `AGENTS.md` 2.3 makes an unmarked route
    // a defect — and reaching ownership first would mean an ownership policy could
    // accidentally become the only thing authorising a route.
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get('/spec/class/unmarked?classId=class-1', TEACHER_A);
      expect(response.status).toBe(403);
      expect(harness.registry.lookups).toEqual([]);
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — NO_POLICY_FOR_ENTITY is a refusal, not an absence of checking', () => {
  it('REFUSES a route scoped to an entity type no policy is registered for', async () => {
    // THE decision. `timetable_slot` has no policy because the academic module has not
    // shipped. The intuitive behaviour — no policy, nothing to check, allow — is an
    // authentication bypass wearing a reassuring name.
    harness = await boot({ grants: GRANT_ALL });
    try {
      const response = await harness.get(
        '/spec/class/unregistered?timetableSlotId=slot-1',
        TEACHER_A,
      );
      expect(response.status).toBe(403);
      // It DID ask. A refusal that never consulted the registry would be indistinguishable
      // from one that did and found nothing, and only one of them is the bug we fixed.
      expect(harness.registry.lookups).toContain('timetable_slot');
    } finally {
      await harness.close();
    }
  });

  it('REFUSES every scoped route when no registry is wired at all', async () => {
    harness = await boot({ grants: GRANT_ALL, withOwnershipRegistry: false });
    try {
      const response = await harness.get('/spec/class/own?classId=class-1', TEACHER_A);
      expect(response.status).toBe(403);
    } finally {
      await harness.close();
    }
  });

  it('still ALLOWS an unscoped route when no registry is wired', async () => {
    // Ownership must never make a non-scoped route unreachable, or it would sit in front of
    // every list screen in the application for no security benefit.
    harness = await boot({ grants: GRANT_ALL, withOwnershipRegistry: false });
    try {
      const response = await harness.get('/spec/class/unscoped', TEACHER_A);
      expect(response.status).toBe(200);
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — role is asked before scope, and both refusals look identical', () => {
  it('never consults the registry when the ROLE is refused', async () => {
    // If ownership were consulted first, a caller probing permissions could learn whether
    // they would also have failed the scope check — which turns a permission probe into a
    // map of the ownership graph.
    harness = await boot({ grants: DENY_ALL });
    try {
      const response = await harness.get('/spec/class/own?classId=class-1', TEACHER_A);
      expect(response.status).toBe(403);
      expect(harness.registry.lookups).toEqual([]);
    } finally {
      await harness.close();
    }
  });

  it('returns the SAME 403 body for a role refusal and an ownership refusal', async () => {
    // The enumeration-oracle defence: one frozen body, so a caller cannot tell which gate
    // stopped them.
    const viaRole = await (async () => {
      const h = await boot({ grants: DENY_ALL });
      try {
        return await h.get('/spec/class/own?classId=class-1', TEACHER_A);
      } finally {
        await h.close();
      }
    })();

    const viaOwnership = await (async () => {
      const h = await boot({ grants: GRANT_ALL });
      try {
        return await h.get('/spec/class/other?classId=class-1', TEACHER_B);
      } finally {
        await h.close();
      }
    })();

    expect(viaRole.status).toBe(403);
    expect(viaOwnership.status).toBe(403);
    expect(viaOwnership.body).toBe(viaRole.body);
  });

  it('DISTINGUISHES them in the log, which is the other half of the acceptance criterion', async () => {
    // `PLT-203`: "the denial reason is distinguishable in logs (role-denial vs.
    // ownership-denial) for debugging." This is the only place both halves of that
    // criterion are asserted together — identical on the wire, distinct in the log.
    await (async () => {
      const h = await boot({ grants: DENY_ALL });
      try {
        await h.get('/spec/class/own?classId=class-1', TEACHER_A);
      } finally {
        await h.close();
      }
    })();

    const roleLine = warn.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('PERMISSION/'));

    expect(roleLine).toBeDefined();
    expect(roleLine).toContain('NOT_GRANTED');

    await (async () => {
      const h = await boot({ grants: GRANT_ALL });
      try {
        await h.get('/spec/class/other?classId=class-1', TEACHER_B);
      } finally {
        await h.close();
      }
    })();

    const ownershipLine = warn.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('OWNERSHIP/'));

    expect(ownershipLine).toBeDefined();
    expect(ownershipLine).toContain('RESOURCE_NOT_OWNED');
    // The entity type belongs in the log. It is not a credential and it is the whole reason
    // the line is actionable.
    expect(ownershipLine).toContain('class');
  });

  it('reports NO_POLICY_FOR_ENTITY as a WIRING FAULT, not as an ordinary denial', async () => {
    // An administrator shown "this user does not own it" would go and inspect a
    // relationship table. The real fault is a module that shipped a route without shipping
    // its policy, and the log has to say so.
    harness = await boot({ grants: GRANT_ALL });
    try {
      await harness.get('/spec/class/unregistered?timetableSlotId=slot-1', TEACHER_A);

      const line = warn.mock.calls.map((call) => String(call[0])).join('\n');
      expect(line).toContain('WIRING FAULT');
      expect(line).toContain('NO_POLICY_FOR_ENTITY');
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — the policy receives the request, and never the session', () => {
  it('hands the policy params, query and body separately, and the userId', async () => {
    const policy = new FakeOwnershipPolicy('class', RECORDS);
    harness = await boot({ grants: GRANT_ALL, policies: [policy] });
    try {
      await harness.get('/spec/class/own?classId=class-1', TEACHER_A);

      expect(policy.asked).toHaveLength(1);
      const subject = policy.asked[0];
      expect(subject?.userId).toBe(TEACHER_A);
      expect(subject?.entityType).toBe('class');
      // The three bags are separate, so a policy can tell a route param from a query
      // string without the core knowing any module's URL convention.
      expect(subject?.attributes['query']).toMatchObject({ classId: 'class-1' });
      expect(subject?.attributes['params']).toBeDefined();
    } finally {
      await harness.close();
    }
  });

  it('never hands the policy a session id or a cookie', async () => {
    const policy = new FakeOwnershipPolicy('class', RECORDS);
    harness = await boot({ grants: GRANT_ALL, policies: [policy] });
    try {
      await harness.get('/spec/class/own?classId=class-1', TEACHER_A);

      const serialised = JSON.stringify(policy.asked);
      expect(serialised).not.toContain('session-for-');
      expect(serialised).not.toContain('cookie');
    } finally {
      await harness.close();
    }
  });
});

describe('PLT-203 — pluggability, the second acceptance criterion', () => {
  it('serves a NEWLY added entity type with no change to the guard', async () => {
    // "Adding a new entity type's ownership rule doesn't require touching the core guard."
    // Proved by registering a type that appears nowhere else in this file and getting a
    // 200 on the first request. If the guard had a hard-coded list, or imported policies,
    // this could not work.
    const homeroom = new FakeOwnershipPolicy('homeroom', [
      { entityType: 'homeroom', recordId: 'homeroom-2', ownerIds: [TEACHER_A] },
    ]);

    @Controller('spec/homeroom')
    class HomeroomController {
      @Get('mine')
      @RequirePermission('STUDENT_READ')
      @OwnsResource('homeroom')
      mine(): { readonly ok: true } {
        return { ok: true };
      }
    }

    const policies = [new FakeOwnershipPolicy('class', RECORDS), homeroom];

    const moduleRef = await Test.createTestingModule({
      controllers: [HomeroomController],
      providers: [
        Reflector,
        HeaderSessionGuard,
        { provide: IPERMISSION_GRANT_READER, useValue: GRANT_ALL },
        {
          provide: IOWNERSHIP_POLICY_REGISTRY,
          useValue: new StaticOwnershipPolicyRegistry(policies),
        },
        { provide: APP_GUARD, useClass: HeaderSessionGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    const server = app.getHttpServer() as {
      listen(port: number): unknown;
      address(): { port: number } | null;
    };
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const port = server.address()?.port ?? 0;

    try {
      const owned = await fetch(
        `http://127.0.0.1:${port}/spec/homeroom/mine?homeroomId=homeroom-2`,
        {
          headers: { 'x-test-user': TEACHER_A },
        },
      );
      expect(owned.status).toBe(200);

      const notOwned = await fetch(
        `http://127.0.0.1:${port}/spec/homeroom/mine?homeroomId=homeroom-2`,
        {
          headers: { 'x-test-user': TEACHER_B },
        },
      );
      expect(notOwned.status).toBe(403);
    } finally {
      await app.close();
    }
  });
});
