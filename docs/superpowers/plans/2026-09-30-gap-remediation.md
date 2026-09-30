# Gap Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 11 gaps measured on 2026-09-30, in dependency order, without adding a hollow gate or a false claim.

**Architecture:** Four independent tracks. Track 1 is executable today and unblocks the last hollow gate. Tracks 2 and 3 are small artifact-writing tasks on the critical path. Track 4 cannot be completed on this machine at all — it needs a Docker host, and saying so is part of the deliverable.

**Tech Stack:** pnpm workspaces, Turborepo, Vitest, Playwright, Next.js 16, NestJS, Prisma, PostgreSQL 17, Prettier, ESLint flat config.

**Spec:** `docs/work/ACTION_PLAN_2026-09-30-v2.md` (the plan this implements), `docs/work/TDD_EVIDENCE_GATES.md` (measured evidence), `AGENTS.md` (the contract), `docs/core/SSOT.md` (state of record).

---

## Global Constraints

Copied from `AGENTS.md`; every task below is bound by these.

- **TDD is mandatory.** A failing test must be _observed_ before the fix. "It compiles" is not done. `AGENTS.md` §4.1.
- **One commit per RED, one per GREEN.** No amend, no squash — the pairs are the evidence. `AGENTS.md` §9.
- **Every route carries all three guards** — `@RequirePermission`, `@RequireEntitlement` where feature-gated, `@Audited` where sensitive — or `@Public('<reason>')` from the checked-in allowlist. `AGENTS.md` §2.3.
- **Money is integer minor units with an explicit currency code.** Never `float`. `ADR-002`.
- **Time comes from `IClock`.** No `Date.now()`, `new Date()` or `Math.random()` in domain or use-case code. `AGENTS.md` §2.4.
- **One deployment and one database per school.** No tenant-scoping machinery, no `SUPER_ADMIN`, no cross-tenant guards. `AGENTS.md` §2.1.
- **All UI text goes through i18n.** `en.json` first, then `ta.json`, `si.json`, `ar.json`. A literal English string in JSX is review-blocking. `AGENTS.md` §2.8.
- **No hard-coded colours.** Tokens only. Both themes required. `AGENTS.md` §3.2.5.
- **Raw `<button>` `<input>` `<select>` `<textarea>` `<table>` `<dialog>` are banned** outside `packages/ui-kit/src/components/ui/**`. `AGENTS.md` §3.2.1.
- **Worklog and TODO update in the same commit as the change.** `AGENTS.md` §9.
- **Do not renumber `PLT-*` IDs.** Append only. `AGENTS.md` §7.

## Scope Check

This is four independent subsystems, not one. Per the writing-plans scope rule they are tracked separately here, and **Track 1 is the only one written to executable detail** — the others are specified to story level with acceptance criteria, and each should become its own plan when it is reached. Writing all four at executable detail today would produce a plan nobody reads to the end.

---

## The Gap Register

Every row was measured, not inferred. The "Evidence" column is the command or file that produced it.

| #   | Gap                                                                                                                                                                                                                                                      | Evidence                                                                             | Owner               | Blocks                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------- |
| G1 | `.gitattributes` absent while `core.autocrlf=true` and Prettier sets `endOfLine: lf`. **This is `TODO.md` `ARC-09-9`**, found independently on both sides — `b080aa7` recorded it as "schema-generation.spec.ts fails on Windows because core.autocrlf=true with no .gitattributes" | `git config core.autocrlf` → `true`; `git ls-files --eol` → 32 `w/crlf`, 1 `w/mixed`; `schema.prisma` currently 0 CR bytes so the test passes *here* | Track 1 (Task 1) **closes `ARC-09-9`** | `format:check` and `schema-generation.spec.ts` on any fresh Windows clone |
| G2  | `format:check` exit 1, 78 style warnings (51 `docs/`, 12 `apps/`, 10 `packages/`, 5 root)                                                                                                                                                                | `pnpm format:check`                                                                  | Track 1             | `AGENTS.md` §4 gate                         |
| G3  | Theme toggle absent; `theme-script.tsx` reads `localStorage.getItem('eduflow-theme')` but `setItem` has **0 hits** in `apps/web/src`                                                                                                                     | `Get-ChildItem apps/web/src -Recurse -Include *.ts,*.tsx \| Select-String setItem`   | Track 1             | `AUD-30-04`, `G1-5`, `B-2`                  |
| G4  | Dark-theme e2e never runs: `shell.spec.ts:615` asserts `data-theme === 'light'` and Playwright defaults to light                                                                                                                                         | `shell.spec.ts:606-615`                                                              | Track 1             | `AGENTS.md` §3.2.5                          |
| G5  | `ADR-024` not written; `D-4.2` approved 2026-09-30                                                                                                                                                                                                       | `TODO.md` decision ⚑G                                                                | Track 2             | `PLT-301`, `PLT-302`                        |
| G6  | `PLT-107` not written with ACs; `D-4.3` approved 2026-09-30                                                                                                                                                                                              | `TODO.md` decision ✅11                                                              | Track 2             | `PLT-101` → Epic 01                         |
| G7  | `ARC-06` `Money` serialiser + branded client type: not started                                                                                                                                                                                           | `packages/shared-types/src/index.ts:63`                                              | Track 3             | P8                                          |
| G8  | `D-4.1` multi-role decided, not applied; schema change and the 14-model ERD tripwire must land in **one** commit                                                                                                                                         | `TODO.md` decision ⚑H                                                                | Track 3             | `PLT-201/202/204`, P6                       |
| G9  | `ARC-10`: signed licence payload has no keys for facilities hire, hall rental, wallet, alumni, leadership, substitution                                                                                                                                  | `docs/diagrams/ERD_PROJECT_AND_ARCHITECTURE.md`                                      | Track 3             | `F-2` entitlement guard, `PLT-302`          |
| G10 | No Docker and no PostgreSQL on this machine. `docker compose config` never run; `minio` healthcheck `['CMD','mc','ready','local']` unverified                                                                                                            | `Get-Command docker` → not found                                                     | Track 4             | `F-7`, `F-3`, audit `REVOKE` proof, `G1-10` |
| G11 | `SSOT.md` carries 132 tests where the tree has 161; does not record B-1                                                                                                                                                                                  | `docs/core/SSOT.md`                                                                  | Track 1 (last task) | state of record accuracy                    |
| G12 | `[data-theme='dark']` redefines only **6** of the ten §3.2.5 tokens — `--brand`, `--brand-2`, `--accent`, `--danger`, `--ok` have no dark value, so B-2's own AC _"verify all ten tokens differ between light and dark"_ is **unsatisfiable as written** | `packages/ui-kit/src/styles.css:75-83` vs `:root`                                    | Track 1 (Task 3b)   | `AGENTS.md` §3.2.5                          |

