# ADR-021 — `next-intl` Is the Web i18n Library

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-29
**Deciders:** Owner, 2026-09-29 (D29) — agent-recommended, owner-ratified
**Affects:** `apps/web` · `packages/i18n-resources` · `AGENTS.md` §2.8 · SSR locale resolution
**Resolves:** the unrecorded bypass of `AGENTS.md:214`'s "confirm before adding"

---

## Context

`AGENTS.md` §3.1 lists the i18n stack as:

> `| i18n | per Master Plan §2.1 (\`next-intl\`/\`react-i18next\` web, \`i18next\` mobile) — confirm before adding |`

The clause names `next-intl` **first**. It is one of two sanctioned web options, and the mobile half (`i18next`) is a separate decision for milestone 2 (`D5`, `ADR-005`).

**`next-intl` is installed and wired.** `apps/web/package.json` declares `"next-intl": "^3.26.3"`. Three files use it:

| File | Use |
|---|---|
| `apps/web/src/i18n/routing.ts` | `defineRouting` from `next-intl/routing`, with `localePrefix: 'always'` |
| `apps/web/src/i18n/request.ts` | `getRequestConfig` from `next-intl/server` |
| `apps/web/proxy.ts` | `createNextIntlPlugin('./src/i18n/request.ts')` |

The surrounding design is coherent with it. `packages/shared-types` exports `SUPPORTED_LOCALES = ['en','ta','si','ar']` and `DEFAULT_LOCALE = 'en'`, matching `AGENTS.md` §1 and `SRS` NFR-06. `packages/i18n-resources` ships all four locale files, enforced by a 10-case parity suite that checks no missing keys, no extra keys, no empty values, and that no locale copies `nav.dashboard` verbatim.

**The defect is procedural.** `AGENTS.md:214` says *"confirm before adding"*. It was added. No confirmation was recorded and no ADR was written, so the decision existed only in a `package.json` and three source files — the precise state `docs/adr/README.md:98` exists to prevent. It was catalogued as DOC-05, one of four decisions taken without a record.

Two further facts favour ratifying rather than swapping. `proxy.ts`'s plugin wrapper is the canonical `next-intl` integration point, and the locale-parity suite already passes against real translations — `ar.nav.dashboard` = لوحة المعلومات, `si.nav.dashboard` = උපකරණ පුවරුව, `ta.nav.dashboard` = டாஷ்போர்டு. A swap would discard verified work to correct a filing omission.

## Decision

**`next-intl` is the web i18n library. `react-i18next` is not used on the web.**

- Locale routing, message loading and SSR negotiation use `next-intl`.
- **`i18next` is for mobile only** (milestone 2), per `AGENTS.md` §3.1. The two never coexist in one app.
- Locale keys are authored in `packages/i18n-resources` and exported to the web app. The web app does **not** own message files.
- `SUPPORTED_LOCALES` in `packages/shared-types` is the single source of truth for the locale list. `next-intl`'s routing config and the JSON file set are both derived from it, never separately enumerated.
- **`AGENTS.md §3.1`'s "confirm before adding" clause is satisfied by this ADR** for `next-intl`. It stands for anything not named here.

### What this ADR does not decide

- **Font stack.** `AGENTS.md` §3.2.7 requires Tamil, Sinhala and Arabic to render on screen *and* in generated PDFs. `DSN-04` and ⚑4 cover that; it is a design decision, not an i18n-library one. A provisional Noto stack is in `packages/ui-kit/src/styles.css`.
- **Mobile.** `i18next` for `apps/mobile` is deferred to milestone 2 and needs its own ADR when that tree exists.
- **The PDF pipeline's text shaping.** Headless Chromium and PDFKit/Handlebars need different font-embedding work (`docs/design/FRONTEND_TEMPLATE.md` §7 notes the donor template says nothing about it).

## Consequences

### Positive
- The decision is now discoverable. An agent that finds `next-intl` in `package.json` can find the reasoning, and — more importantly — will not "helpfully" migrate to `react-i18next` because the contract once suggested it.
- `AGENTS.md:214`'s confirm-before-adding gate is satisfied rather than bypassed.
- SSR locale resolution is the library's reason to exist, and the app needs it: `AGENTS.md` §2.8 requires `dir` set on `<html>` before first paint.
- RTL is driven from the resolved locale rather than duplicated per page, which is what `AGENTS.md` §3.2.6 requires.

