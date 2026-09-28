# TODO — Next Actions

**Last updated:** 2026-09-28
**How to use:** The topmost unchecked item is the next task. Log completion in `WORKLOG.md` in the same commit.
**Analysis:** `docs/work/GAP_ANALYSIS_2026-09-28.md` · **Plan:** `docs/work/PLATFORM_CORE_PLAN.md`

---

## P0 — Do These First

### 1. Rotate the exposed credential 🔴 **BLOCKING**

`.claude/settings.json` contains a **live** `thk_live_` bearer token and a third-party `ANTHROPIC_BASE_URL` (`https://tokenharbor.ai`).

- [ ] Rotate/revoke the `thk_live_` token **at the issuer** — deleting the string from the file is *not* remediation
- [ ] Confirm the old token is dead
- [ ] Decide whether the third-party base URL is intentional (if yes → record an ADR; if no → revert)
- [ ] Move the credential out of the repo (env var or gitignored location)
- [ ] Add `.claude/` to `.gitignore` as defence in depth
- [ ] Enable secret scanning in CI (`OPS-04`) so this class of leak is caught automatically next time

> **Must happen before `git init`.** The first commit makes it permanent history.

### 2. Initialise the repository 🔴 **BLOCKING**

- [ ] `git init`
- [ ] Harden `.gitignore`: add `.claude/`, `graphify-out/`, `*.log`
- [ ] Configure `git remote` (or a local bare remote for per-school-deployment parity)
- [ ] Verify a clean first commit: `git status --porcelain` empty, `git ls-files` shows no secret
- [ ] Document branch protection

> Without git, TDD checkpoint commits (`AGENTS.md` §4.1), conventional-commit traceability and worklog discipline are all impossible.

### 3. Write the ERD 🔴 **Longest pole**

The data model does not exist in any form. It is `PLT-EPIC-01`'s Definition of Ready **and** the SRS Phase 0 exit gate. It needs no code, so start it in parallel with the toolchain work.

- [ ] Entities from `SRS` §6 plus: `User`, `Role`, `Permission`, `RolePermission`, `Session`, `RefreshToken`, `AuditRecord`, `SchoolSettings`, `ModuleRegistry`, `License`, `NotificationPreference`, `NotificationDelivery`, `StoredFile`
- [ ] Money as **integer minor units + explicit currency** (`AGENTS.md` §2.5)
- [ ] `schoolId` on school-scoped tables as **metadata, not a security control** (§2.1)
- [ ] Uniqueness scoped within a school's database — never global
- [ ] Resolve the `PC-004` admission gap
- [ ] **Do not** port the legacy 59-model tenant scoping
- [ ] Sign-off recorded before `PLT-101` starts

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

- [ ] `ARC-03` `IClock` + static check banning `Date.now()`/`new Date()` in `domain/` and `use-cases/` + shared test factories
- [ ] `ARC-04` guard decorator **shapes** + static check — so no route is ever written without all three
- [ ] `ARC-05` RBAC permission-matrix fixture — **seeded in Sprint 1, not deferred to `PLT-205` in Sprint 4**
- [ ] `ARC-06` `Money` value object + journal-balance invariant test
- [ ] `DSN-01` `packages/ui-kit` from template tokens (light + dark, no hard-coded hex)
- [ ] `DSN-02` `packages/i18n-resources` — en/ta/si/ar, key-parity enforced by a test
- [ ] `DSN-03` RTL foundation — verified on login, form and table archetypes
- [ ] `DSN-04` font stack for Tamil/Sinhala/Arabic — **needs owner decision**; PDF pipeline must be covered too
- [ ] `DSN-05` `prefers-reduced-motion`, ≤ 200 ms motion, ≥ 44 px touch targets
- [ ] `DSN-06` CI enforcement: no literal user-facing string in JSX/TSX; no hard-coded hex
- [ ] `OPS-01` `infra/docker/docker-compose.yml` — Postgres + Redis
- [ ] `OPS-02` CI pipeline — green on an empty commit; gates are **required checks**
- [ ] `OPS-03` coverage gate enforcement, **verified to fail**
- [ ] `OPS-04` security scanning — dependency, OWASP ZAP, **secret scanning**, log-content scan
- [ ] `OPS-05` `docs:verify` — fails when a backticked path in `AGENTS.md`/`SSOT.md` does not exist
- [ ] `OPS-07` backup & restore **drill** — a restore actually performed and verified
- [ ] `ARC-07` `docs/adr/` — sign off the reconstructed `ADR-003`; record money, mobile-at-M2, licensing-at-M1, i18n approach
- [ ] `ARC-08` `directives/` — module, route, rule-engine, table-driven-test, new-`ILedgerPostingRule` SOPs
- [ ] `ARC-09` close contradiction register C-01…C-08

---

## P2 — Housekeeping

- [ ] `REQ-06` SSOT "existing equivalent" index
- [ ] `REQ-07` resolve or formally defer `PC-000`…`PC-006` (each needs a named owner and a target milestone — `PC-005`/`PC-006` are currently unticketed)
- [ ] `OPS-06` per-school deployment provisioning
- [ ] `OPS-08` observability skeleton — correlation IDs, file **and** DB error logging, 25 MB × 4 rotation
- [ ] `OPS-09` staging environment
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
| ⚑6 | Activation server: in this repo or a separate service? Where do licence keypairs live? | `PLT-301`, `PLT-303` |
| ⚑7 | `SRS` §24 sets `M2 Foundation Complete` = "license enforcement demonstrably working", but licensing is Sprint 3 while `M2` is the Sprint 2 gate. Slip the gate, redefine `M2`, or move licensing earlier? | Sprint 2/3 boundary |
| ⚑8 | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones? | `REQ-07` |

---

## Do Not

- ❌ **Do not start `PLT-101`** before the entry conditions in `PLATFORM_CORE_PLAN.md` §2 are met — chiefly the test harness (`REPO-05`) and the ERD (`ARC-01`)
- ❌ **Do not `git init` before the token is rotated** — the credential becomes permanent history
- ❌ **Do not port any legacy code** until `LEGACY_REUSE_INVENTORY.md` names the file with a reason (`AGENTS.md` §5.2)
- ❌ **Do not build tenancy machinery.** See `ARCHITECTURE.md` §5 for the worked counter-example of exactly why
- ❌ **Do not hard-code user-facing strings.** `DSN-02` must exist before the first UI story, not after
- ❌ **Do not invent business rules** to fill the idea-bank. A gap is visible; a fabricated threshold is not
- ❌ **Do not add a new top-level module** without checking Master Plan §5 and the module inventory

---

*Companion documents: `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/work/PLATFORM_CORE_PLAN.md` · `docs/work/WORKLOG.md` · `docs/work/BACKLOG.md` · `docs/core/SSOT.md`.*