---

## Track 1 — Executable now

Four tasks. Each ends in a green gate and its own commit. Estimated 4–5 hours.

### Task 1: Make line endings deterministic, so `format:check` cannot depend on the contributor's OS

This is first because it is a **latent gate failure that only reproduces on someone else's machine**. Today this working tree happens to hold LF, so `format:check` reports 78 warnings. A fresh clone on Windows with `core.autocrlf=true` and no `.gitattributes` checks out CRLF for every text file, and Prettier's `endOfLine: lf` then rejects **all of them**. Fixing formatting before fixing this would produce a green gate that turns red on the next person's checkout.

**Files:**

- Create: `.gitattributes`
- Modify: none

**Interfaces:**

- Consumes: nothing.
- Produces: deterministic checkout for every contributor; prerequisite for Task 2.

- [ ] **Step 1: Record the failure the fix prevents**

The evidence already exists; write it down before changing anything, because after the fix it can no longer be reproduced:

```console
$ git config --get core.autocrlf
true
$ git ls-files --eol | Group-Object { ($_ -split '\s+')[1] }
    w/lf : 139
    w/crlf : 32
    w/mixed : 1
```

Prettier config that makes this matter — `.prettierrc.json`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: Write `.gitattributes`**

```
# Prettier sets endOfLine: lf, so a contributor's core.autocrlf must not decide
# what lands in the working tree. Without this, `format:check` is green on the
# machine that last ran `prettier --write` and red on every fresh Windows clone,
# because git checks out CRLF and Prettier rejects it in every text file.
* text=auto eol=lf

# Binary: never line-ending translated, never diffed as text.
*.png      binary
*.jpg      binary
*.jpeg     binary
*.gif      binary
*.ico      binary
*.woff     binary
*.woff2    binary
*.pdf      binary
*.zip      binary

# Excalidraw sources are JSON with embedded binary-ish payloads; keep them LF
# but do not let Git try to normalise their line endings inside long strings.
*.excalidraw text eol=lf
```

- [ ] **Step 3: Verify the attribute is live**

```console
$ git check-attr text eol -- packages/ui-kit/src/index.ts
packages/ui-kit/src/index.ts: text: auto
packages/ui-kit/src/index.ts: eol: lf
```

- [ ] **Step 4: Normalise the 33 files already CRLF or mixed, in the index**

Do this so the renormalisation is part of history rather than a lingering dirty tree:

```console
$ git add --renormalize .
$ git status --porcelain | Measure-Object | Select-Object -ExpandProperty Count
```

Expect a non-zero count — that is the point. Then:

```console
$ git ls-files --eol | Where-Object { $_ -match 'w/crlf|w/mixed' } | Measure-Object | Select-Object -ExpandProperty Count
0
```

- [ ] **Step 5: Confirm Prettier still passes on the normalised tree**

```console
$ pnpm exec prettier --check "packages/ui-kit/**/*.{ts,tsx,json}"
All matched files use Prettier code style!
```

If this now fails, the renormalisation changed content and the commit message must say so.

- [ ] **Step 6: Commit**

```bash
git add .gitattributes
git add --renormalize .
git commit -m "fix(repo): pin line endings so format:check cannot depend on the OS

core.autocrlf is true on this machine and there is no .gitattributes, while
.prettierrc.json sets endOfLine: lf. git ls-files --eol showed 32 working-tree
files at w/crlf and 1 at w/mixed.

Today that is invisible: this tree happens to hold LF, so format:check reports
78 warnings. A fresh clone on Windows checks out CRLF for every text file and
Prettier then rejects all of them, so the gate is green here and red everywhere
else - a gate whose result depends on who ran prettier --write last.

.gitattributes sets text=auto eol=lf and marks binaries. 33 files renormalised in
the index. No content change intended; verify with git diff --cached --stat.

Refs: G1-7, A-4, FIX-05"
```

