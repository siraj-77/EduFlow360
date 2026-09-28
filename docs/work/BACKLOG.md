# BACKLOG — Unscheduled Ideas

**Purpose:** `AGENTS.md` §9 — "Unscheduled ideas go to `docs/work/BACKLOG.md`; module working notes to `docs/modules/<module>/`."
**Rule:** Nothing lands here without a reason it is not in `TODO.md`. Module-specific notes go in `docs/modules/<module>/`, not here.
**Last updated:** 2026-09-28

---

## Schema

| Field | Meaning |
|---|---|
| **ID** | `BLG-nnn` |
| **Idea** | One line |
| **Why deferred** | Why it is not in `TODO.md` |
| **Trigger** | What would pull it forward |
| **Raised** | Date |

---

## Documentation & Process

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-001 | `docs:verify` — a script that extracts every backticked path from `AGENTS.md`/`SSOT.md` and fails if the file does not exist | Implemented as `OPS-05`, not backlog work. Recorded here because the *idea* generalises beyond paths | Any doc gains a cross-reference | 2026-09-28 |
| BLG-002 | Auto-generate `AGENTS.md` §7's story count and point total from the Jira document, so §7 cannot drift | The current count (33 stories / 199 pts) is already correct. Only worth building if drift recurs | §7 and the Jira doc disagree | 2026-09-28 |
| BLG-003 | A traceability viewer: FR → epic → story → test file, generated from `docs/idea-bank/fr-index.md` | Depends on the idea-bank existing first | `REQ-04` complete | 2026-09-28 |
| BLG-004 | Decision log for *setup* activities, using `School_Setup_Workflow_v1.md` Appendix G's template | Belongs to the delivery process (gates G0–G9), not to the build | School onboarding begins | 2026-09-28 |
| BLG-005 | Reclaim `EduFlowV3/directives/` SOP content for the new `directives/` folder | Legacy content must be reviewed, not copied. Tracked as `ARC-08` | `ARC-08` starts | 2026-09-28 |

## Surfaced by the Agentic Prompt Pack (2026-09-28)

These were not previously recorded. The Prompt Pack §2.2 identified them; they belong to the backlog because they are **out of milestone 1 scope**, not because they are unimportant.

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-060 | **Social login — Google / Microsoft / Apple / Facebook** | **Not in the Platform Core epics.** Prompt Pack §2.2 places it out of scope this milestone. Separately, `AGENTS.md` §13 forbids implementing these without confirmed client credentials and redirect URIs, which differ per environment. The frontend template's four `social()` buttons are **demo only and must not be ported** | Owner approval, plus confirmed OAuth credentials per environment | 2026-09-28 |
| BLG-061 | **MFA (multi-factor authentication)** | Not in the Platform Core epics. Note this is **not** the same as `PLT-104` OTP login — OTP is a parent/student convenience channel (milestone 2); MFA is a security control for privileged roles | Post-milestone, or when a school requires it for Finance/HR roles | 2026-09-28 |
| BLG-062 | **Clock-rollback detection for licence validation** | Proposed inside `PLT-301` (Prompt Pack §P8: persist last-seen time so rewinding the clock cannot extend a licence). Recorded but not decided — it needs an ADR | `PLT-301` planning | 2026-09-28 |
| BLG-063 | **`IFileAccessPolicy` real implementations** | `PLT-801` ships the policy **against fakes**, because ownership facts belong to the Academic module. The real rules arrive with Academic | Academic module starts | 2026-09-28 |
| BLG-064 | **Malware scanning adapter** | `PLT-801` provides the **port with a no-op adapter**. A real scanner is a separate decision (provider, latency budget, failure behaviour) | A school requires it, or regulation demands it | 2026-09-28 |
| BLG-065 | **Notification digesting and per-recipient rate limiting** | `PLT-701` provides the hooks. Real digest windows and limits are policy, and belong in settings (`AGENTS.md` §2.14), not in code | `PLT-701` lands | 2026-09-28 |
| BLG-066 | **Email deliverability setup — SPF, DKIM, reverse DNS** | Not a code change. It is a **school-onboarding step** in School Setup Workflow §14, and it is the thing most likely to make password reset silently fail in production | Before the first production deployment | 2026-09-28 |

