# EduFlow360 — Jira/Epic-Style Action Plan: School Setup, Teacher Directory & Academic Setup
## Epic → Story → Task → Sub-task (Master Plan v5.3 §5A, §5B / SRS v1.3 FR-SET, FR-ACD)

**Version:** 1.0 · **Date:** October 9, 2026 · **Milestone:** M2 (after Platform Core & Admin Console)
**Project keys:** `SET` (School Setup) · `HRM` (minimal teacher directory) · `ACD` (Academic Setup)
**Admin URL:** `http://localhost:3030/admin` (dev) · single-tenant · fresh build · default user `superadmin` · **70–80% agentic coding**.

> **UI rule:** these screens do **not** exist in the templates. Build them **only from the templates' existing tokens, components and patterns** (Settings-style tabs/cards/fields, list rows/tables, pills, buttons, toggles). Do not invent a new visual language; show each new screen to the owner for approval (AGENTS.md §2.17).

**Sub-task executor legend:** 🤖 agent-led (human skims) · 🤝 paired (agent drafts, human decides) · 👤 human-led.
**Hierarchy:** Epic → Story → Task (`<STORY>-T<n>`) → Sub-task (`<STORY>-T<n>-S<m>`). Every story ends with a close-out task (`<STORY>-C`).
**Agent share** is the estimated share of *implementation effort* done by the agent for that story (security-critical stories are lower because human review is heavier). The plan-wide target is **70–80%**.
**Rules that apply to every sub-task:** AGENTS.md is the contract · TDD (RED → GREEN → REFACTOR) · one story per session · templates are used as-is (AGENTS.md §2.17) · no code from any other project (fresh build) · every route guarded and audited · money in integer minor units · time via `IClock` · i18n ×4 + RTL + light/dark.

---

## Epic index

| Epic ID | Epic name | Priority | Points | Agent share |
|---|---|---|---|---|
| SET-EPIC-00 | School Setup Shell, Settings Reader & Readiness | P0 | 13 | ~80% |
| SET-EPIC-01 | School Profile & Logo (Tab 1 — General) | P0 | 15 | ~73% |
| SET-EPIC-02 | System Configuration (Tab 2) | P0 | 32 | ~76% |
| SET-EPIC-03 | Holidays (Tab 3) | P0 | 15 | ~78% |
| SET-EPIC-04 | Event Categories (Tab 4) | P1 | 6 | ~78% |
| SET-EPIC-05 | Houses (Tab 5) | P1 | 6 | ~78% |
| SET-EPIC-06 | Scheduler Constraints (Tab 6) | P1 | 13 | ~65% |
| HRM-EPIC-01 | Teacher & Staff Directory (minimal prerequisite) | P1 | 16 | ~72% |
| ACD-EPIC-01 | Academic Calendar & Terms | P0 | 20 | ~78% |
| ACD-EPIC-02 | Syllabus | P0 | 6 | ~78% |
| ACD-EPIC-03 | Academic Levels & Sections | P0 | 23 | ~78% |
| ACD-EPIC-04 | Grades & Class Medium | P0 | 13 | ~78% |
| ACD-EPIC-05 | Subjects | P0 | 13 | ~57% |
| ACD-EPIC-06 | Classes | P0 | 16 | ~61% |
| ACD-EPIC-07 | Subject & Teacher Assignments | P1 | 31 | ~75% |
| ACD-EPIC-08 | Student Promotion | P1 | 31 | ~67% |
| **Total** | | | **269** | **~73%** |

**Total: 269 points · agent share ≈ 73%**

---

## EPIC SET-EPIC-00 — School Setup Shell, Settings Reader & Readiness

**Priority:** P0 · **Points:** 13 · **Agent share:** ~80%

**Goal:** One admin page (`/admin/school-setup`) with six tabs, a shared settings-reader port for other modules, and a readiness checklist telling the owner what is still unconfigured.
**Maps to:** FR-SET-01, FR-SET-11 · Master Plan §5A
**Definition of Ready:** PLT-EPIC-10 (admin shell) and PLT-107 (Superadmin) are done; permission keys `SET_*` agreed.
**Definition of Done:** Six tabs reachable by URL (`?tab=`), permission-gated, audited; other modules read school settings only through `ISchoolSettingsReader`.

### Story SET-001 — School Setup page shell with six tabs
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `frontend`, `backend` |

**User story:** As a school administrator I want one School Setup page with tabs so that I can configure the school in one place.

**Depends on:** PLT-1005

**Acceptance criteria**
1. Each tab is reachable directly by URL and the active tab is highlighted per the template's tab style.
2. A user lacking a tab's permission sees the tab read-only or hidden (decision recorded), never an editable form.
3. Switching tabs with unsaved edits prompts before discarding.
4. Matrix tests prove every `SET_*` permission is enforced at the API.

**Tasks & sub-tasks**
- [ ] **SET-001-T1** — Route `/admin/school-setup` with tabs General, System Configuration, Holidays, Event Categories, Houses, Scheduler Constraints; active tab in `?tab=general|system|holidays|event-categories|houses|scheduler`
  - [ ] `SET-001-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-001-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-001-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-001-T2** — Page header text exactly as specified: "Manage your institution's profile, global settings, and campus locations." and the sub-line about configurations, holidays and event categories
  - [ ] `SET-001-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-001-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-001-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-001-T3** — Permission keys `SET_VIEW`, `SET_PROFILE_UPDATE`, `SET_SYSTEM_UPDATE`, `SET_HOLIDAY_MANAGE`, `SET_EVENT_CATEGORY_MANAGE`, `SET_HOUSE_MANAGE`, `SET_SCHEDULER_UPDATE`; RBAC-matrix rows
  - [ ] `SET-001-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-001-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-001-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-001-T4** — Unsaved-changes guard when switching tabs; tab-level loading skeletons and error states using template styles
  - [ ] `SET-001-T4-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-001-T4-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-001-T4-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-001-C** — Close-out
  - [ ] `SET-001-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-001-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-001-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-002 — ISchoolSettingsReader port and cached reader
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As a module developer I want to read school settings through one interface so that no module hard-codes a school value.

**Acceptance criteria**
1. Saving a setting invalidates the cache and the next read returns the new value without a restart.
2. Other modules compile only against the interface; a direct table read fails the lint rule.

**Tasks & sub-tasks**
- [ ] **SET-002-T1** — Define `ISchoolSettingsReader` (profile, system configuration, scheduler constraints, holidays calendar) in the domain; Prisma-backed implementation with in-memory cache and invalidation on save
  - [ ] `SET-002-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-002-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-002-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-002-T2** — Lint/test that flags direct reads of settings tables from other modules and hard-coded currency/timezone/date-format constants
  - [ ] `SET-002-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-002-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-002-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-002-C** — Close-out
  - [ ] `SET-002-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-002-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-002-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-003 — Setup readiness checklist on the dashboard
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~80% 🤖 | `frontend`, `backend` |

**User story:** As the owner I want a checklist showing which setup steps are done so that I know when the school is ready for go-live.

**Depends on:** SET-EPIC-01…06, ACD-EPIC-01…07

**Acceptance criteria**
1. Completing a step updates its status without a page reload.
2. A step whose prerequisite is incomplete shows as locked with the reason.
3. Gap detection lists concrete records (e.g. "Grade 5-A has no class teacher").