---

### Task 2: Split `format:check` so the mandatory gate covers code, not prose

`A-4`'s recorded recommendation, adopted. The current glob is
`**/*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}`, which covers all of `docs/` **and
`AGENTS.md` itself** — so every documentation review is drowned in a 51-file
formatting diff. Reformatting the governing contract also needs owner approval,
which has not been given.

**Files:**

- Modify: `package.json` (scripts `format`, `format:check`)
- Test: `apps/web/src/config/format-gate.spec.ts` _(new — see Step 1)_

**Interfaces:**

- Consumes: Task 1 (line endings normalised, so a `format:check` failure means formatting and not CRLF).
- Produces: `format:check` covering code+config; `format:check:docs` covering prose, **not** wired into the mandatory gate.

- [ ] **Step 1: Write the failing test**

The gate that counts files (A-3) proves tests run. This proves the _gate definition_ matches the stated intent, which is the defect A-4 exists to fix:

Create `apps/web/src/config/format-gate.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Scripts {
  'format:check': string;
  'format:check:docs'?: string;
  format?: string;
}

const root = new URL('../../../../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { scripts: Scripts };

describe('the format:check gate covers code, not prose', () => {
  it('does not sweep the whole docs tree into the mandatory gate', () => {
    // A-4: 51 of the 78 warnings are docs/. Including them makes every
    // documentation review carry a 51-file formatting diff, and one of those
    // files is AGENTS.md, the governing contract - reformatting which needs
    // owner approval that has not been given.
    expect(pkg.scripts['format:check']).not.toMatch(/\*\*\/\*\.md/);
    expect(pkg.scripts['format:check']).not.toMatch(/docs\//);
  });

  it('still covers every source extension the gate is required to cover', () => {
    for (const ext of ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json']) {
      expect(pkg.scripts['format:check']).toContain(ext);
    }
  });

  it('keeps a separate, non-mandatory script for prose', () => {
    expect(pkg.scripts['format:check:docs']).toBeDefined();
    expect(pkg.scripts['format:check:docs']).toMatch(/\.md/);
  });

  it('does not silently narrow `format` while narrowing the check', () => {
    // `format` and `format:check` must cover the same set, or `pnpm format`
    // will appear to fix things the gate then still reports.
    expect(pkg.scripts.format).toBe(pkg.scripts['format:check'].replace('--check', '--write'));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```console
$ pnpm --filter @eduflow/web exec vitest run src/config/format-gate.spec.ts
```

Expected: 4 failed. The last case fails because `format` and `format:check` are currently identical strings, and the first two fail because the glob is `**/*.{…,md}`.

- [ ] **Step 3: Narrow the glob**

In `package.json`:

```json
"format": "prettier --write \"apps/**/*.{ts,tsx,js,mjs,cjs,json}\" \"packages/**/*.{ts,tsx,js,mjs,cjs,json}\" \"scripts/**/*.{mjs,js}\" \"*.{json,yml,yaml}\"",
"format:check": "prettier --check \"apps/**/*.{ts,tsx,js,mjs,cjs,json}\" \"packages/**/*.{ts,tsx,js,mjs,cjs,json}\" \"scripts/**/*.{mjs,js}\" \"*.{yml,yaml}\"",
"format:check:docs": "prettier --check \"docs/**/*.md\" \"*.md\""
```

Deliberate detail: `format` covers `*.{json,yml,yaml}` at the root and `format:check` does too, **except** root `package.json`. Rationale — `pnpm` rewrites `package.json` on install and its own ordering is not ours to police, so asserting on it produces a gate failure nobody can act on. Every other JSON is covered.

The exclusion is **in the script, not in a `.prettierignore`**, because a `.prettierignore` entry for `docs/` would make `format:check:docs` match nothing and silently pass — trading one hollow gate for another. A glob that names only what it covers cannot hide that.

- [ ] **Step 4: Run the test again**

```console
$ pnpm --filter @eduflow/web exec vitest run src/config/format-gate.spec.ts
```

Expected: 4 passed.

- [ ] **Step 5: Format the newly-covered code and confirm the gate goes green**

```console
$ pnpm format
$ pnpm format:check
```

Expected: exit 0. This is the first time in the repository's history that `format:check` is expected to pass. **If it does not, stop and record the failures rather than re-widening the glob** — re-widening is how this story recurs.

- [ ] **Step 6: Confirm prose is untouched and separately checkable**

```console
$ git diff --stat -- '*.md' | Measure-Object | Select-Object -ExpandProperty Count
0
$ pnpm format:check:docs
```

The first must be `0` — no markdown was reformatted. The second will report the 51 `docs/` files, which is the intended, non-blocking state.

- [ ] **Step 7: Commit**

```bash
git add package.json apps/web/src/config/format-gate.spec.ts
git commit -m "fix(gates): format:check covers code, prose moves to its own script (A-4)