### Negative / accepted costs
- **`next-intl` is App-Router-specific.** It ties the web app to Next's routing model. Accepted: `AGENTS.md` §3.1 mandates Next.js, so there is no alternative runtime to preserve.
- **A build-time plugin dependency.** `next-intl/plugin` wraps the bundler config, which is why the file sat at `apps/web/proxy.ts` with a non-request-handler shape. That specific misplacement is FIX-04, unrelated to this ADR, but it is the kind of coupling this library brings.
- **The swap cost, if this ADR is ever reversed, is higher than a package.json edit.** Message files, routing config and the parity suite are all library-coupled. Accepted deliberately: the parity suite is the asset, and it ports.
- D29 was reached by an agent recommendation rather than the owner independently evaluating `react-i18next`. Flagged for later review on that basis.

### Neutral
- No change to `AGENTS.md`, `SRS` or `ARCHITECTURE.md`. `AGENTS.md` §3.1 already names `next-intl`; this ADR records the confirmation that clause demanded.
- No change to `packages/i18n-resources` — 4 files, 38 keys, parity already enforced and passing.
- No change to any `PLT-*` or `P*` identifier.

## Rejected alternatives

**❌ Switch the web to `react-i18next`.** Rejected: it is the sanctioned alternative, so this is a real option and not a strawman. It requires SSR message injection to be hand-wired, because it has no App-Router equivalent to `getRequestConfig`. It would discard a working, parity-tested setup to correct a filing omission, and it would add exactly the hand-wiring that `AGENTS.md` §3.2's "`loading.tsx` per route" and pre-paint `dir` requirements are sensitive to.

**❌ Defer the decision until the first real i18n-consuming feature.** Rejected: the library is already installed and wired into three files. Deferring would mean a decision that is *already made* stays undocumented while more code accretes on top of it. That is how DOC-05 happened.

**❌ Use `i18next` everywhere for consistency.** Rejected: `AGENTS.md` §3.1 scopes `i18next` to mobile explicitly. A single library across both apps would mean giving up `next-intl`'s SSR integration on the web, where `dir` must be correct before first paint.

**❌ Record no ADR and rely on the code.** Rejected: the code records *what*, never *why*. A future agent sees `next-intl`, sees `AGENTS.md` naming two options, and has no signal that a decision was already taken.

## The tested contract

| Guarantee | Test |
|---|---|
| All four locales have identical key sets | `packages/i18n-resources/src/index.spec.ts` — no-missing-keys, no-extra-keys, identical count |
| No locale ships an empty string | same file |
| No locale is a copy of English | anti-stub case asserting no locale repeats `nav.dashboard` verbatim |
| `dir` is correct for all four locales | `apps/web/src/lib/rtl.spec.ts` — 4 cases |
| `SUPPORTED_LOCALES` is the single source of truth | `packages/shared-types/src/index.spec.ts` |

The one thing **not** covered, and catalogued as FIX-04: locale *negotiation* has no test, because `apps/web/proxy.ts` is dead code on Next 15 — the build compiles zero middleware, so `localePrefix: 'always'` is declared and unenforced. That is a wiring defect, not a library one, and ADR-020's blocked amendment does not affect it.

## Links
- `AGENTS.md` §3.1 (i18n row — names `next-intl` first; **not amended**), §2.8 (no hard-coded user-facing strings, RTL), §3.2.6
- `apps/web/src/i18n/{routing,request}.ts` · `apps/web/proxy.ts` (**dead code, FIX-04**)
- `packages/i18n-resources` · `packages/shared-types` (`SUPPORTED_LOCALES`)
- `docs/analysis/CODE_AUDIT_2026-09-29.md` DOC-05
- `docs/work/REMEDIATION_PLAN_2026-09-29.md` EPIC-ADR
- `SSOT.md` D29 · `WORKLOG.md` 2026-09-29
- `D5` / `ADR-005` (mobile is milestone 2) · `DSN-04` / ⚑4 (font stack, undecided)

## Revisit when
- `apps/mobile` is scaffolded — `i18next` needs its own ADR then, and this one states the boundary.
- A feature needs message loading the App Router cannot serve — for example streaming a large catalogue through a server action. At that point the coupling in §"Consequences" becomes a cost worth re-pricing.