## Architecture

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-010 | Multi-branch / multi-site consolidation in the GL | Master Plan §5.2 explicitly places it beyond basic-GL scope | Enterprise customers ask | 2026-09-28 |
| BLG-011 | Hard period lock (vs. the current soft close) | `AGENTS.md` §2.6: hard-lock is a later Enterprise-tier control | Enterprise edition work | 2026-09-28 |
| BLG-012 | A published `ILedgerPostingRule` catalogue listing every posting rule and its accounts | Useful, but premature before the first rules exist | First 2–3 posting rules shipped | 2026-09-28 |
| BLG-013 | Separate analytical store for cross-school aggregate reporting | `AGENTS.md` §2.1 forbids cross-school queries against the *product* database. This is a different system | Multi-school reporting requested | 2026-09-28 |
| BLG-014 | Contract-test harness for adapters (VCR-style cassettes) | `SRS` §10 requires it; not a Platform Core blocker | First third-party adapter (`PLT-801` S3) | 2026-09-28 |

## Platform Core (deferred from the 33 stories)

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-020 | `PLT-104` OTP login | **Milestone 2** per `AGENTS.md` §7 (D5) | Milestone 2 opens | 2026-09-28 |
| BLG-021 | `PLT-106` jailbreak/root detection | **Milestone 2** per D5 (already P2) | Milestone 2 opens | 2026-09-28 |
| BLG-022 | Push channel half of `PLT-702` | **Milestone 2** per D5 | Milestone 2 opens | 2026-09-28 |
| BLG-023 | `PLT-504` admin diagnostics viewer | P2; the diagnostics *data* (`PLT-501…503`) ships first | Sprint 5 | 2026-09-28 |
| BLG-024 | `PLT-404` audit retention + archival job | P2; policy is documented in Sprint 3, automation later | Sprint 5 | 2026-09-28 |
| BLG-025 | `PLT-901…903` health & monitoring | P2, explicitly "can slip to Sprint 5" per the Jira document | Sprint 5 | 2026-09-28 |

## UI & i18n

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-030 | Transliteration/collation rules for Tamil and Sinhala sorting and search | Not in `AGENTS.md` §2.8. Needed before multi-language search is useful | Search shipped in a non-Latin locale | 2026-09-28 |
| BLG-031 | Locale-aware numeral formatting (Eastern Arabic numerals vs. Western) | `AGENTS.md` §8 requires locale-aware number formatting but does not specify per-locale numerals | Finance screens in Arabic | 2026-09-28 |
| BLG-032 | Right-to-left-aware charts and the reports engine | Reports Engine is SRS Phase 12; the charts will inherit RTL from the design system | Reports Engine work starts | 2026-09-28 |
| BLG-033 | Machine-translated free text (teacher remarks) | `AGENTS.md` §5.3 explicitly places this **out of scope for v1** | Explicitly requested | 2026-09-28 |

## Operations

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-040 | Observability stack (Grafana / SigNoz) | `OPS-08` covers the skeleton; the choice of vendor is a decision, not a task | `OPS-08` starts | 2026-09-28 |
| BLG-041 | Per-school infrastructure-as-code (`infra/terraform`) | `AGENTS.md` §3.1 marks Terraform as optional; `OPS-06` covers provisioning first | Second school provisioned | 2026-09-28 |
| BLG-042 | Synthetic uptime monitoring against `/health/readiness` from outside the deployment | Requires `PLT-901` first | `PLT-901` ships | 2026-09-28 |
| BLG-043 | Dependency-update automation (Renovate/Dependabot) | Useful, but low priority while the dependency tree is ~30 packages | Dependency count grows | 2026-09-28 |

## Product (outside Platform Core)

