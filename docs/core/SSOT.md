# SSOT — Single Source of Truth

**Purpose:** The answer to "what is the current state of this project?"
**Last updated:** 2026-09-28
**Precedence:** `AGENTS.md` and `ADR-003` > this file > all other documents. This file records *state and decisions*. It does not restate the rules — see `ARCHITECTURE.md` for those.

---

## 1. Current State — 2026-09-28

| | |
|---|---|
| **Phase** | Pre-scaffold. SRS Part E **Phase 0** (Architecture, ERD, SRS sign-off), week ~1 of 2–3. |
| **Application code** | **None.** Zero source files. |
| **Toolchain** | **None.** No `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, ESLint or Prettier config. |
| **Version control** | **Not a git repository.** |
| **CI** | **None.** All seven `AGENTS.md` §4 quality gates are unrunnable and therefore vacuous. |
| **Phase 0 exit criteria** | SRS ✅ exists · MVP scope ✅ locked (SRS Part D) · **ERD ❌ does not exist in any form** |
| **Story points committed** | 0 of 199 (Platform Core) · 0 of ~172 (REPO/ARC/REQ/DSN/OPS) |
| **Stories completed** | 0 |

**Do not describe this project as "in development".** Nothing is built. The correct description is *"planning complete, engineering not started"*.

---

## 2. What Exists

| Path | Size | State |
|---|---|---|
| `AGENTS.md` | 35.5 KB | Governing contract. ~21 dangling cross-references — see Gap Analysis §3.3 |
| `docs/core/EduFlow_Project_Master_Plan_v5.2.md` | 79.4 KB | Complete. Most detailed artefact in the repo |
| `docs/core/EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` | 39.5 KB | Complete. Parts A–E |
| `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` | 35.0 KB | Complete. 9 epics / 33 stories / 199 pts |
| `docs/core/EduFlow_School_Setup_Workflow_v1.md` | 80.3 KB | Complete but **orphaned** — not referenced by `AGENTS.md` |
| `docs/core/ARCHITECTURE.md` | — | **Written 2026-09-28** (was 0 bytes) |
| `docs/core/SSOT.md` | — | This file (was 0 bytes) |
| `docs/template/EduFlow — Frontend Template.html` | 34.4 KB | Token + RTL-pattern donor only. See `docs/design/FRONTEND_TEMPLATE.md` |
| `docs/work/PLATFORM_CORE_PLAN.md` | — | **Written 2026-09-28** (was missing) |
| `docs/adr/`, `docs/analysis/`, `docs/design/`, `docs/idea-bank/README.md` | — | **Created 2026-09-28** |

---

## 3. What Does Not Exist

Nothing has been built. The following are **specified but absent**, and are the subject of the action plan in `docs/work/GAP_ANALYSIS_2026-09-28.md`:

- All source: `apps/api`, `apps/web`, `packages/*`
- All infrastructure: `infra/docker`, `infra/ci`, `infra/terraform`
- All process: `directives/`
- All tooling: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.env.example`, `README.md`
- The **ERD / data model** — the single largest missing engineering artefact
- `docs/idea-bank/*` (the "authoritative requirements" layer `AGENTS.md` §6 depends on) — directory now created with a README defining the extraction; **contents not written, by design** (see §6)
- `docs/archive/corpus/` — status unknown, see Open Questions

---

## 4. Decisions of Record

| ID | Decision | Status | Source |
|---|---|---|---|
| **D1** | **Attendance, Leave and Grading are designed fresh.** Nothing in those three domains is ported from the legacy app; the legacy implementations are not the specification and their tests do not port either. | ✅ Decided | `AGENTS.md` §5.1 carve-out |
| **D2** | Single-tenant: one PostgreSQL database and one application deployment **per school**. Physical isolation. No tenant-scoping machinery, no `SUPER_ADMIN` cross-tenant role, no cross-school aggregate queries against the product database. `schoolId` is **metadata, not a security control**. | ✅ Decided | `AGENTS.md` §2.1 |
| **D3** | Governed by `ADR-003`. **Caveat:** `ADR-003` did not exist as a file until 2026-09-28 and was reconstructed from `AGENTS.md`. It is **not yet owner-signed**. | ⚠️ Reconstructed | `docs/adr/ADR-003-*` |
| **D4** | Licensing ships in milestone 1. | ✅ Decided | `AGENTS.md` §7 |
| **D5** | `apps/mobile` is **milestone 2**. `PLT-104`, `PLT-106` and the push half of `PLT-702` move with it. Milestone-2 MVP is a reduced vertical slice: enrolment → class assignment → attendance → fee invoice → GL posting → receipt. | ✅ Decided | `AGENTS.md` §7 |
| **D6** | Story IDs (`PLT-101`…`PLT-903`, `PLT-EPIC-01`…`09`) are the traceability backbone and are **never renumbered**. Verified: 33 stories, 199 points. | ✅ Reconciled | `EduFlow_Jira_Epics_..._v1.md` |
| **D7** | SMS provider is **deliberately undecided**; `ISmsAdapter` stays vendor-agnostic. WhatsApp targets the Vvaslution API. | ✅ Decided | `AGENTS.md` §2.2 |
| **D8** | Legacy corpus lives at `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\`. **Note:** `AGENTS.md` §1 states the path as `EduFlowV3\`, which is one level too shallow — the application is three levels down. | ⚠️ `AGENTS.md` needs correction | Verified 2026-09-28 |
| **D9** | `AGENTS.md` §2.8's claim that the frontend template contains "a complete `en`/`ta`/`si`/`ar` dictionary" is **inaccurate** — 21 marketing keys exist, zero application keys. The template is a **token and RTL-pattern donor**. | ⚠️ `AGENTS.md` needs correction | `docs/design/FRONTEND_TEMPLATE.md` |
| **D10** | The legacy raw-SQL figure in `AGENTS.md` §5.2 ("9 sites") is **wrong**; 149 call sites were measured on 2026-09-28. The measurement method must be recorded before the figure is trusted. | ⚠️ `AGENTS.md` needs correction | `docs/analysis/LEGACY_REUSE_INVENTORY.md` |
| **D11** | Nothing may be ported from the legacy app until `docs/analysis/LEGACY_REUSE_INVENTORY.md` names the file with a reason (`AGENTS.md` §5.2). That inventory is now written but **per-file judgements are still pending**. | ✅ Rule in force | `AGENTS.md` §5.2 |

### Planning-horizon precedence (resolves Contradiction C-07)

| Question | Authoritative source |
|---|---|
| **Dates, durations, team composition** | SRS v1.2 Part E (§21–23) |
| **Build sequence and rationale** | Master Plan v5.2 §28 |
| **First-milestone sprint plan** | `docs/work/PLATFORM_CORE_PLAN.md` |
| **Story-level detail and acceptance criteria** | `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` |
| **Delivery process and gates G0–G9** | `EduFlow_School_Setup_Workflow_v1.md` |
| **Repository name** | `EduFlow` (not `sms-platform`; SRS §15 is wrong) |

---

## 5. Blocking Status

### 5.1 S1 — blocks all work

| ID | Blocker | Owner action |
|---|---|---|
| **GAP-01** | Live `thk_live_` credential in `.claude/settings.json`; third-party `ANTHROPIC_BASE_URL` | **Rotate the token.** Then decide whether the proxy routing is intentional |
| **GAP-02** | Not a git repository | `git init` + harden `.gitignore` (**after** GAP-01 — otherwise the token enters history) |
| **GAP-03** | No toolchain, therefore no test runner | TDD is impossible until `REPO-05` lands. This blocks *all* feature work |
| **GAP-04** | `docs/idea-bank/` has no content | Extract. Doc-only, zero code dependencies — highest-leverage parallel work |
| **GAP-05** | No ERD | **Longest pole.** Blocks `PLT-EPIC-01` and SRS Phase 0 exit |

### 5.2 Known-unresolved requirement gaps (`AGENTS.md` §6.1)

These domains **cannot be built** until designed. They are recorded here so they are not forgotten.

| Gap | Blocks | Ticket |
|---|---|---|
| Attendance — no design at all | Attendance module | `PC-000` |
| Leave / Workforce — no design at all | Workforce, leave accrual | `PC-001` |
| Grading & Moderation — P0, zero rules | Exams, report cards, promotion, analytics | `PC-002` |
| Tax & currency — never mentioned, despite invoicing | Fees, payroll, procurement | `PC-003` |
| Admission — in MVP list, no FR behind it | MVP scope | `PC-004` |
| BookShop / Canteen / School Hall — in Master Plan v5.2 §17.6–17.9 (newer than the idea-bank extraction); needs FR/rule/entity extraction and settlement design | Retail, hall rental | `PC-005` *(proposed)* |
| Student Wallet — stored-value legal review and GL design | Wallet | `PC-006` *(proposed)* |

`PC-005` and `PC-006` are **proposed and not ticketed**. An unticketed deferral is how they got here. `REQ-07` requires each gap to be either designed or formally deferred with a named owner and target milestone.

---

## 6. Why `docs/idea-bank/` Has a README But No Content

`AGENTS.md` §6 calls `docs/idea-bank/` "the authoritative requirements" and instructs reading the relevant section before implementing any module. The directory did not exist.

It has been created with a README that **specifies the extraction** but does not contain it, deliberately. A fabricated business rule — a plausible attendance threshold, a leave accrual formula, a fee schedule — would be indistinguishable from a real one once written down, and would be trusted by every downstream story. A missing rule is visible; an invented one is not. The extraction is tracked as `REQ-01`…`REQ-05`.

**Open dependency:** the extraction needs a verifiable source. `AGENTS.md` §12 points at `docs/archive/corpus/`, which does not exist. Until that is resolved, the extraction is prose-summarisation of Master Plan + SRS rather than extraction from a source corpus — which is workable but weaker. See Open Questions.

---

## 7. Open Questions — Awaiting Owner Decision

| # | Question | Blocks |
|---|---|---|
| 1 | Was `docs/archive/corpus/` deliberately deleted, or never migrated? | `REQ-01…05` reliability |
| 2 | Is the third-party `ANTHROPIC_BASE_URL` intentional? | `REPO-01` |
| 3 | Approve the 3-corrected-`AGENTS.md` items: D8 legacy path, D9 i18n claim, D10 raw-SQL count | `AGENTS.md` accuracy |
| 4 | Confirm the planning-horizon precedence table in §4 | Scheduling |
| 5 | Required report-card layouts for the initial customer set | Master Plan §30 flags this as needed **before Phase 5**; drives the Document/Print Engine abstraction |
| 6 | Font stack for Tamil / Sinhala / Arabic, on screen and in PDF | `DSN-04`; `AGENTS.md` §3.2.7 requires owner confirmation |
| 7 | Activation server: in scope for this repo, or a separate service? Where do the licence keypairs live? | `PLT-301`, `PLT-303` |
| 8 | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones? | `REQ-07` |

---

## 8. The Three Most Important Facts

1. **The token in `.claude/settings.json` is live and must be rotated before `git init`.** Every other item on this page can wait a day. This one cannot, because the first commit makes it permanent.
2. **There is no test runner, so TDD cannot start.** `test-driven-development` and `tdd-workflow` both require a working `<test>` command, a coverage command, and git for RED/GREEN checkpoints. None of the three exist. `REPO-02`, `REPO-03` and `REPO-05` are the unblocking sequence.
3. **The ERD does not exist.** It is `PLT-EPIC-01`'s Definition of Ready, the SRS Phase 0 exit gate, and the longest pole in the plan. It needs no code, so it can start in parallel with the toolchain work on day one.

---

*Companion documents: `ARCHITECTURE.md` (how it is architected) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (full analysis + action plan) · `docs/work/PLATFORM_CORE_PLAN.md` (milestone-1 execution) · `docs/work/TODO.md` (next task) · `docs/work/WORKLOG.md` (activity log).*
