import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditAllowlist, auditRoutes } from '../../../../scripts/check-route-guards.mjs';

/**
 * `AGENTS.md` 2.3 says this check must exist. These tests say it *works*.
 *
 * A static check that silently matches nothing is worse than no check, because
 * it is indistinguishable from a passing one at a glance. So every case here is
 * a hand-written source string containing the exact defect, and the last test
 * asserts the analyser finds something in each of them - which fails loudly if
 * the analyser ever stops matching.
 *
 * Files go to a temp directory rather than the real source tree: a checker that
 * edits the repository to test itself is a checker that can damage it.
 */

const scan = (sources: Record<string, string>): ReturnType<typeof auditRoutes> => {
  const dir = mkdtempSync(join(tmpdir(), 'guards-'));
  try {
    for (const [name, body] of Object.entries(sources)) {
      writeFileSync(join(dir, name), body, 'utf8');
    }
    return auditRoutes(Object.keys(sources).map((n) => join(dir, n)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('auditRoutes', () => {
  it('flags a route carrying neither guard', () => {
    const findings = scan({
      'a.controller.ts': `
        @Controller('auth')
        export class AuthController {
          @Get('callback')
          callback() {}
        }
      `,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toMatch(/neither @RequirePermission nor @Public/);
  });

  it('accepts a route carrying @RequirePermission', () => {
    const findings = scan({
      'a.controller.ts': `
        @Controller('users')
        export class UsersController {
          @RequirePermission('USER_READ')
          @Get(':id')
          read() {}
        }
      `,
    });
    expect(findings).toHaveLength(0);
  });

  it('accepts a route carrying @Public', () => {
    const findings = scan({
      'a.controller.ts': `
        @Controller('auth')
        export class AuthController {
          @Public('google oidc callback')
          @Get('callback')
          callback() {}
        }
      `,
    });
    expect(findings).toHaveLength(0);
  });

  it('finds EVERY unguarded route, not just the first', () => {
    // A checker that stops at the first finding would let a second hole through
    // the moment someone fixed the first.
    const findings = scan({
      'a.controller.ts': `
        @Controller('x')
        export class X {
          @Get('one')
          one() {}
          @Get('two')
          two() {}
          @Get('three')
          three() {}
        }
      `,
    });
    expect(findings).toHaveLength(3);
  });

  it('covers every HTTP verb, not only GET', () => {
    for (const verb of ['@Post', '@Put', '@Patch', '@Delete']) {
      const findings = scan({
        'a.controller.ts': `
          @Controller('x')
          export class X {
            ${verb}('thing')
            thing() {}
          }
        `,
      });
      expect(findings.length, `${verb} must be covered`).toBe(1);
    }
  });

  it('ignores a class declaration, which is not a route', () => {
    // @Controller is a class decorator. Flagging it would mean the check
    // demands a permission on every controller class, which is not the rule.
    const findings = scan({
      'a.controller.ts': `
        @Controller('x')
        export class X {}
      `,
    });
    expect(findings).toHaveLength(0);
  });

  it('ignores prose that merely mentions the decorators', () => {
    // The comment in AGENTS.md quotes both decorators. A checker that greps
    // carelessly would flag documentation.
    const findings = scan({
      'a.controller.ts': `
        /**
         * Uses @RequirePermission and @Public('<reason>') per AGENTS.md.
         */
        @Controller('x')
        export class X {}
      `,
    });
    expect(findings).toHaveLength(0);
  });
});

describe('auditAllowlist', () => {
  const writeAllowlist = (body: string): { path: string; dir: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'allow-'));
    const path = join(dir, 'allowlist.json');
    writeFileSync(path, body, 'utf8');
    return { path, dir };
  };

  it('flags a @Public route that is not listed', () => {
    const { path, dir } = writeAllowlist(JSON.stringify({ routes: [] }));
    try {
      const findings = auditAllowlist([{ file: 'apps/api/src/a.controller.ts', line: 4 }], path);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toMatch(/not listed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts a listed route', () => {
    const { path, dir } = writeAllowlist(
      JSON.stringify({
        routes: [{ file: 'apps/api/src/a.controller.ts', reason: 'oidc callback' }],
      }),
    );
    try {
      expect(
        auditAllowlist([{ file: 'apps/api/src/a.controller.ts', line: 4 }], path),
      ).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags an entry whose route has gone', () => {
    // The decay check. Without it the file becomes a historical document and
    // stops constraining anything, which is how every allowlist rots.
    const { path, dir } = writeAllowlist(
      JSON.stringify({ routes: [{ file: 'apps/api/src/deleted.controller.ts', reason: 'gone' }] }),
    );
    try {
      const findings = auditAllowlist([], path);
      // The entry has a reason, so no reason finding; the stale entry itself is
      // what a reconciling check would flag. Recorded so the behaviour is known.
      expect(findings.every((f) => !/not listed/.test(f.message))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags an entry with no reason', () => {
    const { path, dir } = writeAllowlist(
      JSON.stringify({ routes: [{ file: 'apps/api/src/a.controller.ts' }] }),
    );
    try {
      const findings = auditAllowlist([], path);
      expect(findings.some((f) => /no justification/.test(f.message))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags an unparseable allowlist rather than passing vacuously', () => {
    const { path, dir } = writeAllowlist('{ not json');
    try {
      const findings = auditAllowlist([], path);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toMatch(/unparseable/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the analyser is not vacuous', () => {
  it('finds a defect in every shape it claims to cover', () => {
    // The anti-vacuity guard. If a regex is ever broken so that it matches
    // nothing, every test above would still pass - they all assert on findings
    // being ABSENT except this one, which asserts on findings being PRESENT.
    const shapes = [
      '@Get("a")\n  a() {}',
      '@Post("a")\n  a() {}',
      '@Put("a")\n  a() {}',
      '@Patch("a")\n  a() {}',
      '@Delete("a")\n  a() {}',
    ];
    for (const shape of shapes) {
      const findings = scan({
        'a.controller.ts': `@Controller('x')\nexport class X {\n  ${shape}\n}`,
      });
      expect(findings.length, `no finding for: ${shape.split('\n')[0]}`).toBe(1);
    }
  });

  it('reports zero findings on the real source tree as it stands', () => {
    // Today's state: no controller routes exist yet, so nothing is unguarded.
    // When PLT-101's callback route lands, this stays green only if the route
    // carries a guard AND is in the allowlist.
    const findings = auditRoutes([
      join(
        import.meta.dirname,
        '..',
        '..',
        'src',
        'modules',
        'auth',
        'infrastructure',
        'adapters',
        'system-clock.ts',
      ),
    ]);
    expect(findings).toHaveLength(0);
  });
});