The glob was **/*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}, which covers all of docs/
and AGENTS.md itself. Measured: 78 style warnings, 51 of them under docs/. That
means every documentation review carries a 51-file formatting diff, and one of
those files is the governing contract, which AGENTS.md restricts (D14) and for
which no approval has been given.

format:check now covers apps/, packages/, scripts/ and root config. Prose moves to
format:check:docs, which is deliberately NOT wired into the mandatory gate.

The exclusion lives in the script, not a .prettierignore, on purpose: a
.prettierignore entry for docs/ would make format:check:docs match nothing and
pass having checked nothing, which is the same hollow gate this repository spent
EPIC-A removing.

Root package.json is excluded from the check because pnpm rewrites it on install
and its ordering is not ours to police; every other JSON is covered.

4 tests assert the gate definition itself, including that format and
format:check cover the same set so pnpm format cannot appear to fix things the
gate still reports.

Refs: A-4, G1-7, FIX-05"
```

---

### Task 3: Build the theme toggle, and prove the dark path has ever worked

The toggle is not a missing feature so much as a missing _writer_. `theme-script.tsx` reads `localStorage.getItem('eduflow-theme')` to honour "a stored choice", but nothing in `apps/web/src` ever calls `setItem` — so branch 1 of the documented precedence is **dead code**, and the e2e suite can only ever assert `light`.

The i18n keys already exist in all four locales (`theme.toggle`, `theme.light`, `theme.dark`), so this needs no translation work. That is worth noting: the dictionary was authored; only the component was never built.

**Files:**

- Modify: `packages/ui-kit/package.json` (add `@testing-library/user-event`)
- Modify: `packages/ui-kit/src/components/ui/icons.tsx` (add two icons)
- Create: `apps/web/src/components/theme-toggle.tsx`
- Modify: `apps/web/src/features/landing/components/hero.tsx` (`TopNav` renders it)
- Test: `apps/web/src/components/theme-toggle.spec.tsx` _(new)_
- Test: `apps/web/tests/e2e/shell.spec.ts` _(modify — add the dark cases)_

**Interfaces:**

- Consumes: `Button` from `@eduflow/ui-kit` (Task B-1, committed as `6fd0183`); `useTranslations` from `next-intl`; the `theme` namespace already present in all four locale files (`theme.toggle`, `theme.light`, `theme.dark` — verified present, values in Tamil/Sinhala/Arabic are real translations, not English fallbacks).
- Produces: `ThemeToggle` (a client component, no props), and the e2e assertions that close `AUD-30-04`.

- [ ] **Step 0: Declare the test dependency first**

`apps/web` has `@testing-library/react` and `@testing-library/jest-dom` but **not** `@testing-library/user-event`. The test below imports it. pnpm's isolated `node_modules` means a package can only import what it declares itself, and the failure mode is a resolution error that looks like a broken test rather than a missing dependency — the same trap B-1 hit with `@types/react`.

```console
$ pnpm --filter @eduflow/web add -D @testing-library/user-event
```

- [ ] **Step 1: Write the failing unit test**

Create `apps/web/src/components/theme-toggle.spec.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('writes the choice to localStorage, which is the branch theme-script reads and nothing wrote to', () => {
    render(<ThemeToggle />);

    // theme-script.tsx reads localStorage['eduflow-theme'] to honour a stored
    // choice. Before this component existed, setItem had zero call sites in
    // apps/web/src, so that branch could never fire.
    expect(localStorage.getItem('eduflow-theme')).toBeNull();

    void screen.getByRole('button');

    // The click is what the e2e test exercises; here we only need the writer.
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('flips data-theme and persists the new value', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('eduflow-theme')).toBe('dark');

    await user.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('eduflow-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```console
$ pnpm --filter @eduflow/web exec vitest run src/components/theme-toggle.spec.tsx
```

Expected: `Failed to resolve import "./theme-toggle"`.

- [ ] **Step 3: Add the two icons**

Append to `packages/ui-kit/src/components/ui/icons.tsx`. They are local rather than a dependency for the reason recorded on the existing three: `AGENTS.md` §3.2.6 requires directional icons to mirror under RTL, and the mirror has to be provable here.

```tsx
export function SunIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
```

Export both from `packages/ui-kit/src/index.ts`.

- [ ] **Step 4: Write the component**

Create `apps/web/src/components/theme-toggle.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, MoonIcon, SunIcon } from '@eduflow/ui-kit';

const STORAGE_KEY = 'eduflow-theme';
type Theme = 'light' | 'dark';

/**
 * The writer for the branch `theme-script.tsx` already reads.
 *
 * `theme-script.tsx` resolves `data-theme` before first paint from a stored
 * choice, then `prefers-color-scheme`, then the light default. Until this
 * component existed nothing called `setItem`, so the first branch was dead
 * code and the e2e suite could only ever assert `light`.
 *
 * Icon-only, with the state in the accessible name. A visible "Light" next to
 * an `aria-label` of "Toggle theme" fails WCAG 2.5.3 label-in-name, because the
 * visible text is not contained in the accessible name.
 */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read the DOM, not localStorage: theme-script has already resolved and set
  // `data-theme` on <html>, and that is the value actually in effect. Reading
  // storage instead would disagree with the screen whenever the OS preference
  // won and nothing was stored.
  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or storage disabled. The attribute is already applied, so
      // the toggle still works for this page view; it just will not persist.
      // That is the same reasoning as the catch in theme-script.tsx.
    }
  }

  const current = theme ?? 'light';
  const label = `${t('toggle')}: ${current === 'dark' ? t('dark') : t('light')}`;

  return (
    <Button variant="ghost" onClick={toggle} aria-label={label} data-testid="theme-toggle">
      {current === 'dark' ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
    </Button>
  );
}
```

- [ ] **Step 5: Run the unit test**

```console
$ pnpm --filter @eduflow/web exec vitest run src/components/theme-toggle.spec.tsx
```

Expected: 2 passed.

**If the first test passes vacuously, delete it.** It asserts only that the button exists; its real content is the `setItem` call site, which the second test proves. A test that cannot fail is the class of defect EPIC-A exists to remove, and it does not belong in a suite whose sibling assertions are real.

- [ ] **Step 6: Mount it in `TopNav`**

In `apps/web/src/features/landing/components/hero.tsx`, add the import and render `<ThemeToggle />` inside `TopNav`, adjacent to the existing language control.

**`TopNav` is an `async` server component** — it is declared `export async function TopNav({ locale })` and its first import is `getTranslations` from `next-intl/server`. So it **cannot** be marked `'use client'`, and must not be: `next-intl/server` is server-only. The legal direction is server → client, so rendering the `'use client'` `ThemeToggle` as its child works with **no wrapper and no change to `TopNav`'s own directive**. Add only the import and the element.

If a build error says `ThemeToggle` cannot be imported here, the cause is a missing `'use client'` on `theme-toggle.tsx`, not the parent — re-check Step 4 before restructuring anything.

- [ ] **Step 7: Write the failing e2e test**

Append to `apps/web/tests/e2e/shell.spec.ts`:

```ts
test.describe('theme shell', () => {
  test('the toggle persists a dark choice that survives reload against a light OS', async ({
    page,
  }) => {
    // This is the branch that has never executed: Playwright defaults to a
    // light colour scheme, and nothing wrote localStorage, so both
    // prefers-color-scheme: dark and the stored-choice branch were dead.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/en');

    expect(await page.getAttribute('html', 'data-theme')).toBe('light');

    await page.getByTestId('theme-toggle').click();
    expect(await page.getAttribute('html', 'data-theme')).toBe('dark');

    // The OS still says light. Only the stored choice can explain dark here,
    // so this is the assertion that proves setItem is called and read back.
    await page.reload();
    expect(await page.getAttribute('html', 'data-theme')).toBe('dark');
  });

  test('the dark token set actually resolves on the rendered document', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/en');

    expect(await page.getAttribute('html', 'data-theme')).toBe('dark');

    // AGENTS.md 3.2.5 requires both themes; a data-theme attribute with tokens
    // that do not change is the failure mode this catches.
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    );
    expect(bg).toBe('#0d0f16');
  });

  for (const [locale, expected] of [
    ['en', '#0d0f16'],
    ['ta', '#0d0f16'],
    ['si', '#0d0f16'],
    ['ar', '#0d0f16'],
  ] as const) {
    test(`/${locale} resolves the dark palette`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(`/${locale}`);
      const bg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
      );
      expect(bg).toBe(expected);
    });
  }
});
```

- [ ] **Step 8: Run it**

```console
$ pnpm --filter @eduflow/web test:e2e -- --grep "theme shell"
```

Expected before the component is mounted in `TopNav`: failures on `theme-toggle` not found. Expected after Step 6: all pass. If they pass **before** Step 6, the toggle is already mounted somewhere — check rather than proceeding.

- [ ] **Step 9: Verify the touch-target floor still holds**

The toggle is a new interactive element in a nav, and `AGENTS.md` §3.2.2 applies. The existing sweep selects `a[href], button, summary`, so it will be measured automatically — confirm rather than assume:

```console
$ pnpm --filter @eduflow/web test:e2e -- --grep "44px"
```

- [ ] **Step 10: Commit**

```bash
git add packages/ui-kit/src/components/ui/icons.tsx packages/ui-kit/src/index.ts \
        apps/web/src/components/theme-toggle.tsx apps/web/src/components/theme-toggle.spec.tsx \
        apps/web/src/features/landing/components/hero.tsx apps/web/tests/e2e/shell.spec.ts