**Tasks & sub-tasks**
- [ ] **SET-003-T1** — Readiness service returning each step (profile, system config, calendar, terms, levels, grades, subjects, classes, staff, assignments) with status Not started / In progress / Done and a link to the screen
  - [ ] `SET-003-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-003-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-003-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-003-T2** — Dashboard widget in the template's card/progress style; dependent steps shown locked until prerequisites are Done
  - [ ] `SET-003-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-003-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-003-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-003-T3** — Detect common gaps (e.g. classes without class teacher, subjects without teacher)
  - [ ] `SET-003-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-003-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-003-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-003-C** — Close-out
  - [ ] `SET-003-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-003-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-003-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC SET-EPIC-01 — School Profile & Logo (Tab 1 — General)

**Priority:** P0 · **Points:** 15 · **Agent share:** ~73%

**Goal:** The school's official identity (name, registration, contacts, address, logo) is stored once and used by documents, e-mails and the UI.
**Maps to:** FR-SET-02, FR-SET-03
**Definition of Ready:** Field list in Master Plan §5A approved.
**Definition of Done:** Profile saved and audited; logo stored as a database blob and served publicly with caching.

### Story SET-101 — School profile singleton: model, API and validation
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want to maintain the school's official details so that documents and notifications carry the correct identity.

**Acceptance criteria**
1. Only one profile row can ever exist; a second insert fails at the database level.
2. Invalid e-mail, invalid phone or over-length values are rejected with field-level errors.
3. Every update writes an audit record with before/after values.
4. The WhatsApp number is exposed to the WhatsApp adapter through `ISchoolSettingsReader`.

**Tasks & sub-tasks**
- [ ] **SET-101-T1** — Prisma model `SchoolProfile` (singleton): name, shortName, registrationNumber, officialEmail, phone, whatsappNumber, address; DB constraint guaranteeing a single row
  - [ ] `SET-101-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-101-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-101-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-101-T2** — Zod validation: lengths, valid e-mail, E.164 phone for phone and WhatsApp, required fields
  - [ ] `SET-101-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-101-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-101-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-101-T3** — `GET/PUT /api/school/profile` with `SET_PROFILE_UPDATE`; `@Audited('SCHOOL_PROFILE_UPDATED')` with before/after
  - [ ] `SET-101-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-101-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-101-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-101-C** — Close-out
  - [ ] `SET-101-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-101-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-101-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-102 — School logo stored as a database blob
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~65% 🤖 | `backend`, `security` |

**User story:** As an administrator I want to upload the official logo and have it stored in the database so that it travels with the school's backups.

**Acceptance criteria**
1. A 5 MB+ file, an SVG, or a file whose bytes do not match its type is rejected before storage.
2. The logo is retrievable without authentication (login page) and honours conditional requests (304).
3. Replacing or removing the logo is audited and updates `ETag`.
4. The blob is never loaded by profile reads (verified by query-count test).

**Tasks & sub-tasks**
- [ ] **SET-102-T1** — Table `school_logo` (single row): `bytea` data, mime, byteSize, sha256, width, height, updatedAt — separate from the profile row so ordinary reads never load the blob
  - [ ] `SET-102-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-102-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-102-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-102-T2** — Upload validation: PNG/JPEG/WebP only (SVG rejected), max 5 MB, magic-byte sniffing, decoded dimensions read server-side (recommend 512×512; non-square allowed with a warning)
  - [ ] `SET-102-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-102-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-102-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-102-T3** — Public `GET /api/school/logo` with `ETag`, `Cache-Control`, correct `Content-Type`, `X-Content-Type-Options: nosniff`; replace/remove endpoints audited
  - [ ] `SET-102-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-102-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-102-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-102-T4** — Test the failure modes: spoofed extension, oversize, corrupt image, concurrent replace
  - [ ] `SET-102-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **SET-102-C** — Close-out
  - [ ] `SET-102-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-102-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-102-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `SET-102-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-103 — General tab UI
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a General tab that looks like the rest of the admin console so that updating school details feels familiar.

**Depends on:** SET-001, SET-101, SET-102

**Acceptance criteria**
1. Field labels and helper text match the specification exactly; layout reuses template patterns only.
2. Logo preview appears before saving; an oversize/unsupported file shows a clear error.
3. Screen passes RTL (Arabic) and dark-theme checks.

**Tasks & sub-tasks**
- [ ] **SET-103-T1** — General tab screen using the template's Settings-style card and field patterns: General Information (School Name, Short Name / Initials, Registration Number, Official Email, Phone Number, Mobile / School WhatsApp, Address) and School Logo card with the recommended-size and max-size hints
  - [ ] `SET-103-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-103-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-103-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-103-T2** — Logo upload with instant preview, replace and remove; progress and error states in template alert styles
  - [ ] `SET-103-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-103-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-103-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-103-T3** — Save with validation messages, dirty-state, success toast; all strings in en/ta/si/ar
  - [ ] `SET-103-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-103-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-103-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-103-C** — Close-out
  - [ ] `SET-103-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-103-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-103-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC SET-EPIC-02 — System Configuration (Tab 2)

**Priority:** P0 · **Points:** 32 · **Agent share:** ~76%

**Goal:** Global formats, codes and localisation settings are configured once and read everywhere.
**Maps to:** FR-SET-04, FR-SET-05, FR-SET-06, FR-SET-12
**Definition of Ready:** Dropdown value lists and the Student ID token grammar approved.
**Definition of Done:** Student IDs generate correctly and safely; money precision and currency are locked after first posting; defaults behave per country.

### Story SET-201 — System configuration singleton: model, API and locking rules
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want to set the school code, formats, units and calendar rules so that every module behaves consistently.

**Acceptance criteria**
1. Locked fields reject changes with an explanatory error once their trigger condition is true (tested with fakes).
2. Invalid enum/timezone/currency values are rejected.
3. Changes are audited and immediately visible through `ISchoolSettingsReader`.
4. Defaults are applied on first run (e.g. precision derived from the currency).

**Tasks & sub-tasks**
- [ ] **SET-201-T1** — Prisma model `SystemConfiguration` (singleton): schoolCode, studentIdFormat, timezone, currencySymbol, currencyCode, dateFormat, weightUnit, heightUnit, attendanceType, weekStartDay, workingDaysPerWeek, decimalPrecision (+ proposed defaultLanguage, enabledLanguages)
  - [ ] `SET-201-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-201-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-201-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-201-T2** — Zod validation: school code `[A-Z0-9]{2,10}`; IANA timezone; ISO 4217 currency; enums for the dropdowns; workingDaysPerWeek 1–7
  - [ ] `SET-201-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-201-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-201-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-201-T3** — Domain rules `ConfigLockPolicy`: school code frozen after the first generated ID; currency and decimal precision frozen after the first financial posting; attendance type frozen after the first attendance record — with clear error messages (checked through ports so the rule works before those modules exist)
  - [ ] `SET-201-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-201-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-201-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-201-T4** — `GET/PUT /api/school/system-configuration` with `SET_SYSTEM_UPDATE`; `@Audited` with before/after
  - [ ] `SET-201-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-201-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-201-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-201-C** — Close-out
  - [ ] `SET-201-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-201-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-201-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-202 — Student ID format engine
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As the registrar I want student IDs generated from the school's pattern so that every student gets a unique, predictable ID.

**Depends on:** SET-201

**Acceptance criteria**
1. `{SCHOOL_CODE}-{YY}-{SEQ:5}` with code `GIS` in 2026 yields `GIS-26-00001`, `GIS-26-00002`, …
2. 200 parallel generations produce 200 distinct IDs with no gaps from races.
3. Invalid patterns (no SEQ, two SEQ, illegal characters) are rejected with specific messages.
4. Changing the pattern affects only new IDs.

**Tasks & sub-tasks**
- [ ] **SET-202-T1** — Pattern parser/validator: tokens `{SCHOOL_CODE}`, `{YYYY}`, `{YY}`, `{SEQ:n}` (n 3–10); exactly one `{SEQ:n}`; literal characters limited to `A–Z a–z 0–9 - _ /`
  - [ ] `SET-202-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-202-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-202-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-202-T2** — `IIdentifierGenerator` with a database-backed, concurrency-safe sequence (row lock or database sequence), optional yearly reset (proposed), using `IClock` for year tokens
  - [ ] `SET-202-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-202-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-202-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-202-T3** — Preview endpoint returning the next three IDs without consuming the sequence
  - [ ] `SET-202-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-202-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-202-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-202-T4** — Table-driven tests incl. concurrency test (parallel generation produces no duplicates) and pattern-change behaviour (existing IDs never rewritten)
  - [ ] `SET-202-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **SET-202-C** — Close-out
  - [ ] `SET-202-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-202-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-202-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-203 — Reference lists for dropdowns
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As a user I want standard, correct dropdown lists so that I never type timezones or currencies by hand.

