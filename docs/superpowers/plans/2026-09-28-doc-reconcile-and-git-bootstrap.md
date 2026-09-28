# Doc Reconciliation & Git Bootstrap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the 18 analysis documents with the Agentic Prompt Pack, and place the repository under git control on a private GitHub remote — with no secret ever entering history.

**Architecture:** Phase 1 gets the work backed up on the remote *before* any content changes, so the repository exists as a safety net. Phases 2–4 then land as individually reviewable commits and one pull request. No application code is written; this is documentation, decision records, and version control.

**Tech Stack:** Git 2.51 · GitHub CLI (`gh`) authenticated as `siraj-77` · Markdown

**Spec:** `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` (execution authority) · `AGENTS.md` (governing contract) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (gap analysis) · `docs/core/SSOT.md` (state of record)

---

## Global Constraints

- **`AGENTS.md` and `docs/adr/` are require-approval paths** per the Prompt Pack §1.3. The owner has approved editing both in this instance (2026-09-28). Approval does not extend to future edits.
- **No application code.** The first commit contains `docs/` + `AGENTS.md` only (Prompt Pack §1.2). `apps/`, `packages/`, `infra/` do not exist and must not be created.
- **No fabrication.** `docs/idea-bank/*` are created as loud `NOT YET EXTRACTED` stubs, never as plausible-looking content. A missing rule is visible; an invented one is not.
- **No secrets in any tracked file.** `.claude/` is gitignored from the first commit.
- **No `--force` push.** The remote's initial commit (`0bedbe30`) is preserved as an ancestor.
- **Story IDs are never renumbered** (`AGENTS.md` §7). New stories are added as *proposed* only.
- Commit messages follow Conventional Commits and reference the requirement ID.
- `docs/work/WORKLOG.md` and `docs/work/TODO.md` update **in the same commit** as any change they describe (`AGENTS.md` §9).

## Outcomes Approved by the Owner (2026-09-28)

| # | Decision |
|---|---|
| 1 | Live `thk_live_` token → **rotate at the issuer** (owner action, outstanding) + `.claude/` gitignored |
| 2 | `.claude/` → **gitignore entirely** (it is machine-specific model routing) |
| 3 | `AGENTS.md` → **may be edited**; changes shown to owner before applying |
| 4 | Prompt Pack → **may be fixed** (2 cosmetic errors) |
| 5 | Remote GitHub-default `.gitignore` → **replaced** with the local one |
| 6 | Execution order → **Phase 1 now**, then 2 → 3 → 4 |
| 7 | This plan → **saved** to `docs/superpowers/plans/` |

---

# Phase 1 — Get It Backed Up

**Gate 0 (owner action, outstanding):** rotate the `thk_live_` token in `.claude/settings.json`. Gitignoring prevents it entering *history*; it does not make a live credential safe on disk. The decision is recorded either way.

### Task 1.1: Harden `.gitignore`

**Files:**
- Modify: `.gitignore`
- Create: `docs/superpowers/plans/2026-09-28-doc-reconcile-and-git-bootstrap.md` (this plan)

**Produces:** a `.gitignore` that excludes `.claude/`, `graphify-out/`, and preserves `!.env.example`.

- [ ] **Step 1: Append the new exclusion rules**

Append to the end of `.gitignore`:

```gitignore

# ---- Local agent configuration (MUST NEVER be committed) ----
# Contains a live credential (ANTHROPIC_AUTH_TOKEN) and machine-specific model
# routing (ANTHROPIC_BASE_URL). Tracked in .claude/settings.local.json only.
.claude/

# ---- Optional tooling output referenced by AGENTS.md section 10 ----
graphify-out/
.graphify_*.json
```

- [ ] **Step 2: Verify the critical invariants of the existing file**

Confirm these are still present and correct:

| Rule | Purpose |
|---|---|
| `.env` and `.env.*` present | secrets never tracked |
| `!.env.example` present | the tracked template is **not** excluded by the rules above it |
| `*.pem` and `*.key` present | signing/secret material never tracked |
| `**/generated/prisma/` and `lib/generated/` present | Prisma client is generated, never committed |

If `!.env.example` is absent, the `.env.*` rule silently excludes the template that `AGENTS.md` §11 requires to be tracked. Add it.

- [ ] **Step 3: Verify `.claude/` is now ignored**

Run: `git check-ignore -v .claude/settings.json` — but git is not yet initialised, so verify with a filesystem check instead: confirm the appended block is present and the path matches `.claude/`.