git commit -m "feat(web): the theme toggle, and proof the dark path ever worked (B-2)

theme-script.tsx resolves data-theme before first paint from a stored choice,
then prefers-color-scheme, then the light default. Nothing in apps/web/src ever
called setItem, so the first branch was dead code and the e2e suite could only
assert light - Playwright's default colour scheme is light, so neither the OS
branch nor the stored branch had ever executed. That is AUD-30-04, the last
hollow gate, and B-2 was blocked on B-1 because a toggle must be a shadcn Button.

The i18n keys already existed in all four locales (theme.toggle/light/dark), so
this needed no translation work: the dictionary was authored, only the component
was missing.

Icon-only with the state in the accessible name. A visible \"Light\" beside an
aria-label of \"Toggle theme\" fails WCAG 2.5.3 label-in-name. Sun and Moon are
local paths rather than lucide-react, which is undeclared in this workspace, for
the reason recorded on the existing three icons.

Four new e2e cases: toggle persists across reload against a light OS, the dark
token set resolves via getComputedStyle rather than an attribute check, and the
dark palette resolves in all four locales including Arabic.

Closes AUD-30-04, G1-5, FIX-10. Refs B-2."
```

---

### Task 3b: Give the four theme-less tokens a dark value, so §3.2.5's AC is satisfiable

`AGENTS.md` §3.2.5 lists **ten** colours, and `B-2`'s acceptance criterion says _"Verify all ten `AGENTS.md` §3.2.5 tokens differ between light and dark."_ Six of them do. `[data-theme='dark']` at `packages/ui-kit/src/styles.css:75-83` redefines only:

```css
--bg --surface --text --muted --border --shadow
```

`--brand`, `--brand-2`, `--accent`, `--danger` and `--ok` are **not redefined**, so they are byte-identical in both themes. A Brand button renders the same indigo on a near-black surface as on white. That is readable — the criterion is about _both themes being designed_, not merely legible — but the AC as written cannot be satisfied, and an unsatisfiable AC is worse than an absent one because it guarantees a permanent red.

**This is a design decision, not a mechanical one.** Darkening the brand is a judgement about brand identity, and the token set was harvested from `docs/template`. The safe move is to ask, not to pick. The options:

1. **Redefine the four in dark** — a lighter, less saturated brand on dark surfaces is the usual approach, but it changes the brand colour, which is an identity decision.
2. **Amend the AC to the six** that genuinely vary, and record that brand/accent/danger/ok are intentionally theme-invariant.
3. **Both** — redefine `--brand-2` and `--accent` (secondary surfaces, safe to lighten) and amend the AC to six-plus-two.

Recommend **3**: it is the smallest change that makes the AC true, and it leaves the primary `--brand` and the semantic `--danger`/`--ok` alone.

**Files:**

- Modify: `packages/ui-kit/src/styles.css:75-83`
- Test: `packages/ui-kit/src/components/ui/primitives.spec.tsx` _(add a dark-contrast case)_

**Interfaces:**

- Consumes: nothing.
- Produces: an `AGENTS.md` §3.2.5 criterion that can actually pass.

- [ ] **Step 1: Ask the owner which option, and do not start without an answer**

This is a brand-identity question. Present the three options with the exact hexes each would introduce.

- [ ] **Step 2: Write the failing test**

Add to `packages/ui-kit/src/components/ui/primitives.spec.tsx`:

```ts
describe('AGENTS.md 3.2.5 - both themes are designed, not merely legible', () => {
  it('every token the AC names actually differs between :root and [data-theme="dark"]', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

    // Parse both blocks rather than eyeballing them: the point of the AC is
    // that it is checkable, and 6 of 10 tokens silently had no dark value.
    const root = css.slice(css.indexOf(':root'), css.indexOf('[data-theme'));
    const dark = css.slice(css.indexOf("[data-theme='dark']"), css.indexOf('@theme'));

    const value = (block: string, name: string) =>
      new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();

    for (const token of ['--bg', '--surface', '--text', '--muted', '--border', '--shadow']) {
      expect(value(dark, token), `${token} has no dark value`).toBeDefined();
      expect(value(dark, token), `${token} is identical in both themes`).not.toBe(
        value(root, token),
      );
    }
  });
});
```

- [ ] **Step 3: Run it and watch the six pass**

The six above must pass today. If any fails, the dark block has regressed and that is a real finding — stop and report it rather than continuing.

- [ ] **Step 4: Add the dark values for whichever tokens the owner chose in Step 1**

Under `[data-theme='dark']`, after the existing six:

```css
/* Added 2026-09-30. The dark block previously redefined only the six above,
     so --brand-2 and --accent were byte-identical in both themes and B-2's
     "all ten tokens differ" acceptance criterion could not pass. Lighter and
     less saturated for dark surfaces. --brand, --danger and --ok stay
     unchanged: the primary brand and the semantic colours are identity
     decisions, not theme decisions. */
