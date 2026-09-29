# TODO — Next Actions

**Last updated:** 2026-09-28
**How to use:** The topmost unchecked item is the next task. Log completion in `WORKLOG.md` in the same commit.
**Analysis:** `docs/work/GAP_ANALYSIS_2026-09-28.md` · **Plan:** `docs/work/PLATFORM_CORE_PLAN.md`

---

## P0 — Do These First

> **State 2026-09-29: P2 (scaffold) is DONE.** Toolchain, monorepo and enforced rules all green. Read `docs/core/SSOT.md` §1a for what was verified.
> The ERD is deferred by owner decision (D22). The top engineering priority is now **P3 — CI**.

### 1. Rotate the exposed credential — ⚠️ **ACCEPTED RISK, NOT BLOCKING** *(decided 2026-09-28, D16)*

`.claude/settings.json` holds a **live** `thk_live_` bearer token and a third-party `ANTHROPIC_BASE_URL` (`https://tokenharbor.ai`).

**Deferred by owner decision.** The token was **never committed** — `.claude/` was added to `.gitignore` *before* `git init`, and the first-commit staging audit confirmed the token value is absent. The remote is **private**, sole holder. Residual exposure is **local-disk only**.

- [x] `.claude/` gitignored — `.gitignore:99`
- [x] Verified absent from the first commit — staging gate 2b/2c
- [ ] *Deferred:* rotate at the issuer
- [ ] *Deferred:* decide whether the third-party base URL is intentional
- [ ] **Enable secret scanning in CI** — Prompt Pack P3.6. **This is now the only un-done item here, and it is part of P3.**

**Revisit if:** the repo goes public · a second person is granted access · the folder is shared or archived · the machine is shared.

### 2. Prompt Pack P3 — Quality gates and CI 🔴 **THE TOP PRIORITY**

The `AGENTS.md` rules are already machine-enforced **locally**. Nothing enforces them for anyone else. P3 is what turns the contract from prose into something that fails a build.

- [ ] `check-route-guards` — TypeScript AST: every NestJS route must carry `@RequirePermission(...)` **or** `@Public('<reason>')`. Also reject `@Public` combined with `@RequireEntitlement`, and on entity-scoped routes. Allowlist file with mandatory justification, enforced **both ways** (`ADR-018`)
- [ ] `check-i18n` — all four locale files have identical key sets. *(A vitest suite already covers this in `packages/i18n-resources`; the script is for CI reporting on a PR.)*
- [ ] `check-worklog` — a PR changing source must also change `docs/work/WORKLOG.md` (`AGENTS.md` §9)
- [ ] gitleaks + dependency audit
- [ ] lint-staged pre-commit hook; commit-msg Conventional Commits check
- [ ] **CI workflow**: PR → typecheck → lint → custom checks → unit + coverage → build → integration (containerised Postgres) → secrets scan. E2E on `main` only
- [ ] **React-hooks ESLint rules** — dropped with `eslint-config-next` (D25); add when there are hooks
- [ ] **Human gate:** a dummy PR with (a) an unguarded route (b) a `new Date()` in a use-case (c) a raw `<button>` (d) a missing i18n key — **CI must FAIL for each**, then pass

### 3. Write the ERD 🔴 **Deferred (D22) — blocks `PLT-EPIC-01`**

`apps/api/prisma/schema.prisma` is **deliberately empty**. The ERD is `PLT-EPIC-01`'s Definition of Ready and the SRS Phase 0 exit gate. It needs no code and no Docker.

- [ ] Platform Core entities: `User` `Role` `Permission` `RolePermission` `Session` `RefreshToken` `AuditRecord` `ErrorLog` `SchoolSettings` `ModuleRegistry` `License` `NotificationPreference` `NotificationDelivery` `StoredFile`
- [ ] Money as **integer minor units + explicit currency** (`ADR-002`)
- [ ] `schoolId` as **metadata, not a security control** (`ADR-003`)
- [ ] Uniqueness scoped within one school's database — never global
- [ ] `audit_records`: `REVOKE UPDATE, DELETE` from the application role
- [ ] Resolve the `PC-004` admission gap
- [ ] **Do not** port the legacy 59-model tenant scoping
- [ ] Sign-off recorded before `PLT-101` starts