**Acceptance criteria**
1. Every list is data-driven and unit-tested (no duplicates, valid codes).
2. Decimal-precision options include a sample value (e.g. `1,234.56`).

**Tasks & sub-tasks**
- [ ] **SET-203-T1** — Provide typed constants/endpoints: IANA timezones, ISO 4217 currencies with default minor units, date formats with sample renderings, weight units (kg, g, lb), height units (cm, m, ft/in), attendance types (Daily, Subject), week-start days, decimal-precision options 0–4
  - [ ] `SET-203-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-203-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-203-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-203-T2** — i18n keys for every option label in en/ta/si/ar
  - [ ] `SET-203-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-203-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-203-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-203-C** — Close-out
  - [ ] `SET-203-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-203-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-203-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-204 — Decimal precision and money formatting integration
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As a finance officer I want one precision setting to drive all money so that amounts are consistent and never lose accuracy.

**Depends on:** SET-201

**Acceptance criteria**
1. `formatMoney` renders the same value identically on API and web for all four locales.
2. After the first financial posting, a precision change is rejected.
3. No `number` floating arithmetic is used for money (lint rule green).

**Tasks & sub-tasks**
- [ ] **SET-204-T1** — Map decimal precision to the money minor-unit scale (integer minor units, never float) and expose `formatMoney()` shared by API and web using currency symbol/code and locale
  - [ ] `SET-204-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-204-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-204-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-204-T2** — Default precision from the chosen currency (OMR 3, USD 2, JPY 0); allow override only before the first posting
  - [ ] `SET-204-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-204-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-204-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-204-T3** — Table-driven tests for rounding, formatting and scale changes
  - [ ] `SET-204-T3-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **SET-204-C** — Close-out
  - [ ] `SET-204-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-204-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-204-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-205 — System Configuration tab UI
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want the System Configuration tab with live previews so that I can see the effect of each choice.

**Depends on:** SET-001, SET-201–204

**Acceptance criteria**
1. Previews update as the user edits, before saving.
2. Locked fields are visibly disabled and explain why.
3. Passes RTL/dark/mobile checks; all strings i18n'd.

**Tasks & sub-tasks**
- [ ] **SET-205-T1** — Screen with the specified fields and helper texts ("Used as a prefix for generated IDs.", "Pattern for auto-generating student IDs.", "Number of decimal places for financial amounts.") using template card/field patterns
  - [ ] `SET-205-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-205-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-205-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-205-T2** — Live previews: Student ID next three IDs, date format sample, decimal precision sample; locked fields shown disabled with the reason
  - [ ] `SET-205-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-205-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-205-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-205-T3** — Proposed fields (default language, enabled languages) rendered only after owner approval
  - [ ] `SET-205-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-205-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-205-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-205-C** — Close-out
  - [ ] `SET-205-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-205-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-205-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-206 — Attendance type contract for the Attendance module
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~45% 🤖 | `backend`, `owner-decision` |

**User story:** As the attendance module developer I want a stable setting for Daily vs Subject attendance so that the engine can switch behaviour safely.

**Acceptance criteria**
1. The setting is readable by other modules and changes are announced via an event.
2. Switching after attendance records exist is blocked with an explanation (provisional until `PC-000`).

**Tasks & sub-tasks**
- [ ] **SET-206-T1** — Expose `attendanceType` through `ISchoolSettingsReader` with change events
  - [ ] `SET-206-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-206-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-206-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-206-T2** — 👤 Owner confirms semantics of "Subject" attendance (per period) and the migration policy when switching (blocked once records exist) — design pending `PC-000`
  - [ ] `SET-206-T2-S1` 👤 Owner confirms semantics of "Subject" attendance (per period) and the migration policy when switching (blocked once records exist) — design pending `PC-000`
- [ ] **SET-206-C** — Close-out
  - [ ] `SET-206-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-206-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-206-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC SET-EPIC-03 — Holidays (Tab 3)

**Priority:** P0 · **Points:** 15 · **Agent share:** ~78%

**Goal:** School holidays are recorded once and respected by attendance, leave, timetable and bells.
**Maps to:** FR-SET-07
**Definition of Ready:** Holiday fields approved; owner decides on proposed type/applies-to fields.
**Definition of Done:** Working-day calculation is correct and consumed through `IHolidayCalendar`.

### Story SET-301 — Holiday model and CRUD API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want to add school holidays with start and end dates so that those days are not treated as teaching days.

**Acceptance criteria**
1. End date before start date is rejected.
2. Overlapping holidays are accepted only with an explicit confirmation flag and are reported.
3. Deactivated holidays no longer affect working-day calculations.

**Tasks & sub-tasks**
- [ ] **SET-301-T1** — Prisma model `Holiday`: name, startDate, endDate, status (Active/Inactive) (+ proposed type, academicYearId, recurring, appliesTo)
  - [ ] `SET-301-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-301-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-301-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-301-T2** — Validation: end ≥ start; overlap warning; dates inside a plausible range; unique name per overlapping range
  - [ ] `SET-301-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-301-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-301-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-301-T3** — CRUD endpoints with `SET_HOLIDAY_MANAGE`; deactivate instead of delete when referenced; `@Audited`
  - [ ] `SET-301-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-301-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-301-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-301-C** — Close-out
  - [ ] `SET-301-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-301-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-301-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-302 — Holiday calendar and working-day service
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As a module developer I want to ask whether a date is a working day so that attendance, leave and timetable stay consistent.

**Depends on:** SET-201, SET-301

**Acceptance criteria**
1. Counting working days across a holiday that spans a weekend is correct for 5-day and 6-day weeks.
2. Results are identical regardless of server timezone (school timezone applied).

**Tasks & sub-tasks**
- [ ] **SET-302-T1** — `IHolidayCalendar` with `isHoliday(date)`, `isWorkingDay(date)`, `workingDaysBetween(a,b)` using week-start, working-days-per-week (and proposed working-day set) and active holidays
  - [ ] `SET-302-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-302-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-302-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-302-T2** — Table-driven tests: holiday spanning weekend, single-day holiday, year boundary, 5-day and 6-day weeks, different week-start days (FakeClock)
  - [ ] `SET-302-T2-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **SET-302-C** — Close-out
  - [ ] `SET-302-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-302-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-302-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-303 — Holidays tab UI
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a Holidays tab with a list and add/edit dialog so that I can manage holidays quickly.

**Depends on:** SET-001, SET-301