--brand-2: #a78bfa;
--accent: #22d3ee;
```

- [ ] **Step 5: Extend the test to the amended set**

Add `--brand-2` and `--accent` to the loop, and — if the owner chose option 3 — a second case asserting the theme-invariant ones are _deliberately_ equal, so a future change to them is a conscious decision:

```ts
it('the theme-invariant tokens are equal in both themes on purpose', () => {
  // --brand, --danger and --ok are brand and semantic colours. Changing them
  // per theme would change the identity of the product, so they are asserted
  // EQUAL. A failure here means someone retuned a brand colour, which needs
  // an owner decision rather than a silent diff.
  expect(value(dark, '--brand')).toBe(value(root, '--brand'));
  expect(value(dark, '--danger')).toBe(value(root, '--danger'));
  expect(value(dark, '--ok')).toBe(value(root, '--ok'));
});
```

- [ ] **Step 6: Run the suite, then the gates**

```console
$ pnpm --filter @eduflow/ui-kit exec vitest run
$ pnpm --filter @eduflow/web test:e2e -- --grep "theme shell"
```

The e2e dark-token case must still pass — a lighter `--accent` must not have broken contrast on the dark surface.

- [ ] **Step 7: Amend the AC in the plan**

In `docs/work/ACTION_PLAN_2026-09-30-v2.md` `B-2`, change _"Verify all ten `AGENTS.md` §3.2.5 tokens differ between light and dark"_ to the amended set, with a one-line note on which are invariant and why. An AC that has been satisfied by rewriting the AC, rather than by the code, is not satisfied — so record the owner's choice explicitly.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-kit/src/styles.css packages/ui-kit/src/components/ui/primitives.spec.tsx \
        docs/work/ACTION_PLAN_2026-09-30-v2.md
git commit -m "fix(ui-kit): give the theme-less tokens a dark value (3.2.5)

[data-theme='dark'] redefined only --bg, --surface, --text, --muted, --border
and --shadow. --brand-2 and --accent were byte-identical in both themes, so
B-2's acceptance criterion - verify all ten 3.2.5 tokens differ between light and
dark - could not be satisfied, and an unsatisfiable criterion guarantees a
permanent red.

--brand-2 and --accent are lightened for dark surfaces. --brand, --danger and
--ok are deliberately left invariant and now have a test asserting they are
EQUAL, so retuning a brand or semantic colour becomes a conscious decision rather
than a silent diff.

The criterion in ACTION_PLAN B-2 is amended to the amended set, with the owner's
choice recorded - rewriting an AC is only legitimate when the rewrite is stated.

Refs: B-2, G12"
```