### 4. Extract the requirements (`docs/idea-bank/`) 🔴

Five loud stubs exist; **zero data rows.** The Prompt Pack §4.2 greps `fr-index.md` and `business-rules.md` before **every** story.

- [ ] `REQ-01` `module-inventory.md` — cross-checked against Master Plan §29's 30-row table
- [ ] `REQ-02` `domain-entities.md` — each entry states whether an SSOT/§2.9 equivalent exists
- [ ] `REQ-03` `business-rules.md` — every rule carries a source citation **and** a test target
- [ ] `REQ-04` `fr-index.md` — every FR traced to its story and a test
- [ ] `REQ-05` `edge-cases-and-risks.md`
- [ ] Every rule engine named in `AGENTS.md` §4.1 has at least one row
- [ ] Silence in the corpus is recorded as `GAP — needs design (PC-xxx)`, never invented

> ⚑2 still open: was `docs/archive/corpus/` deleted, or never migrated? It determines whether this is *extraction* (verifiable citations) or *summarisation* (weaker provenance). The work is the same either way.

### 5. ~~Initialise the repository~~ ✅ **DONE 2026-09-28** (GAP-02 closed)

- [x] `git init -b main`; `origin` → `siraj-77/EduFlow` (private)
- [x] `.gitignore` hardened — `.claude/`, `graphify-out/`
- [x] Pushed as a fast-forward on top of `0bedbe30`; no force
- [x] Branch protection — ❌ **unavailable** (needs a paid plan for private repos). Report, don't work around it

### 6. ~~Scaffold the monorepo~~ ✅ **DONE 2026-09-29** (GAP-03 closed)

- [x] 6 packages, pnpm 11 + Turborepo, TS strict
- [x] 12 API module folders × 9 subfolders, matching `AGENTS.md` §3
- [x] 4 locales with key-parity enforcement
- [x] Tokens in light **and** dark; `prefers-reduced-motion` added
- [x] `docker-compose.yml` — Postgres, Redis, MinIO, Mailpit
- [x] `.env.example` + fail-fast validation + `README.md`
- [x] **All gates green: typecheck · lint · test (51) · build · docs:verify**
- [x] **API boots with no `.env`** — honest `PERSISTENCE DISABLED` banner (`ADR-019`)
- [x] **Web serves `/en` `/ta` `/si` `/ar`**, `/ar` with `dir=rtl`

### 4. Build the toolchain 🔴 **Unblocks TDD**

Until this lands, `test-driven-development` and `tdd-workflow` cannot execute — there is no runner, no coverage command, no git.

