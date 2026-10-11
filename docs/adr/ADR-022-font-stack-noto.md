# ADR-022 — Approved Font Stack: Noto Sans / Tamil / Sinhala + Noto Naskh Arabic

**Status:** ✅ **Accepted 2026-10-11 (owner)**
**Date:** 2026-10-11
**Deciders:** owner (closes `DSN-04` / ⚑4 / SSOT open question 6)
**Affects:** every web screen, every generated document · `AGENTS.md` §3.2.7
**Source:** `DSN-04` (`docs/work/GAP_ANALYSIS_2026-09-28.md`), `docs/design/FRONTEND_TEMPLATE.md` §7

---

## Context

`AGENTS.md` §3.2.7: *"Fonts must cover Tamil, Sinhala and Arabic, on screen and in
generated PDFs. Confirm the approved font stack with the owner."* The requirement
was carried as an open question in seven documents since 2026-09-28, and the code
carried a **declaration, not a decision**: `styles.css` named a plausible stack
("Font stack must cover Tamil, Sinhala and Arabic") with no `@font-face`, so
correct rendering depended entirely on whatever the viewing machine had
installed. Two schools with the same build could show different results.

The four locales are the product's core promise (English default; Tamil,
Sinhala, Arabic with RTL). A stack is not a cosmetic choice here: an
uncovered script renders as tofu boxes on the school's own screen.

## Decision

**The approved stack, in fallback order:**

| Locale | Family | Why |
|---|---|---|
| Latin (default `en`) | **Noto Sans** | The body face; matches the template's neutral sans direction |
| `ta` | **Noto Sans Tamil** | The Noto family's Tamil face, same metrics family as the Latin one |
| `si` | **Noto Sans Sinhala** | Same |
| `ar` | **Noto Naskh Arabic** | **Naskh, not Noto Sans Arabic**: naskh is the readable style for extended Arabic body text; the kufic-leaning Noto Sans Arabic is a display face. `Noto Sans Arabic` is retained as a secondary fallback |

**Delivery: system-installed first.** No `@font-face`, no network fetch at
runtime. The families are named and the OS resolves them. Rationale:

- Per-school deployments (`ADR-003`) frequently run on constrained or
  intermittently-connected networks; a default that fetches fonts from a CDN
  makes first paint depend on someone else's uptime.
- Windows 10+, macOS and every mainstream Linux desktop already ship coverage
  for all three scripts, so the system-first stack is not a downgrade in
  practice — it is the state the "declaration only" stack already assumed,
  now written down and ordered deliberately.

**Order is part of the decision.** Latin precedes every script face, because
`Noto Sans Tamil` and `Noto Sans Sinhala` also carry Latin glyphs; without the
ordering, an English label could render in a Tamil face with subtly wrong
letterforms. A unit test in `packages/ui-kit/src/index.spec.ts` pins both the
membership and the order.

## Consequences

### Positive

- The four locales render as intended on any system with standard coverage;
  nothing depends on a CDN.
- One decision settles a question carried in seven documents since 2026-09-28.
- Swappable by editing one `font-family` declaration — no component names a
  font (`AGENTS.md` §3.2.5: tokens, never literals).

### Negative / accepted costs — recorded, not hidden

- **A machine with NO coverage for a script still shows tofu.** System-first
  removes the CDN dependency, not the OS dependency. Mitigation is the named
  follow-up below.
- **The PDF half is NOT proven.** `FRONTEND_TEMPLATE.md` §7 notes the donor
  template says nothing about the PDF pipeline; headless Chromium and
  PDFKit/Handlebars embed fonts by different mechanisms, and a system font
  that is not installed on the *render* host is invisible to both. This ADR
  decides the **screen** stack; the **PDF** stack is proven when the
  Document/Print pipeline exists (milestone 2), and the ADR that builds it
  must re-verify embedding per script rather than inherit this one's name.
- **Self-hosted subsetting is deferred.** Committing font binaries needs the
  families obtained, range-subsetted (`fonttools`), and verified per script —
  a task with its own acceptance criteria, tracked as `FIX-12` rather than
  fake-closed inside a documentation session.

## Rejected alternatives

**❌ Google Fonts / CDN `@import`.** Rejected: makes first paint depend on a
third party, and a school deployment behind a filtered network loses its
fonts silently.

**❌ Self-host everything now.** Rejected *for this session*: binaries in the
repo without subsetting would ship megabytes of unused weights, and the
embedding proof per script is exactly the work being deferred. Deferred is not
dismissed — `FIX-12` exists because of this line.

**❌ Keep the provisional stack unchanged.** Rejected: it was a guess nobody
approved, and "renders correctly on my machine" is not a decision.

## Links

- `AGENTS.md` §3.2.7 · `DSN-04` (`GAP_ANALYSIS_2026-09-28.md` §3 design rows)
- `docs/design/FRONTEND_TEMPLATE.md` §7 (the PDF gap this ADR names)
- `packages/ui-kit/src/styles.css` (the stack), `packages/ui-kit/src/index.spec.ts` (the pinned contract)
- `FIX-12` (self-hosted subset follow-up) · Document/Print pipeline (milestone 2)

## Revisit when

- `FIX-12` lands (self-hosted subset) — the stack keeps its names, the delivery changes.
- The Document/Print pipeline is designed — PDF embedding must be verified per script.