**Acceptance criteria**
1. Columns and labels match the specification; actions are Edit and Activate/Deactivate.
2. Overlap and invalid-date errors are shown inline.
3. Passes RTL/dark/mobile (table becomes cards on small screens).

**Tasks & sub-tasks**
- [ ] **SET-303-T1** — List with columns Name, Start Date, End Date, Action, Status; add/edit dialog; status toggle; filters by year
  - [ ] `SET-303-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-303-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-303-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-303-T2** — Confirmation dialogs for deactivate; overlap warning display; empty state
  - [ ] `SET-303-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-303-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-303-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-303-C** — Close-out
  - [ ] `SET-303-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-303-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-303-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC SET-EPIC-04 — Event Categories (Tab 4)

**Priority:** P1 · **Points:** 6 · **Agent share:** ~78%

**Goal:** Event categories with colours are available to the events calendar.
**Maps to:** FR-SET-08
**Definition of Ready:** Colour palette rule (hex) approved.
**Definition of Done:** Categories managed with soft-delete; consumed by the events module later.

### Story SET-401 — Event category model and CRUD API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want event categories with colours so that events are easy to recognise.

**Acceptance criteria**
1. Duplicate names (case-insensitive) are rejected.
2. Invalid hex colours are rejected.
3. A category referenced by events cannot be deleted, only deactivated.

**Tasks & sub-tasks**
- [ ] **SET-401-T1** — Prisma model `EventCategory`: name (unique, case-insensitive), colorHex, status; optional seed of defaults (Sports, Cultural, Academic, Meeting, Trip) after owner approval
  - [ ] `SET-401-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-401-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-401-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-401-T2** — CRUD with `SET_EVENT_CATEGORY_MANAGE`; deactivate when referenced; `@Audited`
  - [ ] `SET-401-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-401-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-401-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-401-C** — Close-out
  - [ ] `SET-401-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-401-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-401-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-402 — Event Categories tab UI
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a list of categories with colour chips so that I can see and edit them at a glance.

**Depends on:** SET-001, SET-401

**Acceptance criteria**
1. Colour chips render the saved colour in light and dark themes.
2. Matches the specification columns exactly; RTL/mobile pass.

**Tasks & sub-tasks**
- [ ] **SET-402-T1** — List with Name, Color (chip), Action, Status; add/edit dialog with colour input using template tokens/pills
  - [ ] `SET-402-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-402-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-402-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-402-C** — Close-out
  - [ ] `SET-402-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-402-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-402-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC SET-EPIC-05 — Houses (Tab 5)

**Priority:** P1 · **Points:** 6 · **Agent share:** ~78%

**Goal:** Student houses exist for grouping and sports competitions.
**Maps to:** FR-SET-09
**Definition of Ready:** Owner decides whether to add Status/captain fields.
**Definition of Done:** Houses managed; ready for student assignment and sports scoring.

### Story SET-501 — House model and CRUD API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want to define houses so that students can be grouped for competitions.

**Acceptance criteria**
1. Duplicate house names are rejected; colours validated as hex.
2. A house with assigned students cannot be deleted.

**Tasks & sub-tasks**
- [ ] **SET-501-T1** — Prisma model `House`: name (unique), colorHex, description (+ proposed status)
  - [ ] `SET-501-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-501-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-501-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-501-T2** — CRUD with `SET_HOUSE_MANAGE`; deactivate when referenced; `@Audited`
  - [ ] `SET-501-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-501-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-501-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-501-C** — Close-out
  - [ ] `SET-501-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-501-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-501-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-502 — Houses tab UI
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a Houses tab showing name, colour and description so that I can manage houses easily.

**Depends on:** SET-001, SET-501

**Acceptance criteria**
1. Matches the specification columns; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **SET-502-T1** — List with House Name, House Color, Description, Actions; add/edit dialog
  - [ ] `SET-502-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `SET-502-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `SET-502-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **SET-502-C** — Close-out
  - [ ] `SET-502-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-502-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-502-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC SET-EPIC-06 — Scheduler Constraints (Tab 6)

**Priority:** P1 · **Points:** 13 · **Agent share:** ~65%

**Goal:** Teacher-workload limits are configured once and enforced by manual timetabling and the AI timetable assistant.
**Maps to:** FR-SET-10
**Definition of Ready:** Owner clarifies the difference between "hours per week" and "periods per week".
**Definition of Done:** Constraint policy is pure, tested at boundaries and consumed by assignments and the timetable.

### Story SET-601 — Scheduler constraints singleton: model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~45% 🤖 | `backend`, `owner-decision` |

**User story:** As an academic coordinator I want to set teacher workload limits so that nobody is over-scheduled.

**Acceptance criteria**
1. Defaults apply on first run (periods limit 25).
2. Contradictory limits are rejected with an explanation.
3. Changes are audited and readable through `ISchoolSettingsReader`.

**Tasks & sub-tasks**
- [ ] **SET-601-T1** — Prisma model `SchedulerConstraints` (singleton): maxTeacherHoursPerWeek, maxPeriodsPerTeacherPerWeek (default 25), maxConsecutiveClasses (+ proposed maxPeriodsPerDay, minFreePeriodsPerDay, maxSameSubjectPerDay, allowDoublePeriods)
  - [ ] `SET-601-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-601-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-601-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-601-T2** — Validation ranges and cross-field rule: hours and periods limits must not contradict each other given period duration
  - [ ] `SET-601-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-601-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-601-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-601-T3** — 👤 Owner decides whether both "hours" and "periods" limits are kept (see Master Plan §5A clarification)
  - [ ] `SET-601-T3-S1` 👤 Owner decides whether both "hours" and "periods" limits are kept (see Master Plan §5A clarification)
- [ ] **SET-601-T4** — `GET/PUT` with `SET_SCHEDULER_UPDATE`; `@Audited`
  - [ ] `SET-601-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-601-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-601-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-601-C** — Close-out
  - [ ] `SET-601-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-601-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-601-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-602 — Timetable constraint policy (domain service)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As the timetable and AI-assistant developer I want a pure policy that checks teacher load so that the same rules apply everywhere.

**Depends on:** SET-601

**Acceptance criteria**
1. A teacher at exactly the limit passes; one more period fails with a reason.
2. Consecutive-class limit forces a suggested free period.
3. The policy has no framework imports and is used by assignment warnings (ACD-702).

**Tasks & sub-tasks**
- [ ] **SET-602-T1** — `ITimetableConstraintPolicy`: `checkWeeklyLoad`, `checkConsecutive`, `suggestFreePeriod` as pure functions
  - [ ] `SET-602-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-602-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-602-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-602-T2** — Table-driven tests at boundaries: exactly at the limit, limit + 1, consecutive blocks across breaks, teachers with zero load
  - [ ] `SET-602-T2-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **SET-602-C** — Close-out
  - [ ] `SET-602-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-602-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-602-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story SET-603 — Scheduler Constraints tab UI
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an academic coordinator I want a Scheduler Constraints tab with clear help texts so that I understand each limit.

**Depends on:** SET-001, SET-601

**Acceptance criteria**
1. Helper texts match the specification; validation errors appear inline; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **SET-603-T1** — Screen with the three fields and the helper texts from the specification ("Maximum periods a teacher can be assigned per week. Usually between 20-30 periods.", "Hard limit on total teaching periods per teacher per week. Prevents over-scheduling. Default: 25.", "Helps schedule mandatory free-periods…")
  - [ ] `SET-603-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `SET-603-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `SET-603-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **SET-603-C** — Close-out
  - [ ] `SET-603-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `SET-603-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `SET-603-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC HRM-EPIC-01 — Teacher & Staff Directory (minimal prerequisite)