- [ ] **Step 4: Commit later with Task 1.3** (the first commit bundles plan + gitignore + docs).

### Task 1.2: Initialise the repository on top of the remote history

**Files:** none (git metadata only)

**Consumes:** the existing working tree.
**Produces:** a local `main` whose HEAD is the remote commit `0bedbe30`, with the remote configured as `origin`.

- [ ] **Step 1: `git init -b main`**

Creates the repo with `main` as the initial branch (no `master`/rename step).

- [ ] **Step 2: `git remote add origin https://github.com/siraj-77/EduFlow.git`**

- [ ] **Step 3: `git fetch origin main`**

- [ ] **Step 4: `git reset --mixed FETCH_HEAD`**

Points local `main` at the remote commit **while leaving the working tree untouched**. This is what makes the subsequent push a fast-forward: our first commit becomes a *child* of `0bedbe30`, not a competing root. **Do not use `--hard`** — that would discard the working tree.

- [ ] **Step 5: Verify**

Run: `git log --oneline -1` → expect `0bedbe30 Initial commit`.
Run: `git status --porcelain` → expect the docs and `.gitignore` listed as untracked/modified, i.e. the working tree survived.

### Task 1.3: Audit the staging area, then commit and push

**Files:** all of `docs/`, `AGENTS.md`, `.gitignore`, `.claude/`
**Test:** the staging audit below *is* the test. It is a gate, not a formality.

- [ ] **Step 1: `git add -A`**

- [ ] **Step 2: Audit what is about to be committed — the security gate**

Run all four. **Any hit is a hard stop.**

```bash
# 1. no secret-shaped paths
git ls-files --cached | Select-String -Pattern 'claude|\.env|secret|\.pem$|\.key$|credential'

# 2. no high-entropy token strings anywhere in staged content
git diff --cached | Select-String -Pattern 'thk_live_|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY'

# 3. confirm the intended content is present
git ls-files --cached | Measure-Object | Select-Object -ExpandProperty Count
git ls-files --cached | Select-String -Pattern '^docs/|^AGENTS.md$|^\.gitignore$'

# 4. confirm nothing executable/scaffolded
git ls-files --cached | Select-String -Pattern '^apps/|^packages/|^infra/|^\.env$'
```

Expected results: (1) no output · (2) no output · (3) 24+ files, all under `docs/`, plus `AGENTS.md` and `.gitignore` · (4) no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: establish project baseline, gap analysis and agentic prompt pack

Documentation-only first commit. No application code.

Contents:
- AGENTS.md (governing contract)
- docs/core/: Master Plan v5.2, SRS v1.2, Jira Epics v1, School Setup
  Workflow v1, Agentic Prompt Pack v1, SSOT.md, ARCHITECTURE.md
- docs/adr/: ADR-001..006 (ADR-003 reconstructed, pending sign-off)
- docs/analysis/, docs/design/, docs/idea-bank/, docs/work/
- docs/superpowers/plans/: this reconciliation plan