- [ ] `REPO-03` — root `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- [ ] `REPO-04` — `packages/config`: TypeScript **strict**, ESLint, Prettier, ban `@ts-ignore`, ban bare `any`, **the missing-`@RequirePermission` static check**
- [ ] `REPO-05` — Jest, RTL, MSW, Playwright; coverage gates **enforced** per `AGENTS.md` §4 tiers; one trivial passing spec proves the harness
- [ ] `REPO-06` — `apps/api` NestJS skeleton, per-domain folders per `SRS` §17, Prisma migrating
- [ ] `REPO-07` — `apps/web` Next.js skeleton, Tailwind v4 + shadcn, 4 locales, light/dark
- [ ] `REPO-08` — `.env.example` + fail-fast config validation

**Exit gate "Foundation Harness":** all seven `AGENTS.md` §4 gates green in CI on a fresh clone, with an under-covered file proven to fail the coverage gate.

### 5. Extract the requirements (`docs/idea-bank/`) 🔴

Directory created with a README on 2026-09-28. **Contents deliberately not written** — a fabricated business rule is indistinguishable from a real one and would be trusted by every downstream story.

- [ ] `REQ-01` `module-inventory.md` — cross-checked against Master Plan §29's 30-row table
- [ ] `REQ-02` `domain-entities.md` — each entry states whether an SSOT/§2.9 equivalent already exists
- [ ] `REQ-03` `business-rules.md` — every rule carries a source citation and a test target
- [ ] `REQ-04` `fr-index.md` — every FR traced to its epic/story and a test
- [ ] `REQ-05` `edge-cases-and-risks.md`
- [ ] Every rule engine named in `AGENTS.md` §4.1 has at least one row
- [ ] Silence in the corpus is recorded as `GAP — needs design (PC-xxx)`, never invented

---

## P1 — Needed Before the First Feature

- [ ] `ARC-03` `IClock` — the **ESLint ban on `Date.now()`/`new Date()`/`Math.random()` is already live**; only the `IClock` interface and shared test factories remain (P4)
- [ ] `ARC-04` guard decorator **shapes** + static check — so no route is ever written without all three (P3/P4)
- [ ] `ARC-05` RBAC permission-matrix fixture — **seeded in Sprint 1, not deferred to `PLT-205` in Sprint 4**
- [ ] `ARC-06` `Money` value object + journal-balance invariant test
- [x] `DSN-01` `packages/ui-kit` tokens — **done 2026-09-29**: light + dark in `styles.css`, `prefers-reduced-motion` added, verified by test. *shadcn/ui components themselves still to add (P4W).*
- [x] `DSN-02` `packages/i18n-resources` — **done 2026-09-29**: en/ta/si/ar with key-parity enforced by 10 vitest cases
- [ ] `DSN-03` RTL foundation — **core proven 2026-09-29** (`/ar` serves `dir=rtl`). *Login, form and table archetypes still to build (P4W).*
- [ ] `DSN-04` font stack for Tamil/Sinhala/Arabic — ⚑ **needs owner decision**; PDF pipeline must be covered too. *A provisional Noto stack is in `styles.css`.*
- [x] `DSN-05` `prefers-reduced-motion`, ≥ 44 px touch targets — **done 2026-09-29**, verified by test
- [ ] `DSN-06` CI enforcement: no literal user-facing string in JSX/TSX. *The no-hard-coded-hex half is done and firing; the string half is P3 — a heuristic produces false positives, which is worse than no check.*
- [x] `OPS-01` `infra/docker/docker-compose.yml` — **done 2026-09-29**: Postgres, Redis, MinIO, Mailpit
- [ ] `OPS-02` CI pipeline — **P3, the top priority**
- [x] `OPS-03` coverage gate — **thresholds written** into all three vitest configs. ⚠️ **Not yet verified to FAIL** — an unenforced threshold is indistinguishable from no threshold
- [ ] `OPS-04` security scanning — dependency, OWASP ZAP, **secret scanning**, log-content scan (P3)
- [x] `OPS-05` `docs:verify` — **done 2026-09-29**: 147 references across 8 documents resolve
- [ ] `OPS-07` backup & restore **drill** — a restore actually performed and verified
- [x] `ARC-07` `docs/adr/` — **19 ADRs written** (001–019, contiguous). **None is `Accepted`** — see ⚑10
- [ ] `ARC-08` `directives/` — module, route, rule-engine, table-driven-test, new-`ILedgerPostingRule` SOPs
- [x] `ARC-09` contradiction register C-01…C-08 — **closed** 2026-09-28/29; see the resolved-conflicts table in `CHANGELOG.md`

---

## P2 — Housekeeping

- [ ] `REQ-06` SSOT "existing equivalent" index
- [ ] `REQ-07` resolve or formally defer `PC-000`…`PC-006` (each needs a named owner and a target milestone — `PC-005`/`PC-006` are currently unticketed)
- [ ] `OPS-06` per-school deployment provisioning
- [ ] `OPS-08` observability skeleton — correlation IDs, file **and** DB error logging, 25 MB × 4 rotation
- [ ] `OPS-09` staging environment
- [ ] `apps/mobile` scaffold — **milestone 2** (`AGENTS.md` §7 D5, `ADR-005`)
- [ ] `infra/terraform` — `AGENTS.md` §3.1 marks it optional; `OPS-06` first
- [ ] ⚑ **Install Docker Desktop** (optional) or **PostgreSQL for Windows** (required at P4). See `README.md` § "Running without Docker" — Redis is the one service with no official Windows build
- [ ] `docs/analysis/LEGACY_REUSE_INVENTORY.md` — per-file port judgements (created 2026-09-28 with measurements only)
- [ ] `docs/modules/<module>/` working notes as modules land
- [ ] Reconcile the three phase-numbering schemes (SSOT §4 precedence table now records the answer; `AGENTS.md` and SRS §15 still need updating)

---

## Decisions Needed From the Owner

Blocking the items marked ⚑.

| # | Question | Blocks |
|---|---|---|
| ⚑1 | Rotate the token + is the third-party `ANTHROPIC_BASE_URL` intentional? | §1 above |
| ⚑2 | Was `docs/archive/corpus/` deliberately deleted, or never migrated? | Extraction reliability |
| ⚑3 | Approve the four `AGENTS.md` corrections: D8 legacy path, D9 i18n claim, D10 raw-SQL count, C-01 repo name | Doc accuracy |
| ⚑4 | Font stack for Tamil / Sinhala / Arabic (screen **and** PDF) | `DSN-04` |
| ⚑5 | Required report-card layouts for the initial customer set — Master Plan §30 flags this as needed **before Phase 5** | Document/Print Engine abstraction |
| ⚑6 | ~~Activation server: in this repo or a separate service?~~ | ✅ **Answered** — `ADR-010`: **external vendor service**, port + OpenAPI + local fake. Private key never in this repo |
| ⚑7 | ~~`SRS` §24 Gate M2 vs. the licensing sprint position.~~ | ✅ **Resolved by reordering** — the P0–P14 sequence puts licensing at **P8**, before the **P14** gate. `ADR-006`, `ADR-017` |
| ⚑8 | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones? | `REQ-07` |
| ⚑9 | **`SRS` §19 vs. `AGENTS.md` §7 (D5) on mobile.** `SRS` puts a Parent/Student Personal Portal in the MVP and `SRS` §20 AC-5 requires it; `AGENTS.md` makes `apps/mobile` milestone 2. Three options in `ADR-005` — A (adopt D5, amend `SRS`), B (revert to `SRS`), C (parent read-only **web** portal in the MVP, satisfies AC-5's substance without a mobile build) | MVP scope · **Recommended: C**, then A |
| ⚑10 | **Approve `ADR-001`…`ADR-018`.** None is `Accepted` yet. **Prompt Pack P1 is the approval step** — and the ADRs are already drafted, so P1 becomes a review rather than a writing task | Everything that depends on a decision |
| ⚑11 | **Approve proposed story `PLT-107`** (first-admin bootstrap via one-time setup token). School Setup Workflow §6.5 requires it; **no existing story covers it** | Epic 01 / school onboarding |
| ⚑12 | **The `M2` naming legend** — approve the "Milestone 2" vs "Gate M2" distinction in `SSOT.md` §4 | All milestone references |

---

## 3. Approve the Decision Records — Prompt Pack P1 ⚑10

`docs/adr/ADR-001` … `ADR-018` are **drafted but none is `Accepted`.** Review them, edit, and mark each Accepted. Highest-risk first:

| ADR | Why it needs a human |
|---|---|
| [ADR-003](adr/../core/../adr/ADR-003-new-app-single-tenant-selective-reuse.md) | **Reconstructed**, not contemporaneous. Records who decided, and whether the D1 carve-out was in the original decision. **Needs sign-off most of all** |
| [ADR-013](adr/../core/../adr/ADR-013-audit-durability-same-transaction.md) | **Overrides the Jira document's `PLT-402` text.** Changes the `IAuditRecorder` port signature |
| [ADR-018](adr/../core/../adr/ADR-018-public-route-escape-hatch.md) | Introduces the only exemption from the fail-closed rule |
| [ADR-009](adr/../core/../adr/ADR-009-licence-signature-ecdsa-canonical-json.md) | If a signing service already issues **RSA**, use RSA and skip this ADR |
| [ADR-010](adr/../core/../adr/ADR-010-activation-server-external-boundary.md) | Confirms the private key never enters this repo |
| [ADR-005](adr/../core/../adr/ADR-005-mobile-is-milestone-2.md) | **Conflicts with `SRS` §19** — see ⚑9 |
| [ADR-017](adr/../core/../adr/ADR-017-deviations-from-jira-sprint-order.md) | The four pull-forwards. The Jira sprint table no longer describes the real order |
| ADR-001, 002, 004, 006, 007, 008, 011, 012, 014, 015, 016 | Lower risk. Each has a recommended default already applied |

---

## 4. Proposed Story — `PLT-107` ⚑11

**First-admin bootstrap via a one-time setup token.**

- **Required by:** `EduFlow_School_Setup_Workflow_v1.md` §6.5 (Phase 3, first launch, first administrator).
- **Gap:** **no `PLT` story covers it.** The 33 stories in the Jira document do not include any bootstrap mechanism, and `PLT-101` is ordinary credential login against existing users — so a fresh deployment has **no way to create its first administrator.**
- **Status:** **proposed.** IDs are never renumbered (`AGENTS.md` §7), so this is `PLT-107`, appended.
- **Where it runs:** inside Epic 01, **before Epic 03 completes** (Prompt Pack §2.2), because licence activation (P8) and school settings (P10) both presuppose an administrator exists.
- **Constraints it inherits:** no default credentials, ever; the setup token is single-use, short-lived, and consumed on first successful use; the act is audited; the route is `@Public('<reason>')` (there is no user to authenticate) and therefore allowlisted per `ADR-018`.

**Next step:** the Prompt Pack P5 prompt asks for the story *text* to be proposed for approval. Draft it as part of Epic 01, do not implement without sign-off.

---

## Do Not

- ❌ **Do not start `PLT-101`** before the entry conditions in `PLATFORM_CORE_PLAN.md` §2 are met — chiefly the **test harness** and the **ERD**. Two of TDD's three prerequisites now exist (git, working tree); the test runner does not
- ❌ **Do not port any legacy code** until `LEGACY_REUSE_INVENTORY.md` names the file with a reason (`AGENTS.md` §5.2)
- ❌ **Do not build tenancy machinery.** See `ARCHITECTURE.md` §5 for the worked counter-example of exactly why
- ❌ **Do not hard-code user-facing strings.** The four-locale skeleton must exist before the first UI story, not after
- ❌ **Do not invent business rules** to fill the idea-bank. A gap is visible; a fabricated threshold is not
- ❌ **Do not queue sensitive-action audit writes.** `ADR-013` — a queued audit row can be lost, and a record that exists to prove what happened cannot be probabilistic
- ❌ **Do not use a fake permission key** for a public route. Use `@Public('<reason>')` and add an allowlist row (`ADR-018`)
- ❌ **Do not invent `Student` / `Class` / `Teacher`** in Platform Core. `PLT-203` uses abstract ports with fakes
- ❌ **Do not follow the Jira sprint table literally** — it cannot satisfy its own acceptance criteria. Use the P0–P14 sequence (`ADR-017`)
- ❌ **Do not add a new top-level module** without checking Master Plan §5 and the module inventory
- ❌ **Do not port the frontend template's social-login buttons** or its marketing claims. See `docs/design/FRONTEND_TEMPLATE.md`

---

*Companion documents: `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/work/PLATFORM_CORE_PLAN.md` · `docs/work/WORKLOG.md` · `docs/work/BACKLOG.md` · `docs/core/SSOT.md` · `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md`.*