**Priority:** P1 · **Points:** 16 · **Agent share:** ~72%

**Goal:** A minimal staff and teacher directory exists so that subjects and class-teacher roles can be assigned. (Proposed epic — the full HR module comes later.)
**Maps to:** Master Plan §5B items 11 and 13
**Definition of Ready:** Owner approves this proposed prerequisite epic.
**Definition of Done:** Active teachers can be listed and selected by assignment screens.

### Story HRM-101 — Departments and designations
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As an administrator I want departments and designations so that staff can be organised.

**Acceptance criteria**
1. Names are unique; referenced records are deactivated, not deleted.
2. Screen passes RTL/dark/mobile checks.

**Tasks & sub-tasks**
- [ ] **HRM-101-T1** — Models `Department`, `Designation` with name (unique), status; CRUD with permissions; audited
  - [ ] `HRM-101-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `HRM-101-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `HRM-101-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **HRM-101-T2** — Departments list/edit screen from template patterns
  - [ ] `HRM-101-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `HRM-101-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `HRM-101-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **HRM-101-C** — Close-out
  - [ ] `HRM-101-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `HRM-101-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `HRM-101-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story HRM-102 — Staff and teacher profile (minimal)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P1 | M2 | ~65% 🤖 | `backend`, `frontend`, `security` |

**User story:** As an administrator I want to record teachers and staff so that they can be assigned and given accounts.

**Acceptance criteria**
1. Employee numbers are unique; a teacher can exist without a login account.
2. Sensitive fields are not returned without the permission.
3. Deactivating a teacher with active assignments requires reassigning or confirming.

**Tasks & sub-tasks**
- [ ] **HRM-102-T1** — Model `StaffMember`: employeeNo (unique), name, staffType (TEACHER | NON_TEACHING), department, designation, email, phone, joinDate, status
  - [ ] `HRM-102-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `HRM-102-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `HRM-102-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **HRM-102-T2** — Optional link to a `User` account (created by Superadmin/Admin); photo via storage adapter; sensitive fields permission-gated
  - [ ] `HRM-102-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `HRM-102-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `HRM-102-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **HRM-102-T3** — CRUD API with permissions and `@Audited`; ownership facts exposed through ports
  - [ ] `HRM-102-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `HRM-102-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `HRM-102-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **HRM-102-T4** — Staff list/profile screens from template patterns
  - [ ] `HRM-102-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `HRM-102-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `HRM-102-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **HRM-102-C** — Close-out
  - [ ] `HRM-102-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `HRM-102-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `HRM-102-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `HRM-102-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story HRM-103 — Teacher selector API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~80% 🤖 | `backend` |

**User story:** As an assignment screen I want to search active teachers so that I can assign them to subjects and classes.

**Acceptance criteria**
1. Only active teachers are returned; response contains no sensitive HR data.

**Tasks & sub-tasks**
- [ ] **HRM-103-T1** — Search endpoint (name, department, subject) returning minimal fields; `ITeacherDirectory` port consumed by Academic
  - [ ] `HRM-103-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `HRM-103-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `HRM-103-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **HRM-103-C** — Close-out
  - [ ] `HRM-103-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `HRM-103-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `HRM-103-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-01 — Academic Calendar & Terms

**Priority:** P0 · **Points:** 20 · **Agent share:** ~78%

**Goal:** Academic years and their terms/semesters/quarters define the time frame for classes, assignments and promotion.
**Maps to:** FR-ACD-01, FR-ACD-02
**Definition of Ready:** Naming convention and term types approved by the owner.
**Definition of Done:** Exactly one active year; terms inside the year; closed years are read-only.

### Story ACD-101 — Academic year model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want to define academic years so that all data belongs to a period.

**Acceptance criteria**
1. Activating a year deactivates the previously active year in one transaction.
2. Overlapping years are rejected.
3. A closed year rejects edits to its terms and class assignments.

**Tasks & sub-tasks**
- [ ] **ACD-101-T1** — Model `AcademicYear`: name, startDate, endDate, status (Draft/Active/Closed)
  - [ ] `ACD-101-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-101-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-101-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-101-T2** — Rules: exactly one Active; no overlap; end after start; closing makes the year read-only; activation audited
  - [ ] `ACD-101-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-101-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-101-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-101-T3** — CRUD/activate/close endpoints with permissions; `@Audited`
  - [ ] `ACD-101-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-101-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-101-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-101-C** — Close-out
  - [ ] `ACD-101-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-101-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-101-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-102 — Academic Calendar screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want an Academic Calendar screen so that I can manage years and their durations.

**Depends on:** ACD-101

**Acceptance criteria**
1. Status pills follow the template; activate/close show confirmation; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-102-T1** — List with Name, Start, End, Status; add/edit/activate/close actions using template patterns; page text "Manage academic years and their durations."
  - [ ] `ACD-102-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-102-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-102-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-102-C** — Close-out
  - [ ] `ACD-102-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-102-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-102-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-103 — Academic terms model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want terms, semesters or quarters inside each year so that exams and reports follow the school's structure.

**Depends on:** ACD-101

**Acceptance criteria**
1. A term outside its year's dates is rejected.
2. Overlapping terms are rejected; sequence numbers are unique per year.
3. `currentTerm()` is correct on boundary days (FakeClock).

**Tasks & sub-tasks**
- [ ] **ACD-103-T1** — Model `AcademicTerm`: academicYearId, name, termType (TERM/SEMESTER/QUARTER/TRIMESTER), startDate, endDate, sequence
  - [ ] `ACD-103-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-103-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-103-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-103-T2** — Rules: inside the year; no overlaps; sequence unique; current term derived via `IClock`
  - [ ] `ACD-103-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-103-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-103-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-103-T3** — CRUD with permissions; `@Audited`; table-driven tests for boundary dates
  - [ ] `ACD-103-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-103-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-103-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-103-C** — Close-out
  - [ ] `ACD-103-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-103-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-103-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-104 — Terms Management screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want to define terms for each academic year on one screen.

**Depends on:** ACD-103

**Acceptance criteria**
1. Terms display in sequence; validation errors inline; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-104-T1** — Year selector + terms list/editor; page text "Define terms, semesters, or quarters for each academic year."
  - [ ] `ACD-104-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-104-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-104-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-104-C** — Close-out
  - [ ] `ACD-104-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-104-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-104-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-02 — Syllabus

**Priority:** P0 · **Points:** 6 · **Agent share:** ~78%

**Goal:** Curriculum standards exist as data and are attached to subjects and classes.
**Maps to:** FR-ACD-03
**Definition of Ready:** Owner supplies the syllabus list (e.g. "National Curriculum 2025").
**Definition of Done:** Syllabi managed with unique codes and status.

### Story ACD-201 — Syllabus model and CRUD API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an academic coordinator I want to define syllabi so that subjects and classes follow a curriculum standard.

**Acceptance criteria**
1. Duplicate codes are rejected; referenced syllabi cannot be deleted.
2. Inactive syllabi are not offered in subject/class dropdowns.

**Tasks & sub-tasks**
- [ ] **ACD-201-T1** — Model `Syllabus`: code (unique), name, description, status
  - [ ] `ACD-201-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-201-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-201-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-201-T2** — CRUD with permissions; deactivate when referenced; `@Audited`
  - [ ] `ACD-201-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-201-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-201-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-201-C** — Close-out
  - [ ] `ACD-201-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-201-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-201-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-202 — Syllabus screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an academic coordinator I want a Syllabus screen so that I can maintain curriculum standards.

**Depends on:** ACD-201