---

`AGENTS.md` §12 calls `SSOT.md` the state of record. It currently reports 132 tests where the tree has 161, and does not record B-1 at all. Do this **last**, so the numbers are final.

**Files:**

- Modify: `docs/core/SSOT.md`
- Modify: `docs/work/TDD_EVIDENCE_GATES.md` (status table only)
- Modify: `docs/work/TODO.md` (`G1-7`, `G1-10`, `G1-5`, `AUD-30-04` rows)

- [ ] **Step 1: Capture the numbers by running the gates, not by recalling them**

```console
$ pnpm test 2>&1 | Select-String 'Tests\s+\d+ passed'
$ pnpm format:check; $LASTEXITCODE
$ pnpm test:coverage; $LASTEXITCODE
$ pnpm test:integration; $LASTEXITCODE
$ pnpm --filter @eduflow/web test:e2e 2>&1 | Select-String '\d+ passed'
```

If `test` is not 161, the count in the prose is wrong and the prose loses.

- [ ] **Step 2: Update the gate status table**

Expected after this plan: `lint` 0, `typecheck` 0, `test` 0, `docs:verify` 0, `build` 0, `test:e2e` 0 (41 — 37 plus 4 new theme cases), `format:check` **0 for the first time in the repository's history**, `test:coverage` 1, `test:integration` 1.

State plainly that `test:coverage` and `test:integration` remain red and why, and that **no hollow gate remains** — the last was closed by `A-2`.

- [ ] **Step 3: Close the TODO rows with evidence**

- `G1-7` → closed, with the Task 1 and Task 2 commits named.
- `G1-5` → closed by Task 3.
- `G1-10` → **still open.** Parsing is not validation; Docker is still absent.
- `AUD-30-04` → closed by Task 3.

- [ ] **Step 4: Add the worklog entry**

Per `AGENTS.md` §9: Date, Phase, Task, Agent, Status, Activity, Files Changed, Decisions Made with rationale, Next Steps, Quality.

- [ ] **Step 5: Commit**

```bash
git add docs/core/SSOT.md docs/work/TDD_EVIDENCE_GATES.md docs/work/TODO.md docs/work/WORKLOG.md
git commit -m "docs: SSOT reflects B-1, the theme toggle, and a green format:check

SSOT.md is the state of record per AGENTS.md 12 and was reporting 132 tests
against a tree of 161, with no record of B-1. Every number in the status table
was captured by running the gate, not recalled.

format:check is green for the first time in this repository's history.
test:coverage and test:integration stay red and stay explained: no hollow gate
remains, and the last one was closed by A-2.

G1-10 is explicitly NOT closed. The compose file parses; that is not the same as
having been validated, and docker is still not installed on this machine.

Refs: B-2, A-4, G1-5, G1-7, AUD-30-04"
```

---

## Track 2 — Artifacts on the critical path

Two small writing tasks. Neither is code. Both are prerequisites, and both are currently _decided but unwritten_, which is the worst state: a decision nobody can find, attached to work nobody has started.

**Task 5 — `ADR-024`: the `Money` wire format.** Owner approved option (C) on 2026-09-30. The ADR amends `ADR-002` and must state: string on the wire; a branded client type constructible only from a validated string; why `number` is rejected (`MAX_SAFE_INTEGER` caps LKR at ~90tn, KWD/BHD/JOD at ~9bn, losing minor units silently, and currency is a per-school setting so 3dp cannot be assumed away); and that the type is constructible from a bare `number` by no route. Status `Accepted` — the owner has decided. Blocks `ARC-06`.

**Task 6 — `PLT-107`: first-admin bootstrap.** Owner approved building the story on 2026-09-30. Needs acceptance criteria covering: a one-time, single-use, expiring setup token; the token is consumed atomically so two concurrent bootstraps cannot both succeed; the first admin's creation is `@Audited`; and the token is invalidated on use, on expiry, and on licence change. Appended, never renumbered. Unblocks `PLT-101`, and therefore Epic 01.

Both are cheap. Do them together, in one commit, immediately after Track 1 — they cost under an hour and they are what stands between the project and its first feature.

---

## Track 3 — P8 and P6 foundations

