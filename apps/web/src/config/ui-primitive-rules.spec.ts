import { Linter } from 'eslint';
import { next as nextConfig } from '@eduflow/config/eslint/next';
import { describe, expect, it } from 'vitest';

/**
 * AGENTS.md 3.2.1: "All UI primitives are shadcn/ui components - no raw
 * <button>, <input>, <select>, <textarea>, <table>, <dialog>."
 *
 * The rule's own message tells a developer to "use the shadcn/ui component from
 * @eduflow/ui-kit". **Which means a shadcn component has to contain the raw
 * element** - `button.tsx` renders `<button>`, that is the entire point of it.
 *
 * Until 2026-09-30 that was an unresolvable contradiction, and it is why the
 * landing page shipped with no theme toggle: a toggle must be a button, a
 * button must be a shadcn `<Button>`, and no shadcn component existed. The rule
 * banned what did not yet exist, so the first interactive screen could not be
 * written. `FIX-11`.
 *
 * `B-1` resolves it by scoping the ban to *consumers* and exempting the
 * primitives directory. That is the only reading of 3.2.1 that can be
 * satisfied: the section says primitives must be shadcn, not that the raw
 * element ceases to exist somewhere.
 *
 * The exemption is dangerous if it leaks, so this suite asserts BOTH halves:
 * the ban still fires for every consumer, and only the primitives directory is
 * exempt. A blanket `no-restricted-syntax: off` would pass the second test and
 * silently delete the first.
 *
 * Paths are virtual, as in the sibling `lint-rules.spec.ts`, and both cwd
 * forms are covered: `next.js` is shared between `apps/web` and
 * `packages/ui-kit`, so a glob anchored at the ui-kit root would exempt the
 * primitives locally while leaving them banned when linted from the repo root.
 */

const linter = new Linter();
const config = nextConfig as Linter.Config[];

interface LintMessage {
  ruleId: string | null;
  message: string;
}

/** Lint a source string as if it lived at `virtualPath`. */
function lint(source: string, virtualPath: string): LintMessage[] {
  return linter
    .verify(source, config, virtualPath)
    .map((m) => ({ ruleId: m.ruleId, message: m.message }));
}

const textOf = (r: LintMessage[]) => r.map((m) => m.message).join('\n');
const banned = (r: LintMessage[], tag: string) => textOf(r).includes(`raw <${tag}> is not allowed`);

/** A consumer, linted from apps/web. */
const CONSUMER = 'src/features/landing/components/hero.tsx';

/** The primitives directory, linted from packages/ui-kit (its own cwd). */
const PRIMITIVE_LOCAL = 'src/components/ui/button.tsx';

/** The same file, linted from the repo root. */
const PRIMITIVE_FROM_ROOT = 'packages/ui-kit/src/components/ui/button.tsx';

describe('AGENTS.md 3.2.1 - raw elements are banned for consumers', () => {
  it('rejects a raw <button> in a feature component', () => {
    expect(banned(lint(`export const A = () => <button>Go</button>;\n`, CONSUMER), 'button')).toBe(
      true,
    );
  });

  it('rejects every banned element, and names the rule', () => {
    for (const tag of ['button', 'input', 'select', 'textarea', 'table', 'dialog']) {
      const jsx = tag === 'input' ? `<input />` : tag === 'table' ? `<table />` : `<${tag} />`;
      const r = lint(`export const A = () => ${jsx};\n`, CONSUMER);

      expect(banned(r, tag), `raw <${tag}> was not rejected: ${textOf(r)}`).toBe(true);
    }

    expect(textOf(lint(`export const A = () => <button />;\n`, CONSUMER))).toMatch(
      /AGENTS\.md 3\.2\.1/,
    );
  });

  it('points the developer at the replacement, not just the prohibition', () => {
    expect(textOf(lint(`export const A = () => <button />;\n`, CONSUMER))).toMatch(
      /@eduflow\/ui-kit/,
    );
  });

  it('rejects a raw <input> in a NON-ui directory inside ui-kit too', () => {
    // The exemption is scoped to components/ui, not to the whole package. A
    // helper elsewhere in ui-kit is still a consumer.
    const r = lint(`export const A = () => <input />;\n`, 'src/lib/field.tsx');

    expect(banned(r, 'input')).toBe(true);
  });
});

describe('AGENTS.md 3.2.1 - the shadcn primitives are exempt, and only them', () => {
  it('ALLOWS a raw <button> inside a primitive, linted from packages/ui-kit', () => {
    const r = lint(`export const Button = () => <button />;\n`, PRIMITIVE_LOCAL);

    expect(
      banned(r, 'button'),
      `a primitive was banned, so 3.2.1 is unsatisfiable again: ${textOf(r)}`,
    ).toBe(false);
  });

  it('ALLOWS the same primitive when linted from the repo root', () => {
    // The config is shared between two cwds. An exemption anchored at the
    // ui-kit root would pass the test above and fail in a root-level lint run,
    // which is the kind of gap that only shows up in CI.
    const r = lint(`export const Button = () => <button />;\n`, PRIMITIVE_FROM_ROOT);

    expect(
      banned(r, 'button'),
      `the exemption did not survive a repo-root lint run: ${textOf(r)}`,
    ).toBe(false);
  });

  it('ALLOWS every banned element inside a primitive', () => {
    for (const tag of ['button', 'input', 'select', 'textarea', 'table', 'dialog']) {
      const r = lint(`export const C = () => <${tag} />;\n`, PRIMITIVE_FROM_ROOT);

      expect(banned(r, tag), `<${tag}> is still banned inside a primitive`).toBe(false);
    }
  });

  it('STILL enforces the colour ban inside a primitive', () => {
    // Scoped narrowly on purpose: exempting raw elements must not exempt
    // AGENTS.md 3.2.5. A component that hard-codes a hex cannot work in both
    // themes, and the primitives are exactly where that mistake would land.
    const r = lint(
      `export const A = () => <div style={{ color: '#ff0000' }} />;\n`,
      PRIMITIVE_FROM_ROOT,
    );

    expect(textOf(r), 'the colour ban was lost inside the primitives directory').toMatch(
      /3\.2\.5|hard-code a colour/,
    );
  });
});

describe('AGENTS.md 3.2.5 - no hard-coded colour anywhere', () => {
  it('rejects a hex literal in a consumer component', () => {
    const r = lint(`export const A = () => <div style={{ color: '#ff0000' }} />;\n`, CONSUMER);

    expect(textOf(r)).toMatch(/hard-code a colour/);
  });
});