**Acceptance criteria**
1. Columns match the specification; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-202-T1** — List and dialog (Syllabus Code, Syllabus Name, Description, Status); page text "Configure and manage ACADEMIC curriculum standards."
  - [ ] `ACD-202-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-202-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-202-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-202-C** — Close-out
  - [ ] `ACD-202-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-202-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-202-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-03 — Academic Levels & Sections

**Priority:** P0 · **Points:** 23 · **Agent share:** ~78%

**Goal:** Academic levels (KG, Primary, Secondary…) define the school day structure; sections (A, B…) divide classes.
**Maps to:** FR-ACD-04, FR-ACD-05, FR-ACD-06
**Definition of Ready:** Break-2 field set confirmed (duration and after-period added for symmetry).
**Definition of Done:** Period grid computed correctly and reusable by timetable and bell.

### Story ACD-301 — Academic level model and validation
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want to define each academic level's school day so that timetables and bells follow it.

**Acceptance criteria**
1. A configuration that does not fit the window is rejected with the exact overflow in minutes.
2. A break set after a non-existent period is rejected.
3. Levels referenced by grades cannot be deleted.

**Tasks & sub-tasks**
- [ ] **ACD-301-T1** — Model `AcademicLevel`: name, description, code (unique), scheduleStart, scheduleEnd, periodDurationMin, periodsPerDay, sortOrder, break1 {durationMin, afterPeriod, status}, break2 {durationMin, afterPeriod, status}, active
  - [ ] `ACD-301-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-301-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-301-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-301-T2** — Validation: periods × duration + enabled breaks must fit inside start–end; break "after period" ≤ periodsPerDay; start < end; sortOrder unique
  - [ ] `ACD-301-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-301-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-301-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-301-T3** — CRUD with permissions; `@Audited`; deactivate when referenced by grades
  - [ ] `ACD-301-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-301-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-301-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-301-C** — Close-out
  - [ ] `ACD-301-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-301-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-301-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-302 — Period schedule calculator
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As the timetable and bell developer I want a pure calculator for the day's period grid so that everyone uses the same times.

**Depends on:** ACD-301

**Acceptance criteria**
1. For start 08:00, 8 periods × 40 min, 15-min morning break after period 2 and 30-min lunch after period 5, the grid is correct to the minute.
2. The calculator has no framework or time-zone dependency.

**Tasks & sub-tasks**
- [ ] **ACD-302-T1** — `PeriodScheduleCalculator` returning ordered slots (period n start/end, break 1, break 2, free time at end)
  - [ ] `ACD-302-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-302-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-302-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-302-T2** — Table-driven tests: no breaks, break after last period, zero-length break, break 2 disabled, exact-fit day, over-fit day
  - [ ] `ACD-302-T2-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **ACD-302-C** — Close-out
  - [ ] `ACD-302-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-302-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-302-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-303 — Academic Sections (Academic Level) screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a screen for academic levels with a live period preview so that I can verify the day structure.

**Depends on:** ACD-301, ACD-302

**Acceptance criteria**
1. The preview updates as values change; overflow errors are shown inline.
2. Fields and labels match the specification; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-303-T1** — List and form with the specified fields; live read-only period grid preview from the calculator; page text "Manage academic levels like KG, Primary, Secondary, etc."
  - [ ] `ACD-303-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-303-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-303-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-303-C** — Close-out
  - [ ] `ACD-303-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-303-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-303-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-304 — Section model and CRUD API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want sections (A, B…) so that classes can be divided.

**Acceptance criteria**
1. Duplicate section names are rejected; referenced sections can only be deactivated.

**Tasks & sub-tasks**
- [ ] **ACD-304-T1** — Model `Section`: name (unique), status; CRUD with permissions; deactivate when referenced; `@Audited`
  - [ ] `ACD-304-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-304-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-304-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-304-C** — Close-out
  - [ ] `ACD-304-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-304-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-304-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-305 — Section screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 2 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a simple Section list so that I can manage class sections.

**Depends on:** ACD-304

**Acceptance criteria**
1. Matches the specification; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-305-T1** — List and dialog (Section Name, Status); page text "Manage class sections and their availability."
  - [ ] `ACD-305-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-305-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-305-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-305-C** — Close-out
  - [ ] `ACD-305-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-305-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-305-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-04 — Grades & Class Medium

**Priority:** P0 · **Points:** 13 · **Agent share:** ~78%

**Goal:** Grades belong to academic levels; class mediums describe the language of instruction.
**Maps to:** FR-ACD-07, FR-ACD-08
**Definition of Ready:** Owner approves the proposed sort-order field on grades.
**Definition of Done:** Grades are ordered and linked to levels; mediums available to classes.

### Story ACD-401 — Grade model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want grades linked to academic levels so that the school's structure is complete.

**Depends on:** ACD-301

**Acceptance criteria**
1. Duplicate codes are rejected; a grade must belong to an active level.
2. Grade ordering is stable and used by the promotion engine.

**Tasks & sub-tasks**
- [ ] **ACD-401-T1** — Model `Grade`: code (unique), name, academicLevelId (+ proposed sortOrder, unique within level)
  - [ ] `ACD-401-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-401-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-401-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-401-T2** — CRUD with permissions; deactivate when referenced; `@Audited`; sort order drives the promotion sequence
  - [ ] `ACD-401-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-401-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-401-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-401-C** — Close-out
  - [ ] `ACD-401-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-401-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-401-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-402 — Grade screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a Grade screen so that I can manage grade levels.

**Depends on:** ACD-401

**Acceptance criteria**
1. Level dropdown lists only active levels; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-402-T1** — List and dialog (Code, Name, Academic Level); page text "Manage grade levels for your school (e.g., KG1, Grade 1–13)."
  - [ ] `ACD-402-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-402-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-402-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-402-C** — Close-out
  - [ ] `ACD-402-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-402-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-402-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-403 — Class medium model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an administrator I want class mediums (English, Arabic, Tamil, Sinhala…) so that classes show their language of instruction.

**Acceptance criteria**
1. Duplicate codes are rejected; referenced mediums can only be deactivated.

**Tasks & sub-tasks**
- [ ] **ACD-403-T1** — Model `ClassMedium`: code (unique), name, status; optional seed of the four standard mediums after owner approval; CRUD; `@Audited`
  - [ ] `ACD-403-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-403-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-403-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-403-C** — Close-out
  - [ ] `ACD-403-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-403-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-403-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-404 — Class Medium screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 2 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a Class Medium screen.

**Depends on:** ACD-403

**Acceptance criteria**
1. Matches the specification; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-404-T1** — List and dialog (Code, Medium Name, Status); page text "Configure languages of Class Room (e.g., English, Arabic, Tamil, Sinhala)."
  - [ ] `ACD-404-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-404-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-404-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-404-C** — Close-out
  - [ ] `ACD-404-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-404-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-404-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-05 — Subjects

**Priority:** P0 · **Points:** 13 · **Agent share:** ~57%

**Goal:** Subjects are defined per grade with type, difficulty and colour.
**Maps to:** FR-ACD-09
**Definition of Ready:** Owner decides between "one row per grade" and "subject master + grade mapping".
**Definition of Done:** Subjects unique per grade/syllabus and ready for assignment.

### Story ACD-501 — Subject model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M2 | ~45% 🤖 | `backend`, `owner-decision` |

**User story:** As an academic coordinator I want to define subjects for each grade level so that classes can offer them.

**Depends on:** ACD-201, ACD-401

**Acceptance criteria**
1. Duplicate (code, grade, syllabus) is rejected.
2. Type and difficulty accept only the specified values; colour must be valid hex.
3. A subject with class assignments can only be deactivated.