| ID | Idea | Why deferred | Trigger | Raised |
|---|---|---|---|---|
| BLG-050 | WhatsApp-first parent communication | Edition-gated (Standard+, Master Plan §3); P1 fast-follow | Fast-follow phase | 2026-09-28 |
| BLG-051 | Mobile "Personal Portal" as the MVP's primary parent surface | `SRS` §19 places mobile in MVP, but `AGENTS.md` §7 (D5) makes `apps/mobile` milestone 2. **These two documents conflict** — flagged as ⚑ | Owner resolves the conflict | 2026-09-28 |
| BLG-052 | Admission as a full online-application pipeline (form → upload → entrance test → approval) | `SRS` §19 makes full online application P1; basic registration→enrolment is P0. Gated on `PC-004` | `PC-004` designed | 2026-09-28 |
| BLG-053 | Student Wallet | Enterprise add-on, and `AGENTS.md` §2.10 forbids enabling it without legal review of stored-value rules | Legal review complete | 2026-09-28 |
| BLG-054 | Alumni Giving / Fundraising | Optional Enterprise add-on (Master Plan §18.4) | Alumni phase | 2026-09-28 |
| BLG-055 | Hostel module | Optional separately-licensed add-on; must never appear in the UI for schools that do not enable it | A boarding school is onboarded | 2026-09-28 |

---

## Rejected — Recorded So It Is Not Re-raised

These were considered and declined. If you want one, open an ADR.

| ID | Idea | Why rejected |
|---|---|---|
| **BLG-090** | Port `prisma-tenant-extension.ts` and the tenant context | `AGENTS.md` §5.2, `ARCHITECTURE.md` §5.1. Defends against a threat that does not exist in a single-tenant deployment, and is bypassed by 149 raw-SQL sites. **The single most likely wrong turn in this project.** |
| **BLG-091** | Add a `SUPER_ADMIN` cross-tenant role | `AGENTS.md` §2.1. There is nothing to be cross-tenant about. The highest role is an in-school administrator. |
| **BLG-092** | Port the legacy 14 global `@unique` constraints | Assume a shared database. Irrelevant and *wrong* under one database per school. |
| **BLG-093** | Port any legacy UI, component or styling | `AGENTS.md` §5.2. The interface is being redesigned. Nothing carries over. |
| **BLG-094** | Port Next.js server actions / App Router API | `AGENTS.md` §3.1 — the API is a separate NestJS service. No server actions. |
| **BLG-095** | Copy the frontend template's marketing copy or social-login buttons | False claims; and `AGENTS.md` §13 forbids implementing Google/Microsoft/Apple/Facebook OAuth without confirmed client credentials and redirect URIs for the current environment. |
| **BLG-096** | Add a second attendance, stock, booking, approval, document, notification or ledger engine | `AGENTS.md` §2.9. Extend the existing one by implementing its interface. |
| **BLG-097** | Fork BookShop/Canteen logic per operator model | `AGENTS.md` §2.10. Operator is **data**, not code. Only `IConcessionSettlementStrategy` and RBAC scope differ. |
| **BLG-098** | Add tenancy-scoping later "just in case" | `AGENTS.md` §2.1. Each guard is a new bypass surface with no threat behind it. Adding it later costs more than never adding it. |
| **BLG-099** | Queue sensitive-action audit writes "for performance" | **`ADR-013`.** A queued audit row can be lost when the queue is unavailable, leaving a committed financial or disciplinary action with no trace. The record exists to answer *"did this happen, and who did it"* — that cannot be probabilistic. This overrides the Jira document's `PLT-402` wording. |
| **BLG-100** | Fake permission keys instead of `@Public` for public routes | **`ADR-018`.** With no documented escape hatch, exemptions get built as `HEALTH_CHECK` or `PUBLIC_LOGIN` permissions. A fake key is a real key: it appears in the catalogue and **can be granted to a role**. Worse than a documented `@Public` in every respect. |
| **BLG-101** | Build the auth surface before the logger and redaction exist | **`ADR-017` deviation ①.** `PLT-101`'s own acceptance criteria require redaction. Building it two epics later means the guarantee is met by assertion, not by test, on the most sensitive surface in the system. |
| **BLG-102** | Invent `Student` / `Class` / `Teacher` entities in Platform Core so the ownership engine has something to work with | Prompt Pack §2.2, §9. `PLT-203` is built against **abstract ports with fakes**. Real entities arrive with Academic. Inventing them here creates a second, wrong definition that Academic must then reconcile. |

---

*Companion documents: `docs/work/TODO.md` · `docs/work/PLATFORM_CORE_PLAN.md` · `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/core/SSOT.md`.*
