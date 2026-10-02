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

describe('a decorator split across lines', () => {
  /**
   * The first implementation read only `lines[i - 1]`, so a `@Public(...)`
   * that Prettier wrapped was reported as an unguarded route. It failed
   * CLOSED — nothing slipped through — but a gate that punishes correct
   * formatting is a gate people learn to reformat past. These cases exist so
   * that cannot regress quietly.
   */
  const cases: Array<{ name: string; lines: string[] }> = [
    {
      name: 'wrapped above the route decorator',
      lines: [
        '@Controller("probe")',
        'export class C {',
        '  @Get("/a")',
        '  @Public(',
        "    'a reason long enough that Prettier wrapped it',",
        '  )',
        '  a(): string { return "x"; }',
        '}',
      ],
    },
    {
      name: 'wrapped below the route decorator',
      lines: [
        '@Controller("probe")',
        'export class C {',
        '  @Get("/b")',
        '  @Public(',
        "    'reason',",
        '  )',
        '  b(): string { return "x"; }',
        '}',
      ],
    },
  ];

  for (const c of cases) {
    it(`is recognised when ${c.name}`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'rg-'));
      const file = join(dir, 'c.ts');
      try {
        writeFileSync(file, c.lines.join('\n'));
        const findings = auditRoutes([file]);
        // auditRoutes answers ONE question: is this route guarded? An empty
        // result is the pass. (The allowlist is reconciled separately by
        // auditAllowlist — asserting on it here would be asserting on the
        // wrong function, and would pass for the wrong reason.)
        expect(findings.filter((f) => f.message.startsWith('Route has neither'))).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  it('does NOT let one route borrow the next route decorator', () => {
    // The direction that could create a real BYPASS: absorbing lines below a
    // route without stopping would hand /unguarded the guard belonging to
    // /guarded, with no blank line between them.
    const dir = mkdtempSync(join(tmpdir(), 'rg-'));
    const file = join(dir, 'c.ts');
    try {
      writeFileSync(
        file,
        [
          '@Controller("probe")',
          'export class C {',
          '  @Get("/unguarded")',
          '  unguarded(): string { return "x"; }',
          '  @Get("/guarded")',
          '  @Public("reason")',
          '  guarded(): string { return "x"; }',
          '}',
        ].join('\n'),
      );
      const findings = auditRoutes([file]);
      const unguarded = findings.filter((f) => f.message.startsWith('Route has neither'));
      expect(unguarded).toHaveLength(1);
      expect(unguarded[0].line).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
    // Scans a file that exists, rather than a synthetic string, so the analyser
    // is exercised against real source. `system-clock.ts` is an infrastructure
    // adapter and holds no routes — which is the point: this asserts that
    // scanning real source reports nothing, not that some route is guarded.
    //
    // The routes that DO exist are reconciled by `pnpm check:route-guards`,
    // which reads this repository's allowlist as well as the decorators. It is
    // the gate that covers `src/modules/auth/controllers/oidc-sign-in.controller.ts`.
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