**Tasks & sub-tasks**
- [ ] **ACD-501-T1** — Model `Subject`: name, code, gradeId, subjectType (CORE/OPTIONAL/ACTIVITY/ELECTIVE), difficulty (LIGHT/MEDIUM/HEAVY), color (hex), description, syllabusId, status
  - [ ] `ACD-501-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-501-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-501-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-501-T2** — Uniqueness `(code, gradeId, syllabusId)`; CRUD with permissions; deactivate when referenced; `@Audited`
  - [ ] `ACD-501-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-501-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-501-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-501-T3** — 👤 Owner confirms the one-row-per-grade model (alternative: subject master + grade mapping)
  - [ ] `ACD-501-T3-S1` 👤 Owner confirms the one-row-per-grade model (alternative: subject master + grade mapping)
- [ ] **ACD-501-C** — Close-out
  - [ ] `ACD-501-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-501-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-501-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-502 — Subject screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an academic coordinator I want a Subject screen with filters so that I can find and edit subjects quickly.

**Depends on:** ACD-501

**Acceptance criteria**
1. Filters work together; colour chip matches saved colour in both themes; RTL/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-502-T1** — List with filters by grade, syllabus and type; colour chip; form with all specified fields; page text "Define and manage academic subjects for each grade level."
  - [ ] `ACD-502-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-502-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-502-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-502-C** — Close-out
  - [ ] `ACD-502-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-502-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-502-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-06 — Classes

**Priority:** P0 · **Points:** 16 · **Agent share:** ~61%

**Goal:** Classes combine grade, medium, syllabus, room and capacity for an academic year.
**Maps to:** FR-ACD-10
**Definition of Ready:** Owner approves adding Section and Academic Year to Class.
**Definition of Done:** Classes unique per year and ready for enrolment and assignments.

### Story ACD-601 — Class model and API
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M2 | ~45% 🤖 | `backend`, `owner-decision` |

**User story:** As an administrator I want to organise students into classes so that timetables and attendance have a target.

**Depends on:** ACD-101, ACD-304, ACD-401, ACD-403, ACD-201

**Acceptance criteria**
1. Duplicate class definitions in the same year are rejected.
2. Capacity below 1 is rejected; reducing capacity below current enrolment is blocked.
3. Closed-year classes are read-only.

**Tasks & sub-tasks**
- [ ] **ACD-601-T1** — Model `SchoolClass`: className, gradeId, classMediumId, syllabusId, roomNumber, capacity (+ proposed sectionId, academicYearId)
  - [ ] `ACD-601-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-601-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-601-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-601-T2** — Rules: capacity ≥ 1; unique `(academicYearId, gradeId, sectionId, classMediumId)`; syllabus and medium active
  - [ ] `ACD-601-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-601-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-601-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-601-T3** — 👤 Owner approves the proposed Section and Academic Year fields (without them a class cannot be "Grade 5-A, 2026/27")
  - [ ] `ACD-601-T3-S1` 👤 Owner approves the proposed Section and Academic Year fields (without them a class cannot be "Grade 5-A, 2026/27")
- [ ] **ACD-601-T4** — CRUD with permissions; deactivate when enrolled students exist; `@Audited`
  - [ ] `ACD-601-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-601-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-601-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-601-C** — Close-out
  - [ ] `ACD-601-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-601-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-601-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-602 — Class screen
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want a Class screen so that I can create and review classes.

**Depends on:** ACD-601

**Acceptance criteria**
1. Dropdowns list only active parents; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-602-T1** — List and form (Class Name, Grade Level, Class Medium, Syllabus, Room Number, Capacity); page text "Organize students into specific classes and sections."
  - [ ] `ACD-602-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-602-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-602-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-602-C** — Close-out
  - [ ] `ACD-602-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-602-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-602-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-603 — Class capacity policy contract
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M2 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As the student-enrolment developer I want a capacity policy so that classes are never over-filled.

**Acceptance criteria**
1. Enrolment beyond capacity is refused with a clear reason; remaining seats are accurate under concurrent enrolments.

**Tasks & sub-tasks**
- [ ] **ACD-603-T1** — `IClassCapacityPolicy` (`canEnroll`, `remainingSeats`) implemented by Academic and consumed by Student enrolment
  - [ ] `ACD-603-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-603-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-603-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-603-C** — Close-out
  - [ ] `ACD-603-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-603-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-603-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-07 — Subject & Teacher Assignments

**Priority:** P1 · **Points:** 31 · **Agent share:** ~75%

**Goal:** Subjects are assigned to classes and teachers; each class has a class teacher.
**Maps to:** FR-ACD-11 – FR-ACD-14
**Definition of Ready:** HRM-EPIC-01 delivered (teacher directory).
**Definition of Done:** Assignments consistent, workload-aware and published as ownership facts.

### Story ACD-701 — Assign subject to class
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M2 | ~80% 🤖 | `backend` |

**User story:** As an academic coordinator I want to choose which subjects each class studies.

**Depends on:** ACD-501, ACD-601

**Acceptance criteria**
1. Assigning a subject from a different grade is rejected.
2. Bulk assignment is atomic (all or none).

**Tasks & sub-tasks**
- [ ] **ACD-701-T1** — Model `ClassSubject` (+ proposed periodsPerWeek); rule: subject's grade must equal class's grade; bulk-assign endpoint; `@Audited`
  - [ ] `ACD-701-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-701-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-701-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-701-C** — Close-out
  - [ ] `ACD-701-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-701-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-701-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-702 — Assign subject to teacher
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P1 | M2 | ~65% 🤖 | `backend`, `security` |

**User story:** As an academic coordinator I want to assign teachers to subjects (and classes) so that every subject has a teacher.

**Depends on:** HRM-103, ACD-701, SET-602

**Acceptance criteria**
1. A teacher can be assigned only to subjects of existing, active records.
2. Exceeding the weekly-load limit produces a visible warning with the numbers.
3. Ownership facts reflect assignments immediately (a teacher can edit grades only for assigned classes).

**Tasks & sub-tasks**
- [ ] **ACD-702-T1** — Model `TeacherSubject` (teacher ↔ subject, optional class scope); only active teachers; duplicate prevention
  - [ ] `ACD-702-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-702-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-702-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-702-T2** — Workload warning using `ITimetableConstraintPolicy` (warn, do not block, unless the owner decides otherwise)
  - [ ] `ACD-702-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-702-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-702-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-702-T3** — Publish assignments as ownership facts (`IClassAssignmentFacts`) for the RBAC engine (PLT-203)
  - [ ] `ACD-702-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-702-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-702-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-702-C** — Close-out
  - [ ] `ACD-702-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-702-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-702-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `ACD-702-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-703 — Subject assignments overview
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As an academic coordinator I want one view of class × subject × teacher so that I can see gaps and overloads.

**Depends on:** ACD-701, ACD-702

**Acceptance criteria**
1. Unassigned subjects and overloaded teachers are highlighted.
2. Export contains exactly the filtered rows.