.gitignore now excludes .claude/ (contained a live credential).
Refs: GAP-ANALYSIS-2026-09-28"
```

- [ ] **Step 4: Push (no force)**

```bash
git push -u origin main
```

Expect a fast-forward. If it is rejected, **stop and report** — do not force.

- [ ] **Step 5: Verify the push**

```bash
git log --oneline -2
gh api 'repos/siraj-77/EduFlow/contents' | ConvertFrom-Json | ForEach-Object { $_.name }
```

Expect two commits (`0bedbe30` then ours) and a root listing that includes `docs`, `AGENTS.md`, `.gitignore`.

- [ ] **Step 6: Enable push protection** — `gh api -X PATCH repos/siraj-77/EduFlow -f security_and_analysis='...'`. Report result; do not work around a failure.

**Phase 1 exit:** the repository is on GitHub, green, secret-free, and the work is backed up.

---

# Phase 2 — Reconcile the Documents with the Prompt Pack

Lands as **one branch, one pull request**. No code.

### Task 2.1: Create the `idea-bank` stubs

**Files:**
- Create: `docs/idea-bank/module-inventory.md`, `domain-entities.md`, `business-rules.md`, `fr-index.md`, `edge-cases-and-risks.md`
- Modify: `docs/idea-bank/README.md`

**Why:** Prompt Pack §1.2 — *"Create empty stubs for anything you do not have yet — the agent must be able to find every path `AGENTS.md` mentions."* The Story Execution Template §4.2 Step 0 tells the agent to `grep` these files. A stub that merely looks like content makes a failed grep fail **silently**; a stub that says `NOT YET EXTRACTED` makes the absence **loud**.

- [ ] **Step 1: Write all five stubs** with a uniform header:

```markdown
> 🔴 **NOT YET EXTRACTED.**
> Required by `AGENTS.md` §6. Tracked as `REQ-0N` in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6.
> A grep against this file returning nothing is the **expected** result today, not a bug.
> See `docs/idea-bank/README.md` for the extraction spec, the citation rules, and the
> blocking `PC-000`…`PC-006` gaps.
```

Then, per file, the *columns* it will eventually carry (so the shape is fixed and greps have something to anchor on) and its `REQ` id. **No data rows.**

- [ ] **Step 2: Verify the grep-failure property**

Run: `Select-String -Path docs/idea-bank/fr-index.md -Pattern 'FR-PLT'`
Expect **no matches**, and the file present. A future agent that greps and gets nothing will find the loud header.

- [ ] **Step 3: Verify all five paths referenced by Prompt Pack §1.2 now exist.**

### Task 2.2: Write ADRs 007–018 for the pre-flight decisions

**Files:** Create `docs/adr/ADR-007` … `ADR-018`; modify `docs/adr/README.md`.

**Consumes:** Prompt Pack §2.1 decisions D-A…D-J, §2.2 deviations, §P3.2 lint rules.
**Produces:** the full decision set, indexed, with the audit-durability conflict resolved in writing.

| ADR | Decision | Source |
|---|---|---|
| 007 | Password hashing: `argon2id` behind `IPasswordHasher`, verify-and-rehash | D-A |
| 008 | Token strategy: 15-min access JWT, 7-day rotating refresh with family reuse detection | D-B |
| 009 | Licence signature: ECDSA P-256 + SHA-256 over **canonical** JSON | D-C |
| 010 | Activation server is an **external vendor service**; port + OpenAPI + local fake | D-D — *answers open question ⚑6* |
| 011 | Instance fingerprint: stable install ID, not MAC | D-E |
| 012 | Permission catalogue declared **in code**, synced to DB on deploy | D-F |
| 013 | **Audit durability: same DB transaction as the business change** | D-G — *resolves conflict C1* |
| 014 | Email: SMTP behind `INotificationChannelAdapter`; Mailpit in dev | D-H |
| 015 | Object storage: MinIO in dev, any S3-compatible in prod, behind `IStorageAdapter` | D-I |
| 016 | Metrics: Prometheus-compatible | D-J |
| 017 | Documented deviations from the Jira sprint order (pull-forwards) | §2.2 |
| 018 | `@Public('<reason>')` as the explicit, audited route escape hatch | §P3.2/P4.7 |

- [ ] **Step 1: Write ADR-013 first — it is the one that resolves a live contradiction**

`EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` `PLT-402` says the audit record is written *"asynchronously (non-blocking, via queue) after the action completes successfully"*. D-G says *"in the same DB transaction as the business change (no lost audit on a queue failure)"*. **These contradict.** D-G is correct for sensitive actions: a queue failure that loses the audit row defeats the purpose of an audit trail, and `AGENTS.md` §2.7 is explicit that records are append-only and durable. ADR-013 must state the decision, name the Jira text it overrides, and record it as a documented deviation. Queueing remains for non-critical, high-volume events.

- [ ] **Step 2: Write ADR-009 with the canonicalisation requirement stated precisely**

The signature is over a **deterministic serialisation** — key ordering fixed, no whitespace ambiguity. Two tests are mandatory: *reordering keys does not break a valid signature*, and *flipping any byte does*. A signature scheme over non-canonical JSON is breakable by an attacker who reorders keys, so this is a correctness requirement, not a tidiness one.

- [ ] **Step 3: Write the remaining ten ADRs** to the format in `docs/adr/README.md`. Each under one page: Context · Decision · Alternatives · Consequences · Links to stories and `AGENTS.md` rules.

- [ ] **Step 4: Fix the ADR-005 collision in the Prompt Pack §10.3** (owner-approved)

Its commit-message example reads `docs(adr): ADR-005 licence signature over canonical JSON`, but ADR-005 is *mobile is milestone 2*; the licence-signature ADR is **009**. Correct the example.

- [ ] **Step 5: Reindex `docs/adr/README.md`** with all 18 rows, and fix the prompt-pack cosmetic error at §1.2 (owner-approved): its layout omits `docs/work/CHANGELOG.md`.

- [ ] **Step 6: Verify** — every `ADR-NNN` in the index resolves to a file; no duplicate numbers.

### Task 2.3: Resequence the plan to P0–P14

**Files:** modify `docs/work/PLATFORM_CORE_PLAN.md`, `docs/core/SSOT.md`, `docs/core/ARCHITECTURE.md`

**Why:** the Prompt Pack's P0–P14 sequence is **more granular and more authoritative** than the five-sprint map written before it existed. It also encodes four pull-forwards and two interim-adapter patterns that the sprint map does not.

- [ ] **Step 1: Replace the sprint table in `PLATFORM_CORE_PLAN.md` with P0–P14**, keeping the existing entry-conditions and TDD-obligations sections (they remain correct and are not duplicated by the pack).

- [ ] **Step 2: Record the pull-forwards as deviations, not silently**

`PLT-501`/`PLT-502` (structured logging + redaction) move into P4, because `PLT-101`'s acceptance criteria already require redaction. `PLT-901` (liveness only) moves into P4. The email adapter half of `PLT-702` moves into P5, because `PLT-105` must send a reset mail before the notification router exists. Each needs: the reason, the Jira text it departs from, and the mitigation (an interim `INotificationChannelAdapter` / `IAuditRecorder` adapter later refactored, with tests staying green).

- [ ] **Step 3: Add the M1/M2 legend — conflict C3**

Three documents use "M2" for two different things. Adopt an explicit legend in `SSOT.md` and reference it from `PLATFORM_CORE_PLAN.md`:

| Term | Means | Source |
|---|---|---|
| **Milestone 1 / 2** | The *product* milestones. M2 is the mobile milestone (`AGENTS.md` §7, D5) | `AGENTS.md` |
| **Gate M1…M6** | The *sign-off gates* from `SRS` §24. "M2 — Foundation Complete" is a gate | `SRS` §24 |

Always write **"Milestone 2"** or **"Gate M2"**, never a bare "M2".

- [ ] **Step 4: Add the two missing lint rules and `@Public` to `ARCHITECTURE.md` §17**

| Rule | Enforcement | Story |
|---|---|---|
| `Math.random()` banned in domain/use-cases (injected id generator) | ESLint | P3 |
| `@Public('<reason>')` is the only route exemption; every use is justified in an allowlist file | `scripts/check-route-guards` | P3 |
| All four locale files have identical key sets | `scripts/check-i18n` | P3 |
| A PR changing source must change `WORKLOG.md` | `scripts/check-worklog` | P3 |
| Commit message follows Conventional Commits | commit-msg hook | P3 |

- [ ] **Step 5: Correct the docker-compose service list** (conflict C4) — Postgres, Redis, **MinIO**, **Mailpit**.

- [ ] **Step 6: State the story count explicitly** — 33 stories, 199 points, verified by enumeration on 2026-09-28. Prompt Pack §2.2 asks for this reconciliation in `PLATFORM_CORE_PLAN.md`.

- [ ] **Step 7: Verify** — every story ID cited in the resequenced plan exists in the Jira document; no invented IDs.

### Task 2.4: Record the newly-surfaced gaps

**Files:** modify `docs/work/TODO.md`, `docs/work/BACKLOG.md`, `docs/work/GAP_ANALYSIS_2026-09-28.md`

- [ ] **Step 1: Add the proposed `PLT-107` — first-admin bootstrap via one-time setup token**

`EduFlow_School_Setup_Workflow_v1.md` §6.5 requires a first administrator; **no `PLT` story covers it**. Record as *proposed*, with acceptance criteria, for owner approval. **Do not renumber existing IDs** (`AGENTS.md` §7).

- [ ] **Step 2: Add social login and MFA to `BACKLOG.md`** as deferred proposed stories. Prompt Pack §2.2 places them out of scope for this milestone and explicitly forbids porting the template's fake social buttons.

- [ ] **Step 3: Add C1 (audit durability) to the gap register in `GAP_ANALYSIS`** with its resolution in ADR-013.

- [ ] **Step 4: Add the Prompt Pack to the companion-document lists** in `SSOT.md` and the gap analysis, and record that it supersedes the sprint map.

### Task 2.5: Create the `CLAUDE.md` pointer and close out

**Files:** create `CLAUDE.md`; modify `WORKLOG.md`, `CHANGELOG.md`

- [ ] **Step 1: Create `CLAUDE.md`** — exactly the Prompt Pack §10.1 content: one line, pointing at `AGENTS.md` so there is a single source of truth rather than a duplicate.

- [ ] **Step 2: Append a `WORKLOG.md` entry** with the mandatory `AGENTS.md` §9 fields, recording the Prompt Pack reconciliation, ADR-013's resolution of C1, the M1/M2 legend, the pull-forwards, and the outstanding token rotation.

- [ ] **Step 3: Append a `CHANGELOG.md` entry** recording the Prompt Pack, ADRs 007–018, and the idea-bank stubs as *stubs, not extractions*.

- [ ] **Step 4: Verify every cross-reference resolves.** Run the same check that produced `OPS-05`, across all 25+ markdown files, distinguishing intentional future-work targets from accidental danglers.

- [ ] **Step 5: Commit, push the branch, open a pull request.** Documented as a deviation from "one prompt per session" — it is a single coherent reconciliation and splitting it would produce three PRs that each leave the docs inconsistent.

---

# Phase 3 — `AGENTS.md` Corrections

Owner has approved editing. **Show the diff before applying.** Six corrections, each traceable to a measurement.

### Task 3.1: Apply the six corrections

| # | § | Change | Evidence |
|---|---|---|---|
| 1 | §1 | Add the Agentic Prompt Pack **and** `School_Setup_Workflow_v1.md` to the planning-document list; correct the legacy path to `EduFlowV3\EduFlowV3\eduflow\` | `SSOT.md` D8; Prompt Pack §1.2 |
| 2 | §2.8 | Correct "a complete `en`/`ta`/`si`/`ar` dictionary" → **21 marketing keys, zero application keys**; the template is a token + RTL-*pattern* donor | `docs/design/FRONTEND_TEMPLATE.md` (codepoint-verified) |
| 3 | §5.2 | "9 unfiltered `$queryRaw`/`$executeRaw` sites" → **149**; record the measurement method | `LEGACY_REUSE_INVENTORY.md` §2 |
| 4 | §3 | `sms-platform/` → `EduFlow/` | `AGENTS.md` §1 |
| 5 | §2.3 | Add `@Public('<reason>')` as the documented, allowlisted route escape hatch | Prompt Pack §P3.2, §P4.7 |
| 6 | §2.2 | Add `Math.random()` to the `IClock` rule | Prompt Pack §P3.2 |

- [ ] **Step 1: Present the unified diff for owner review. Do not apply yet.**
- [ ] **Step 2: Apply exactly what was approved.** Nothing additional.
- [ ] **Step 3: Verify** — `Select-String` for each of the six changes; confirm no unintended edits.
- [ ] **Step 4: Commit and PR.**

---

# Phase 4 — Branch Protection

- [ ] **Step 1: Enable "no direct commits to `main`"** per Prompt Pack §1.2.
- [ ] **Step 2: If it fails** — branch protection on private repositories may require a paid plan. **Report; do not work around it.** A workaround would be a local pre-push hook, which is weaker and must be labelled as such.

---

## Self-Review

**Spec coverage.** Every Prompt Pack section maps to a task: §1.2 layout → Task 1.2 + 2.1; §1.3 permissions → Global Constraints; §2.1 decisions D-A…D-J → Task 2.2; §2.2 gaps → Task 2.4; §5 execution order → Task 2.3; §7 story table → Task 2.3 Step 6; §8 DoD → carried into `PLATFORM_CORE_PLAN.md`; §9 anti-patterns → already in `AGENTS.md` §13. Every `AGENTS.md` correction → Task 3.1. Every measured inaccuracy from the gap analysis → Task 3.1. ✅

**Placeholder scan.** No `TBD`. Task 2.1's stub content is specified exactly. ADR *content* is specified by decision id, source clause, and mandatory test cases rather than by restating the prompt pack — otherwise the ADR would be a copy, and the ADR's job is to record the *alternative rejected*. ✅

**Type/identifier consistency.** The ADR set is 001–018 with no gaps and no duplicates. `@Public('<reason>')` is used identically in `ARCHITECTURE.md`, Task 2.3 Step 4, and the correction in Task 3.1 row 5. `M2` is given one legend used by all three documents. `PLT-107` is proposed-only and never renumbers an existing ID. ✅

**Known intentional gap.** Task 2.1's five stubs contain **no data rows**, because the extraction (`REQ-01…05`) is deliberately not performed. This is recorded in `WORKLOG.md` D13 and is a decision, not an oversight.

---

*Plan saved 2026-09-28. Executed via superpowers:executing-plans or superpowers:subagent-driven-development. Phase 1 is unblocked except for the owner's token rotation, which is tracked but not blocking — `.claude/` is gitignored, so history stays clean.*