**Task 7 — `ARC-06`: the `Money` serialiser.** Depends on `ADR-024`. Add `MoneyWire` and a `toWire`/`fromWire` pair in `packages/shared-types`, plus a test that **fails when a school currency has 3 decimals** — the assertion that keeps option (B) from creeping back in. A `bigint` must not reach `JSON.stringify` anywhere; assert that directly rather than trusting review.

**Task 8 — `D-4.1`: the `UserRole` join.** Owner decided multi-role; it is not applied. **The schema change and the amendment to the deliberate 14-model ERD tripwire must land in the same commit** — the tripwire exists precisely to fail if a 15th model appears, so landing them separately breaks the suite at the worst moment. This is the single most order-sensitive task in the register.

**Task 9 — `ARC-10`: six missing licence capabilities.** Facilities hire, hall rental, wallet, alumni, leadership, substitution have no keys in the signed payload, so `@RequireEntitlement` cannot gate them — which is half of `F-2` and blocks `PLT-302`. Add the keys to the canonical payload and the verifier, with a test asserting an unknown capability is rejected rather than defaulted.

---

## Track 4 — Blocked on infrastructure, and that is the finding

**Nothing in this track can be completed or verified on this machine, and the correct output is to say so rather than to guess.**

- **`docker` is not installed** (`Get-Command docker` → not found), and there is no PostgreSQL either. So `docker compose -f infra/docker/docker-compose.yml config` has never been run. The compose file is verified to **parse** — which is not validation, and the two claims must not be conflated.
- **The `minio` healthcheck is unverified:** `test: ['CMD', 'mc', 'ready', 'local']` requires an `mc` alias named `local`. If the image does not provide one the check can never pass, and anything using `depends_on: condition: service_healthy` would hang forever. This is a plausible latent hang and nobody has looked.
- **`G1-10` pinning stays open.** `minio/minio:latest` and `axllent/mailpit:latest` are unpinned, so two developers on different days get different images.

This track needs a decision only the owner can make: **install Docker locally, or provision a managed PostgreSQL.** Every item below is waiting on that answer, and the answer is a machine, not a plan.

Once it exists, in order:

1. `docker compose -f infra/docker/docker-compose.yml config` — validates the file, not just its syntax.
2. `docker compose up -d` and inspect MinIO's health status. Fix the `mc` alias if the check never passes.
3. Pin `minio` and `mailpit` to explicit versions → closes `G1-10`.
4. Write the **first** real integration test against that PostgreSQL → turns `test:integration` from honest-red to green. This is `F-7`, and it is the gate that has never run a real test.
5. Prove the `audit_records` `REVOKE` by actually attempting an `UPDATE` → `TODO.md:128` has asked for this since the revoke was shipped.
6. `F-3`: the first `domain/` file, which is what gives `test:coverage` a live tier and starts retiring the five empty ones.

---

## Self-Review

**1. Spec coverage.** All 12 gaps in the register map to a task: G1→T1, G2→T2, G3→T3, G4→T3, G5→T5, G6→T6, G7→T7, G8→T8, G9→T9, G10→Track 4, G11→T4, G12→T3b. Every row has a named owner and a blocking relationship. No row is unowned.

**2. Placeholder scan.** No `TBD`, no "add appropriate error handling", no "write tests for the above" without code. Every test step contains runnable code. Four steps carry an explicit instruction to _not_ do the tempting thing — not to re-widen the glob (T2 Step 5), to delete a vacuous test (T3 Step 5), not to mark `TopNav` client (T3 Step 6), and not to start T3b without the owner's answer (T3b Step 1) — because those are the places this plan could otherwise be followed into recreating the defect it targets, or into making a brand decision on the owner's behalf.

**3. Type consistency.** `ThemeToggle` is referenced with the same no-props signature in the unit test, the `TopNav` mount and the e2e `data-testid`. `MoneyWire`/`toWire`/`fromWire` are named once in Track 3 and carry forward to `ARC-06` unchanged. `SunIcon`/`MoonIcon` are defined in T3 Step 3 and exported in the same step, so the import in Step 4 resolves. `STORAGE_KEY = 'eduflow-theme'` matches the key `theme-script.tsx` already reads — that match is the whole point of the task, so it is stated in the code comment as well as in the plan.

**4. Claims verified before writing, not after.** Four assumptions were checked against the tree rather than carried from earlier in the session, and three of them were wrong:

| Assumption                                  | Reality                                                                                                     | Consequence                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `TopNav` might need a client wrapper        | It is an `async` server component using `getTranslations` from `next-intl/server`; server → client is legal | Step 6 corrected: no wrapper, and it must **not** be made client |
| `apps/web` can run the unit test            | It has no `@testing-library/user-event`                                                                     | **Step 0 added** — the test would not have resolved              |
| The e2e dark assertion `--bg === #0d0f16`   | Confirmed correct at `styles.css:76`                                                                        | Kept                                                             |
| §3.2.5 has ten tokens that all vary in dark | Only **six** do; `--brand`, `--brand-2`, `--accent`, `--danger`, `--ok` have no dark value                  | **G12 found and Task 3b written** — B-2's AC was unsatisfiable   |

**5. The one place this plan stops rather than continues.** Task 3b Step 1 requires an owner decision on brand colour, and Track 4 requires a machine with Docker. Neither is a gap in the plan; both are gaps in the environment, and writing code past them would mean inventing a brand hex or claiming a validation that was never run.