**Tasks & sub-tasks**
- [ ] **ACD-703-T1** — Query/endpoint returning the matrix with filters (year, grade, class, teacher, unassigned only); export
  - [ ] `ACD-703-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-703-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-703-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-703-T2** — Screen with gap highlighting using template pills/rows
  - [ ] `ACD-703-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-703-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-703-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-703-C** — Close-out
  - [ ] `ACD-703-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-703-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-703-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-704 — Assign class teacher
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~80% 🤖 | `backend` |

**User story:** As an academic coordinator I want one class teacher per class so that responsibility is clear.

**Depends on:** ACD-601, HRM-103

**Acceptance criteria**
1. A second class teacher for the same class/year is rejected (replace requires explicit action).
2. Class-teacher facts are available to ownership policies.

**Tasks & sub-tasks**
- [ ] **ACD-704-T1** — Model `ClassTeacherAssignment` (class, teacher, academicYear); one per class per year; configurable rule "a teacher may be class teacher of at most one class"; `@Audited`
  - [ ] `ACD-704-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-704-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-704-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-704-C** — Close-out
  - [ ] `ACD-704-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-704-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-704-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-705 — Assignment screens
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P1 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an academic coordinator I want screens for the three assignment tasks and the overview.

**Depends on:** ACD-701–704

**Acceptance criteria**
1. Each screen matches the specification names; warnings and errors are inline; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-705-T1** — Screens: Assign Subject to Class, Assign Subject to Teacher, Subject Assignments, Assign Class Teacher; page text "Assign teachers to classes to act as class teachers."
  - [ ] `ACD-705-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-705-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-705-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-705-T2** — Bulk selection, search, validation messages, warnings display
  - [ ] `ACD-705-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-705-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-705-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-705-C** — Close-out
  - [ ] `ACD-705-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-705-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-705-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC ACD-EPIC-08 — Student Promotion

**Priority:** P1 · **Points:** 31 · **Agent share:** ~67%

**Goal:** Students are promoted, retained or reviewed at year end according to configurable criteria, with history preserved.
**Maps to:** FR-ACD-15 · Master Plan §11
**Definition of Ready:** Grading design (`PC-002`) and Student Management are available; owner approves criteria types.
**Definition of Done:** Dry-run, review, commit and history all work; prior-year records are never overwritten.

### Story ACD-801 — Promotion criteria configuration
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~45% 🤖 | `backend`, `owner-decision` |

**User story:** As an academic coordinator I want to configure promotion rules per grade so that outcomes are consistent.

**Acceptance criteria**
1. Criteria validate ranges and are audited.
2. Missing grading data marks the rule as provisional in the UI.

**Tasks & sub-tasks**
- [ ] **ACD-801-T1** — Model `PromotionCriteria` per grade/year: minimum overall percentage, minimum attendance %, fee-hold flag, manual-review flag
  - [ ] `ACD-801-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-801-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-801-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-801-T2** — 👤 Owner approves rule types; the grading inputs are provisional until `PC-002`
  - [ ] `ACD-801-T2-S1` 👤 Owner approves rule types; the grading inputs are provisional until `PC-002`
- [ ] **ACD-801-C** — Close-out
  - [ ] `ACD-801-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-801-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-801-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-802 — Promotion run: dry-run, review, commit
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 13 | P1 | M2 | ~65% 🤖 | `backend`, `security` |

**User story:** As the principal I want to preview and approve promotions so that no student is moved by mistake.

**Depends on:** ACD-801, ACD-601, Student Management, grading (PC-002)

**Acceptance criteria**
1. A dry-run never changes data and is repeatable.
2. Overrides without a reason are rejected; all overrides are audited.
3. Re-running a commit does not create duplicate enrolments.
4. History for every student remains queryable after promotion.

**Tasks & sub-tasks**
- [ ] **ACD-802-T1** — Dry-run classification (Promote / Retain / Review Required) from criteria, attendance, fees; nothing is written
  - [ ] `ACD-802-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-802-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-802-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-802-T2** — Review queue with overrides requiring a reason; committee approval via `IApprovalWorkflow`
  - [ ] `ACD-802-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-802-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-802-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-802-T3** — Commit creates next-year enrolments in a transaction; idempotent; prior-year records preserved
  - [ ] `ACD-802-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-802-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-802-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-802-T4** — Table-driven tests incl. boundary percentages, hold flags, partial commit failure
  - [ ] `ACD-802-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **ACD-802-C** — Close-out
  - [ ] `ACD-802-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-802-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-802-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `ACD-802-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-803 — Promotion history and reports
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M2 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As an academic coordinator I want to see promotion history so that I can answer parents and auditors.

**Depends on:** ACD-802

**Acceptance criteria**
1. History shows decision, reason, approver and date; export matches filters.

**Tasks & sub-tasks**
- [ ] **ACD-803-T1** — History endpoint and screen (by student, class, year); export
  - [ ] `ACD-803-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `ACD-803-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `ACD-803-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **ACD-803-C** — Close-out
  - [ ] `ACD-803-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-803-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-803-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story ACD-804 — Student Promotion screens
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P1 | M2 | ~75% 🤖 | `frontend` |

**User story:** As an academic coordinator I want screens to configure criteria, run promotions and view history.

**Depends on:** ACD-801–803

**Acceptance criteria**
1. Large result sets paginate; overrides require a reason in the UI; RTL/dark/mobile pass.

**Tasks & sub-tasks**
- [ ] **ACD-804-T1** — Screens: criteria, dry-run results table with filters and overrides, commit confirmation, history; page text "Manage student promotions, view history, and configure criteria."
  - [ ] `ACD-804-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `ACD-804-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `ACD-804-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **ACD-804-C** — Close-out
  - [ ] `ACD-804-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `ACD-804-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `ACD-804-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## Recommended build order (dependency-first)

```
PLT-EPIC-10 (shell) ─► SET-001/002 ─► SET-EPIC-01 profile & logo ─► SET-EPIC-02 system config ─► SET-EPIC-03 holidays
                                         └► SET-EPIC-04 event categories · SET-EPIC-05 houses · SET-EPIC-06 scheduler constraints
ACD-EPIC-01 calendar & terms ─► ACD-EPIC-02 syllabus ─► ACD-EPIC-03 levels & sections ─► ACD-EPIC-04 grades & medium
      ─► ACD-EPIC-05 subjects ─► ACD-EPIC-06 classes ─► HRM-EPIC-01 teacher directory ─► ACD-EPIC-07 assignments
      ─► (Students + Grading exist) ─► ACD-EPIC-08 promotion
SET-003 readiness checklist after the others
```

## Open owner decisions (carried from the specification review)

| # | Decision | Where | Default if no answer |
|---|---|---|---|
| 1 | "Max Teacher Hours/Week" vs "Max Periods Per Teacher/Week" — keep both? | SET-601 | Keep both; validate consistency |
| 2 | Add Default Language / Enabled Languages to System Configuration | SET-201/205 | Yes (required by multi-language) |
| 3 | Working days: a count only, or choose the actual days? | SET-201 | Add day checkboxes |
| 4 | Holiday type, academic-year link, recurrence, applies-to | SET-301 | Add type + applies-to later (P2) |
| 5 | Break 2 (Lunch): add duration and after-period fields | ACD-301 | Yes (symmetry with Break 1) |
| 6 | Grade sort order | ACD-401 | Yes (needed for promotion) |
| 7 | Subject: one row per grade or subject master + mapping | ACD-501 | One row per grade (as specified) |
| 8 | Class: add Section and Academic Year | ACD-601 | Yes |
| 9 | Rooms as an entity instead of free-text room number | ACD-601 | Free text now; Rooms entity proposed |
| 10 | Seed default event categories and class mediums | SET-401, ACD-403 | Seed after approval |
| 11 | Tab visibility when a user lacks permission (hidden vs read-only) | SET-001 | Read-only |
| 12 | Logo storage as DB blob confirmed (vs object storage) | SET-102 | DB blob, dedicated table |

---

*End of EduFlow360 Jira/Epic plan — School Setup, Teacher Directory & Academic Setup v1.0*