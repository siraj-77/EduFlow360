# PLT-1004-T1 — Landing page gap list (P0, 8 pts)

**Story:** `PLT-1004` Tasks 1–4 / AC-1 / AC-4 (public pages port)
**Branch:** `feat/plt-1004-public-pages` (PR #19)
**Status:** **gap list, not a rebuild** — the landing page is already ported
(see `apps/web/src/features/landing/`) and its donor template is recoded as a
**`measured`** parity baseline in `visual-regression.json` (0.14 tolerance,
measured 2026-10-13 at 13.13/12.86/13.11/12.05%).
**Written:** 2026-10-15, against the tree at `acf1076`.

## 1. The ruling that gates this story

`PLT-1004` AC-4 says keep the marketing claims unchanged or omit and record
the discrepancy. `AGENTS.md` §2.8 says those claims are **false** and must not
be carried over; `AGENTS.md` wins under its own precedence clause.

**Default applied while the ruling is open:** omit the claims and record the
discrepancy here and in `docs/work/TODO.md` (see §5).
The port already implements this choice on both surfaces:

- `apps/web/src/features/landing/components/hero.tsx` — chips carry labels only
  (`kpiStudents`, `kpiAttendance`, `kpiFees`, `kpiLeave`); no count is invented.
- `apps/web/tests/e2e/shell.spec.ts` — asserts `200+`, `1.2M`, `Free Trial` and
  `Mobile for Everyone` are **absent** from `/en`.
- `docs/design/FRONTEND_TEMPLATE.md` and `visual-regression.json §landing`
  record both decisions for review.

## 2. Known, principled divergences (not bugs — do not "fix" to chase 0%)

1. **Copy.** All marketing copy is omitted rather than replaced by a different
   unverified number (`Hero` comment, D28). The preview chip row therefore has
   no figures.
2. **Stats row height.** Because the `200+/1.2M/99.9%` row is absent, the row
   below the hero reflows. This is intentional and is the bulk of the 13% diff.
3. **Template markup defect.** The approved donor landing view has an unclosed
   `.features` div that renders a stray `Mobile for Everyone` card and a
   duplicated footer. **The port must not reproduce it** — recorded in
   `visual-regression.json §landing` so PLT-1004 is not tempted to "match" a
   broken template.
4. **Language picker is links, not a Dropdown.** `AGENTS.md` §3.2.1 bans raw
   `<button>` and the shadcn `DropdownMenu` (`FIX-11`) does not exist yet, so
   the picker is a `<details>`/`<summary>` disclosure driven by links. Converts
   to a real `DropdownMenu` when `FIX-11` lands.
5. **No `prefers-reduced-motion` gate on the landing motion.** The donor CSS
   animation defaults ship as-is; `AGENTS.md` §3.2.7 (≤200ms + respect
   `prefers-reduced-motion`) is not currently enforced on the landing's
   animations. Track as a follow-up, not a blocker for this story.
6. **ThemeToken radius pairing (`--radius-control` 9px light / 8px dark).** This
   is a pinned divergence from the template's single 9px, and it is covered by
   `auth-alert.spec.tsx`; no new T1 work.
7. **No ADR-022 font files are self-hosted.** The font stack is system-first
   (`FIX-12`) with deliberate tofu risk for unmapped scripts; out of T1 scope.

## 3. Open T1 defaults — no owner decision needed

Already shipped or explicitly deferred (record only):

- `Hero` preview chip carries labels, no figures.
- `ThemeToggle` (`features/theme/components/theme-toggle.tsx`, ui-kit `Button`)
  is wired into `TopNav` (`FIX-10` closed 2026-10-05).
- `LanguagePicker` reads locale order from `LOCALE_DISPLAY_ORDER`
  (English → Sinhala → Tamil → Arabic), not `SUPPORTED_LOCALES`.

## 4. Gaps that remain — and who owns them

| Gap | Owner / story |
|---|---|
| `FIX-11` shadcn `DropdownMenu` to replace the `<details>` language picker | Owner-keyed (FIX-11) |
| `FIX-12` self-hosted ADR-022 font stack — per-script proof, including PDF pipeline | Owner-keyed (FIX-12) |
| `prefers-reduced-motion` envelope on the landing's animation CSS | PLT-1004 follow-up |
| Owner confirmation of ⚑N (marketing copy) | ⚑N — human gate |
| Owner confirmation of `template-checksums.json` | PLT-1003 T1 — human gate |

## 5. AC-4 discrepancy record (owner-facing)

Per `PLT-1004` AC-4 and `AGENTS.md` §2.8: the false claims
`"Trusted by 200+ schools"`, `"1.2M Students Managed"`, `"Start Free Trial"`
and the template's `"Mobile for Everyone"` card are **deliberately not carried
over to the port**. Their absence is asserted by
`apps/web/tests/e2e/shell.spec.ts` and visible in the 13.13/12.86/13.11/12.05%
visual tolerance. If the owner rules otherwise, the strings must be added in
both `i18n-resources` and the test, and the tolerance re-measured — no silent
unilateral change either way.

## 6. T1 exit check (to run before close-out)

Run before recording the story as done:

- `pnpm --filter @eduflow/web typecheck`
- `pnpm --filter @eduflow/web lint`
- `pnpm --filter @eduflow/web test`
- `pnpm visual:check` (all 20 baselines present)
- `pnpm visual:compare` (landing within 0.14, all others unchanged)
- `pnpm --filter @eduflow/web test:e2e` (43/43, no regression on the
  no-false-claims case)
- `pnpm check:route-guards` (122 files)
- Updated `WORKLOG.md` and `TODO.md` in the same commit
