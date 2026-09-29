import { Linter } from 'eslint';
import { node as nodeConfig } from '@eduflow/config/eslint/node';
import { describe, expect, it } from 'vitest';

/**
 * The AGENTS.md rules that ESLint is supposed to enforce.
 *
 * AGENTS.md 4.1 and ARCHITECTURE.md 17: a rule that is not mechanically
 * enforced is a suggestion. This suite is the evidence that four of the
 * most important rules actually fire.
 *
 * It runs ESLint's real Linter against the real config exported by
 * @eduflow/config/eslint/node, using source strings and virtual file
 * paths. Mocking eslint here would test the mock; running the CLI over
 * temp files outside the project would not match the path globs, because
 * ESLint only lints files beneath its cwd.
 *
 * P3 extends this to `check-route-guards`, `check-i18n` and
 * `check-worklog`, which need the whole toolchain.
 */

const linter = new Linter();
const config = nodeConfig as Linter.Config[];

interface LintMessage {
  ruleId: string | null;
  message: string;
}

const RESTRICTED_IMPORTS = 'no-restricted-imports';
const RESTRICTED_SYNTAX = 'no-restricted-syntax';
const NO_EXPLICIT_ANY = '@typescript-eslint/no-explicit-any';
const BAN_TS_COMMENT = '@typescript-eslint/ban-ts-comment';
const NO_EMPTY = 'no-empty';

/** Lint a source string as if it lived at `virtualPath` (relative to apps/api). */
function lint(source: string, virtualPath: string): LintMessage[] {
  return linter.verify(source, config, virtualPath).map((m) => ({
    ruleId: m.ruleId,
    message: m.message,
  }));
}

const textOf = (r: LintMessage[]) => r.map((m) => m.message).join('\n');
const fired = (r: LintMessage[], ruleId: string) => r.some((m) => m.ruleId === ruleId);

const USE_CASE = 'src/use-cases/thing.ts';
const DOMAIN_SERVICE = 'src/modules/fees/domain/services/accrue.ts';
const CONTROLLER = 'src/modules/fees/controllers/fees.controller.ts';

describe('AGENTS.md 2.2 — layering is mechanically enforced', () => {
  it('rejects @nestjs/common in a use-case, and cites the rule', () => {
    const r = lint(`import { Injectable } from '@nestjs/common';\nexport class A {}\n`, USE_CASE);

    expect(fired(r, RESTRICTED_IMPORTS)).toBe(true);
    expect(textOf(r)).toMatch(/AGENTS\.md 2\.2/);
  });

  it('rejects @prisma/client in a domain service', () => {
    const r = lint(`import { PrismaClient } from '@prisma/client';\nexport class A {}\n`, DOMAIN_SERVICE);

    expect(fired(r, RESTRICTED_IMPORTS)).toBe(true);
    expect(textOf(r)).toMatch(/@prisma\/client/);
  });

  it('rejects a vendor SDK (bullmq) in a use-case', () => {
    const r = lint(`import { Queue } from 'bullmq';\nexport const q = 1;\n`, USE_CASE);

    expect(fired(r, RESTRICTED_IMPORTS)).toBe(true);
    expect(textOf(r)).toMatch(/bullmq/);
  });

  it('rejects a UI import in a use-case', () => {
    const r = lint(`import { useState } from 'react';\nexport const q = 1;\n`, USE_CASE);

    expect(fired(r, RESTRICTED_IMPORTS)).toBe(true);
    expect(textOf(r)).toMatch(/react/);
  });

  it('allows a framework-free use-case importing only its own domain', () => {
    const r = lint(
      `import type { AuditRecord } from '../domain/entities/audit-record';\nexport const f = (r: AuditRecord) => r.id;\n`,
      USE_CASE,
    );

    expect(fired(r, RESTRICTED_IMPORTS)).toBe(false);
  });

  it('does NOT apply the layering rule outside domain/ and use-cases/', () => {
    // A controller legitimately imports NestJS. Proving the rule is
    // path-scoped prevents it being "fixed" by being made global, which
    // would make the API unbuildable.
    const r = lint(`import { Controller } from '@nestjs/common';\nexport class C {}\n`, CONTROLLER);

    expect(fired(r, RESTRICTED_IMPORTS)).toBe(false);
  });
});

describe('AGENTS.md 2.4 — IClock is mechanically enforced', () => {
  it('rejects Date.now() in a use-case', () => {
    const r = lint(`export const t = () => Date.now();\n`, USE_CASE);

    expect(fired(r, RESTRICTED_SYNTAX)).toBe(true);
    expect(textOf(r)).toMatch(/AGENTS\.md 2\.4/);
    expect(textOf(r)).toMatch(/IClock/);
  });

  it('rejects new Date() in a domain service', () => {
    const r = lint(`export const d = () => new Date();\n`, DOMAIN_SERVICE);

    expect(fired(r, RESTRICTED_SYNTAX)).toBe(true);
    expect(textOf(r)).toMatch(/IClock/);
  });

  it('rejects Math.random() in a domain service', () => {
    const r = lint(`export const r = () => Math.random();\n`, DOMAIN_SERVICE);

    expect(fired(r, RESTRICTED_SYNTAX)).toBe(true);
    expect(textOf(r)).toMatch(/injected id generator/);
  });

  it('allows an injected clock', () => {
    const r = lint(
      `import type { IClock } from '../domain/ports/clock';\nexport const t = (c: IClock) => c.now();\n`,
      USE_CASE,
    );

    expect(fired(r, RESTRICTED_SYNTAX)).toBe(false);
  });

  it('does NOT apply the IClock rule outside domain/ and use-cases/', () => {
    // Infrastructure legitimately reads the real clock. Path scoping is
    // what makes the rule usable at all.
    const r = lint(`export const t = () => Date.now();\n`, 'src/infrastructure/postgres/thing.ts');

    expect(fired(r, RESTRICTED_SYNTAX)).toBe(false);
  });
});

describe('AGENTS.md 8 — no escape hatches', () => {
  it('rejects @ts-ignore', () => {
    const r = lint(`// @ts-ignore\nexport const x: number = 1;\n`, USE_CASE);

    expect(fired(r, BAN_TS_COMMENT)).toBe(true);
  });

  it('rejects an explicit any', () => {
    const r = lint(`export const x: any = 1;\n`, USE_CASE);

    expect(fired(r, NO_EXPLICIT_ANY)).toBe(true);
  });

  it('rejects a bare catch that swallows the error', () => {
    const r = lint(`export const f = () => { try { return 1; } catch {} };\n`, USE_CASE);

    expect(fired(r, NO_EMPTY)).toBe(true);
  });
});
