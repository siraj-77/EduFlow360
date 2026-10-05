# AGENTS.md — EduFlow (new application)

> **Read this before writing any code.** It is the operating contract for this repository.
> **Decided:** September 27, 2026 · **Governing ADR:** `docs/adr/ADR-003-new-app-single-tenant-selective-reuse.md`
> **Revised:** September 28, 2026 — merged with the shared-engine, retail/hall, AI, offline, privacy, UI and process rules from Master Plan v5.2.
> **Revised:** October 5, 2026 — status corrected after a full-tree audit. See the amendment log below.
> **Status:** milestone 1 (Platform Core & RBAC) in progress. Application code exists: 16 Prisma models, 5 controllers, 3 enforcing guards, 1,401 unit + 235 integration + 37 e2e tests. **9 of the 12 API module directories are still empty scaffolds.**

**Precedence:** this file and ADR-003 win over every other planning document. Where the Master Plan, SRS or idea-bank disagree with them (for example on tenancy), follow this file and flag the discrepancy.

### Amendment log

| Date | Change | Authority |
|---|---|---|
| 2026-09-28 | Initial contract. Merged the shared-engine, retail/hall, AI, offline, privacy, UI and process rules from Master Plan v5.2. | Master Plan v5.2 |
| 2026-10-05 | **Status block corrected.** It read *"pre-scaffold. No application code exists yet."* That was false from 2026-09-29 onward, and it was the first thing every session read. | Owner approval of ⚑'B, 2026-10-05 |
| 2026-10-05 | **§3.1 and §4 testing row: Jest → Vitest.** `docs/adr/ADR-020-test-runner-is-vitest.md` was Accepted 2026-09-30; only this amendment was outstanding. | Owner approval of ⚑'A, 2026-10-05 |
| 2026-10-05 | **§7: `PLT-101`'s Definition of Done amended** — mobile parity is milestone 2 per `ADR-005`, so it is no longer part of the web/API DoD. | Owner approval of ⚑N4, 2026-10-05 |
| 2026-10-05 | **§6, §12 and §13 corpus pointer corrected.** All three named `docs/archive/corpus/`, which does not exist. §6 already named `docs/core/` as the source; the other two contradicted it. | Owner decision on ⚑2, 2026-10-05 |

---

## 1. What this repository is

EduFlow is a **school management system / school ERP** being built as a **new application**: web (Next.js), API (NestJS), mobile (Expo, milestone 2). Features are gated by a **digitally signed licence** (Basic / Standard / Deluxe / Enterprise). Languages: **English (default), Tamil, Sinhala, Arabic (RTL)**.

This repository holds the requirements, the architecture and the delivery plan **and the application code built from them.** The codebase is scaffolded and the first vertical slice of milestone 1 is shipped.

**A separate legacy implementation exists at `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\`.** It is a Next.js 16 monolith with a multi-tenant SaaS data model. It is **read-only reference material**. You are not extending it, not deploying it, and not porting it wholesale. See §5 for exactly what may be reused.

**Planning documents (current):** `EduFlow_Project_Master_Plan_v5.2.md` (architecture, module tree, editions, roadmap), `EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` (FR-xxx requirements, test strategy, MVP, phases), `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` (epic/story/AC template), `EduFlow_School_Setup_Workflow_v1.md` (delivery process, gates G0–G9), `EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` (how to drive an agent; **its P0–P14 sequence supersedes any sprint map**), `SSOT.md` (current state of record) and `ARCHITECTURE.md` (the technical form of this contract). Keep them under `docs/core/`.

---

## 2. Architecture rules (non-negotiable)

Hard constraints, not preferences. If a task seems to require violating one, **flag the conflict and ask** — do not silently comply.

### 2.1 Single-tenant: one database and one deployment per school

**Every school is served by its own PostgreSQL database and its own application deployment.**

| Property | Value |
|---|---|
| Deployment unit | One application instance per school |
| Database | One PostgreSQL database per school |
| Data isolation | **Physical** — no shared rows between schools |
| Migrations | Applied per school database |

**The single most important consequence: a missing `WHERE` clause cannot leak data across schools, because no other school's rows exist in the database.**

Therefore:

- **Do not build tenant-scoping machinery.** No `schoolId`-scoped query extensions, no ambient tenant context, no cross-tenant guards, no row-level-security dependency for isolation. They defend against a threat that does not exist here, and each one is a new surface that can be bypassed.
- **Do not add a `SUPER_ADMIN` cross-tenant role.** There is nothing to be cross-tenant about. The highest role is an in-school administrator.
- **Do not write cross-school aggregate queries against the product database.** That is a separate analytical store, out of scope.
- **Do carry a `schoolId` column** on school-scoped entities — for auditability, licence portability and future flexibility. It is **metadata, not a security control**. Uniqueness constraints are scoped within a school's database, never assumed global.
- **No `if (schoolId === ...)` branches and no ad hoc feature flags.** Capabilities and premium features are gated through the licence/entitlement engine only (§2.3).

### 2.2 Clean Architecture, dependency flows inward

```
Presentation (controllers, pages)  →  Application (use-cases)  →  Domain (entities, ports)  ←  Infrastructure (adapters)
```

- Domain entities and use-cases **must never** import NestJS decorators, ORM classes, queue clients, or UI libraries.
- Vendor and hardware integrations sit behind adapter interfaces: `IBellHardwareAdapter`, `IWhatsAppAdapter`, `ISmsAdapter`, `IVideoConferenceAdapter`, `IAttendanceCaptureAdapter`, `IStorageAdapter`, `INotificationChannelAdapter`, `IPaymentGatewayAdapter`, `IFacilityBookingAdapter`.
- **Never call a vendor SDK from a use-case or domain file.** The infrastructure layer implements the interface.
- **Notification channels are Email (default), SMS, WhatsApp and Push.** `PLT-701`'s router resolves the channel from the user's preference, defaulting to **email**. SMS and WhatsApp are **per-message billed**, so they require per-recipient rate limiting and digesting — push is free, email is comparatively cheap. Emergency alerts bypass digesting. WhatsApp targets the **Wvaslution API**; the **SMS provider is deliberately undecided**, so `ISmsAdapter` must stay vendor-agnostic and be replaceable without touching domain or use-case code.
- **Never hard-code a provider, country tax rule, currency or payment gateway in a use-case, entity, or DTO.** Provider selection belongs in `infrastructure/adapters/`; rates and currency come from school settings.
- Every module is `controllers/`, `use-cases/`, `domain/{entities,repositories,ports}/`, `infrastructure/{postgres,adapters}/`, `dto/`. Never a single fat service file.

**SOLID, in this codebase:**

- **S** — one class owns one concern (checkout ≠ tax ≠ printing; settlement calculation ≠ ledger posting). A React component renders *or* fetches, not both.
- **O** — add capabilities by implementing existing interfaces (a new `ILedgerPostingRule`, `IConcessionSettlementStrategy`, or payment adapter), never by editing the core engine. Extend shadcn components by composition and `className`; never edit generated files under `ui/`.
- **L** — any adapter (payment, WhatsApp, Zoom/Meet/Jitsi, biometric vendor) is swappable without breaking callers.
- **I** — narrow interfaces (`IBellHardwareAdapter`), not god interfaces; narrow component props.
- **D** — use-cases depend on domain ports; adapters are injected from licence and settings. Shared UI state (auth, theme, locale, permissions) flows through context/Zustand, not prop drilling.

### 2.3 Authorization: three mandatory guards, fail-closed

Every route is protected by guards. All three compose; none is optional.

| Guard | Decorator | Enforces |
|---|---|---|
| Permission | `@RequirePermission('<PERMISSION_KEY>')` | The user's role grants this action |
| Entitlement | `@RequireEntitlement('<feature_key>')` | The school's licence includes this feature |
| Audit | `@Audited('<ACTION_KEY>')` | The action is recorded append-only |
| Public | `@Public('<reason>')` | The **only** exemption from `@RequirePermission`. The reason is mandatory |

- **A route with no `@RequirePermission` and no `@Public('<reason>')` is a defect.** A CI static check must fail on any controller route carrying neither. It accepts either one; every `@Public` use is listed in a checked-in allowlist file with its justification, so exemptions are reviewable rather than invisible. Fail-closed, never fail-open.
- `@RequireEntitlement` is required on any feature-gated capability so a Basic-edition school cannot reach Deluxe functionality by calling the API directly.
- `@Audited` is required on every sensitive action: finance, grades, permissions, attendance overrides, leave approvals, document issuance, GL postings, hall-booking overrides, wallet movements.
- **Ownership policies are enforced, not just roles** (`IOwnershipPolicy`): teacher → own classes, parent → own children, vendor → own outlet. Role-denial and ownership-denial are distinguishable in logs.
- The frontend permission gate is **UX only**. It is never the security boundary.
- No module ships without auth and RBAC wired in from its first commit. There is no "secure it later" phase.

### 2.4 Time-dependent logic uses `IClock`

Domain and use-case code **must never** call `Date.now()`, `new Date()` or `Math.random()` directly. Inject `IClock` (and an injected id generator for randomness). Required for deterministic tests of accrual, licence expiry, deadlines and hold expiry.

### 2.5 Money is never a float

- All monetary amounts are **fixed-precision integer minor units** (e.g. `amount_minor: bigint`) or a decimal library, with an explicit currency code. Never `float`/`number` with implicit rounding.
- A journal entry whose debits and credits do not sum equal is **rejected in the domain layer**, before it reaches the database. This invariant has a dedicated unit test and must never be weakened.
- Rounding mode and minor-unit scale are a **per-school setting**, read from school configuration, never hardcoded.

### 2.6 General Ledger — correctness-critical

- Every financial transaction from any module (fees, payroll, facility/hall hire, library fines, BookShop/Canteen settlements, wallet movements, subsidies, adjustments) posts through the shared `ILedgerPostingRule` engine. **No feature module writes directly to `journal_entries`.**
- Manual journal entries require a mandatory `reason` and produce an audit record.
- Adding a new income/expense source means a **new `ILedgerPostingRule` implementation** — never a change to the core posting engine (Open/Closed).
- **Operator-model accounting:** `SCHOOL_RUN` outlets post gross sales + cost of goods; `THIRD_PARTY` outlets post only rent/commission. Hall damage deposits post to a *Deposits Held* liability; Student Wallet balances are a liability.
- Period close is a *soft* close (warn on backdated postings); hard-lock is a later, Enterprise-tier control.

### 2.7 Audit records are append-only

- The audit repository exposes only `create()` and `query()`. **Do not add `update()` or `delete()`.**
- Never write raw SQL that mutates `audit_records`.
- Enforce immutability at the database level too: revoke `UPDATE`/`DELETE` grants on the audit table from the application role. Defence in depth, not convention.

### 2.8 No hard-coded user-facing strings

All UI text goes through i18n resource files. English (default), Tamil, Sinhala, Arabic. A literal English string in JSX/TSX is a review-blocking issue.

**Start from the existing assets, not from scratch.** `docs/template/EduFlow — Frontend Template.html` contains a **light/dark token set** (harvest in full), and the **pattern** for RTL (`dir` set on `<html>`, rules scoped under `html[dir="rtl"]`) — harvest the pattern. It does **not** contain a usable dictionary: it has **21 keys, all landing-page marketing copy, and zero application keys**, so real i18n content is authored per module. Its RTL implementation is **4 CSS rules that mirror a landing page** — no sidebar, form, table, logical properties or icon mirroring — so app-shell RTL is built from scratch. It also has **no `prefers-reduced-motion`** rule. Harvest the tokens into `packages/ui-kit`; build the dictionary in `packages/i18n-resources`. Assessment: `docs/design/FRONTEND_TEMPLATE.md`.

**Take the i18n, RTL and tokens. Do not take the marketing claims** — "Trusted by 200+ schools" and "1.2M Students Managed" are false, and "Start Free Trial" contradicts a per-school deployment sold on editions.

### 2.9 One shared engine per concern

Never build a second engine for something that already has one. Extend it.

| Concern | The one engine | Covers | Never |
|---|---|---|---|
| Attendance | `AttendanceRecord` (actor-agnostic) + `IAttendanceCaptureAdapter` | student, teacher, staff; transport, hostel, club and video-session presence as *contexts/sources* | a second attendance model |
| Stock | shared stock engine, ledger-style movements | asset consumables, **BookShop**, **Canteen** | a bare `stock_on_hand` field; per-outlet stock models (Library circulation is its own domain) |
| Facility booking | `IFacilityBookingAdapter` | pool, courts, grounds, IT lab, **School Hall** | per-facility booking tables |
| Approvals | `IApprovalWorkflow` | leave, gate passes, facility/hall hire, prefect appointments, certificates, wallet refunds, ticket escalation | per-module approval chains |
| Documents | Document/Print engine, versioned templates | ID cards, certificates, report cards (A4/A5/CR80), receipts, hire agreements, settlement statements | per-document PDF pipelines |
| Notifications | `INotificationChannelAdapter` router | every alert and message | one-off integrations inside a module |
| Ledger | `ILedgerPostingRule` | all money | direct journal writes |

Issued documents keep the template version they were issued with; a template change never alters past documents.

### 2.10 Retail outlets and hall rental

- **Operator is data, not code.** BookShop and Canteen are `Outlet`s with an effective-dated `operator_model`: `SCHOOL_RUN | THIRD_PARTY`. The same catalog/POS/stock code serves both; only the `IConcessionSettlementStrategy` and RBAC scope differ. **Never fork outlet logic per operator model or hard-code a vendor.**
- **Vendors are data-minimised.** The vendor role is scoped to its own outlet and receives only a student token plus the minimum flags needed to serve them (e.g. allergy alert) — never a full student profile. Log vendor lookups.
- **Canteen allergy flags** are shown at point of sale; overriding one requires an explicit, logged staff action. The system supports but never guarantees allergen safety.
- **Auto-generated purchase orders are always drafts** that a person approves.
- **Hall and facility rental:** confirmed bookings are never displaced silently. An internal event may pre-empt only a *tentative* hold; displacing a confirmed booking needs an audited Admin override with a reason. External hirers are lightweight contacts, not full user accounts.
- **Student Wallet** is optional, a GL liability, and must not be enabled without legal review of stored-value rules for the jurisdiction.

### 2.11 Human-in-the-loop for automation and AI

AI timetables, substitution proposals, AI report-card comments, lesson plans and auto-generated purchase orders are **drafts** until a person approves them. The AI chatbot never performs a write without explicit user confirmation, is scoped to the asking user's RBAC permissions, and answers policy questions only from retrieved school documents — falling back to a Helpdesk ticket when unsure.

### 2.12 Offline-first where connectivity is unreliable

Attendance kiosk, outlet POS and teacher attendance capture are designed **local-first**: queue events locally, sync when connected, and resolve conflicts through an admin-review queue — not "online with an offline fallback bolted on". (Applies as those modules are built; mobile is milestone 2.)

### 2.13 Privacy and child safety

Biometric templates are stored as irreversible hashes and never logged. Alumni data is consent-based. Mentorship is school-mediated, never direct alumni-to-minor. Logs redact passwords, tokens, card data, secrets and biometric templates.

### 2.14 Configuration, gating and simplicity

- **Settings is a first-class subsystem.** Thresholds, toggles, grace periods, rate cards, retention periods, rounding — all live in settings, never constants.
- **Default every screen to the simplest view for the school's licensed modules.** Hide unused menus and fields; do not delete advanced options.

### 2.15 Errors and logging

Every `ERROR`/`CRITICAL` is written to **both** the rotating structured-JSON file log **and** the DB error log — never one without the other. Logs carry correlation IDs and pass through redaction (§2.13). Rotation: 25 MB active file, 3 historical files.

---

## 3. Repository structure

Scaffold **both** trees in full before writing logic in a new module.

```
EduFlow/
├── apps/
│   ├── api/src/modules/<module-name>/
│   │   ├── controllers/            # routes + @RequirePermission/@RequireEntitlement/@Audited
│   │   ├── use-cases/              # application layer, orchestrates domain + ports
│   │   ├── domain/
│   │   │   ├── entities/           # pure domain, no framework imports
│   │   │   ├── repositories/       # interfaces (ports)
│   │   │   └── services/           # rule engines
│   │   ├── infrastructure/
│   │   │   ├── postgres/           # Prisma implementations
│   │   │   └── adapters/           # vendor/hardware adapters
│   │   └── dto/                    # Zod schemas
│   ├── web/src/features/<module-name>/
│   │   ├── pages/  components/  hooks/  services/  schemas/  types/  i18n/  permissions/
│   └── mobile/                     # Expo, mirrors web structure where practical (milestone 2)
├── packages/
│   ├── shared-types/               # cross-app DTOs
│   ├── ui-kit/                     # shared shadcn/ui wrappers
│   ├── i18n-resources/             # en/ta/si/ar bundles
│   └── config/                     # shared ESLint/TSConfig/Prettier
├── directives/                     # Layer-1 SOPs (§10)
├── infra/
│   ├── docker/                     # per-school provisioning, compose
│   ├── ci/                         # pipeline definitions
│   └── terraform/                  # school-deployment IaC
└── docs/
```

One folder per feature/module holds its components, hooks, services and tests. Root-level `components/` and `hooks/` are for genuinely shared code only.

### 3.1 Tech stack (do not substitute without asking)

| Layer | Stack |
|---|---|
| Web | Next.js, React, TypeScript (strict), Tailwind CSS, shadcn/ui — UI only; the API is a separate service (no server actions) |
| API | NestJS, Prisma, Zod |
| Database | PostgreSQL, one per school |
| Cache / queue | Redis + BullMQ |
| Storage | S3-compatible behind `IStorageAdapter` |
| Mobile | React Native + Expo (milestone 2) |
| i18n | per Master Plan §2.1 (`next-intl`/`react-i18next` web, `i18next` mobile) — confirm before adding |
| Documents | headless Chromium or PDFKit/Handlebars, locale-aware font embedding |
| Testing | **Vitest** (`ADR-020`), React Testing Library, Playwright (web). Detox deferred with mobile to milestone 2 (`ADR-005`) |

### 3.2 UI rules (mandatory)

1. **All UI primitives are shadcn/ui components** — no raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>`.
2. **Responsive, mobile-first.** Sidebar is a `Sheet` drawer on mobile, full sidebar on `lg:`. Tables use horizontal `ScrollArea` or a card layout on mobile. Touch targets ≥ 44px.
3. **No monolithic pages.** Pages compose small section components; a `.tsx` file approaching ~300 lines or mixing concerns is split.
4. **Loading:** `<Skeleton>` for async data; buttons `disabled` + spinner while submitting; `loading.tsx` per route.
5. **Light and dark themes are both required**, with a one-click toggle. Tokens are CSS variables; never hard-code a hex value in a component; never ship a component that only works in one theme. Set `data-theme` on `<html>` before first paint and honour `prefers-color-scheme` when no choice is saved. Harvest tokens from the template (§2.8):

```css
:root { --bg:#f7f8fb; --surface:#fff; --text:#161a23; --muted:#6b7280; --border:#e6e8ee;
        --brand:#4f46e5; --brand-2:#7c3aed; --accent:#06b6d4; --danger:#dc2626; --ok:#059669; }
[data-theme="dark"] { --bg:#0d0f16; --surface:#141824; --text:#eef0f6; --muted:#9099ad; --border:#242938; }
```

6. **RTL-safe:** use logical properties (`ms-*`/`me-*`/`ps-*`/`pe-*`, `start`/`end`), mirror directional icons, and verify Arabic on every new screen.
7. **Fonts must cover Tamil, Sinhala and Arabic**, on screen and in generated PDFs. Confirm the approved font stack with the owner. Motion ≤ 200 ms and respects `prefers-reduced-motion`.

---

## 4. Quality gates — must pass before commit

No production code is merged without all of these green.

| Gate | Command | Requirement |
|---|---|---|
| Unit tests | `pnpm test` | All pass. **TDD: a failing test must be observed before the fix.** |
| Typecheck | `pnpm typecheck` | 0 errors |
| Lint | `pnpm lint` | 0 errors |
| Coverage | `pnpm test:coverage` | Thresholds enforced (see below) |
| Build | `pnpm build` | Green |
| Integration | `pnpm test:integration` | Containerized real-Postgres, isolated schema |
| E2E | `pnpm test:e2e` | Playwright (web). Detox arrives with mobile, milestone 2 |

**Coverage thresholds** — tiered, from the corpus SRS §12:

| Area | Line | Branch |
|---|---|---|
| Domain entities & use-cases | 90% | 85% |
| Controllers / DTOs | 70% | — |
| Frontend logic hooks | 80% | — |

Adapters are contract-tested, not coverage-gated. **The coverage gate is mandatory, not aspirational.** A test count is not evidence of coverage.

### 4.1 TDD is required

Write the failing test. Watch it fail for the right reason. Write the minimum code to pass. Then refactor.

- One test file per source file, colocated: `X.service.ts` → `X.service.spec.ts`.
- **Table-driven tests for every rule engine** — promotion, leave accrual, attendance discrepancy detection, licence validation, GL posting, facility/hall conflict checking, concession settlement. Cover boundary conditions explicitly, not just the happy path.
- Tests assert real behaviour, never mock behaviour. Prefer real collaborators; mock only what is genuinely external.
- In git, checkpoint after each TDD stage: one commit for RED, one for GREEN, optional one for refactor.
- Critical security test: prove a parent's session (or chatbot query) can never read another family's data, and a vendor can never read beyond its own outlet.

### 4.2 i18n checklist for any UI work

- [ ] Strings added to `en.json` first, then `ta.json`, `si.json`, `ar.json`. Never ship a silent English fallback in a non-English locale.
- [ ] Layout tested in RTL (Arabic) — icon direction, form alignment, sidebar position, number/date formatting.
- [ ] Generated documents (ID card, certificate, report card, receipt) checked for correct font embedding in the PDF pipeline.

### 4.3 Pre-merge self-check

- [ ] Typecheck, lint, tests, coverage and build green.
- [ ] Logic sits in a use-case behind an interface — not in UI or a controller.
- [ ] No second attendance/stock/booking/approval/document/notification/ledger engine (§2.9).
- [ ] No operator-model fork in outlet code beyond settlement strategy and RBAC scope (§2.10).
- [ ] Every new route has all three guards; the RBAC permission-matrix fixture is updated.
- [ ] Money is integer minor units; journal entries balance; posting goes through a rule.
- [ ] Errors go to file **and** DB; nothing sensitive is logged.
- [ ] i18n keys in all four locales; RTL, light/dark and mobile verified.
- [ ] Time via `IClock`; rule engines have table-driven boundary tests.
- [ ] Vendor-facing paths expose minimal data.
- [ ] Epic success criteria met (§7.1); no secrets in tracked files (§11).
- [ ] `docs/work/WORKLOG.md` and `docs/work/TODO.md` updated in the same commit.

---

## 5. Legacy reuse: the whitelist

`EduFlowV3` is a legacy implementation. Reuse is **explicit and bounded**. Anything not listed below is **not** ported.

### 5.1 Reuse these

> **Carve-out (decision D1): Attendance, Leave and Grading are designed fresh. Nothing in those three domains is ported, and the legacy implementations are not the specification. Their tests do not port either.**

| Category | Notes |
|---|---|
| **Business logic** | Fee calculation, fee assignment, promotion rules, scheduling engine. **Excludes** attendance, leave and grading — see carve-out above. Verified during the September 2026 audit; covered by table-driven tests. |
| **Login / authentication logic** | Credential verification, password hashing, password reset, session handling, CSPRNG temporary passwords. |
| **Table / schema definitions** | Entity shapes and field semantics. Re-derive tenancy per §2.1 — do **not** port the legacy scoping columns as a mechanism. |
| **Validation rules** | Field-level and cross-field validation, including money precision and boundary conditions. |
| **Tests for the above** | The table-driven rule-engine tests are the executable specification. Porting them ports the spec. |

Inventory and per-file judgements: `docs/analysis/LEGACY_REUSE_INVENTORY.md`.

### 5.2 Do not reuse these

| Category | Why |
|---|---|
| **All UI, components, styling** | The interface is being redesigned. Nothing carries over. |
| **Tenant-scoping layer** | `prisma-tenant-extension.ts`, `tenant-context.ts`, 35-model scoping. Solves a problem that does not exist under §2.1. Importing it adds a bypass surface with no threat behind it. |
| **Global cross-school `@unique` constraints** | 14 legacy constraints assume a shared database. Irrelevant and wrong here. |
| **Raw-SQL repositories** | **149** `$queryRaw`/`$executeRaw` call sites. Not ported. Method: recursive `*.ts`/`*.tsx` scan of the legacy app excluding `node_modules`/`.next`, measured 2026-09-28. See `docs/analysis/LEGACY_REUSE_INVENTORY.md` §2. |
| **Next.js server actions / App Router API** | New build uses a separate API service. |
| **Workspace artefacts** | Root scratch scripts, 4 stale generated Prisma clients, self-nested clone, 431KB log dumps. |

**When in doubt, do not port.** A ported file must be named in the reuse inventory with a reason.

---

## 6. Requirements baseline

> ⚠️ **The `docs/idea-bank/` extraction has NOT been performed. The directory contains five loud, empty stubs.** Corrected 2026-09-29 by **D28**.
>
> This section previously tabulated **139 modules / 20 domains · 257 rules · 35 entities · 15 risks / 40 boundary tests / 41 failure modes · 73 FRs + 9 NFRs** as the contents of those five files. **None of those figures has a source in this repository.** The files are 43–62 lines of header, column schema, acceptance criteria and trap list, totalling **16,124 bytes** — physically incapable of holding that content. Each declares `**Status:** Placeholder. Zero …rows.`
>
> The figures are **removed, not replaced.** Independently enumerating `SRS` §3 yields **87 unique FR IDs** — so even the FR count was wrong — but substituting 87 without running the extraction would be a *second* invention, which is the exact failure `docs/idea-bank/README.md` exists to prevent. Only the **9 NFR** figure was correct (`SRS` §5, `NFR-01`…`NFR-09`).
>
> **Do not size work from any figure in this section.** Run the extraction first (`REQ-01`…`REQ-05`).

| File | Status |
|---|---|
| `module-inventory.md` | 🔴 **Empty stub.** Will carry modules with priority, required entities, licence gate and engine dependencies |
| `business-rules.md` | 🔴 **Empty stub.** Will carry rules with a **source citation and a test target** |
| `domain-entities.md` | 🔴 **Empty stub.** Will carry entities with field definitions, constraints, `schoolId`/money flags |
| `edge-cases-and-risks.md` | 🔴 **Empty stub.** Will carry risks, boundary tests, failure modes and test standards |
| `fr-index.md` | 🔴 **Empty stub.** Will carry FR/NMR traceability from `SRS` to epic → story → test |

**Where the requirements actually are today:** the archived corpus in `docs/core/` — `EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` (the FR and NFR source of record, **87 FRs + 9 NFRs**), `EduFlow_Project_Master_Plan_v5.2.md` (the module tree, §5) and `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` (9 epics · 33 stories · 199 points). There is no `docs/archive/corpus/`; ⚑2 is answered — **`docs/core/` is the corpus.**

**Read the relevant `docs/core/` section before implementing any module.** **Before creating any entity, enum, interface or engine, check `docs/core/SSOT.md`, `docs/core/ARCHITECTURE.md` and §2.9 for an existing equivalent** — creating a parallel concept under a new name is the most common way this codebase drifts.

**A gap in the corpus is recorded as `GAP — needs design (PC-xxx)`. Never invent a threshold, a formula or a schedule to fill a table.** A missing rule is visible; a fabricated one is not.

### 6.1 Known requirements gaps — resolve before building these

These are **blocking**. The corpus does not contain the design.

| Gap | Blocks | Ticket |
|---|---|---|
| **Attendance** — no design at all | Attendance module | `PC-000` |
| **Leave / Workforce** — no design at all | Workforce, leave accrual | `PC-001` |
| **Grading & Moderation** — P0, zero rules | Exams, report cards, promotion, analytics | `PC-002` |
| **Tax & currency** — never mentioned, despite invoicing | Fees, payroll, procurement | `PC-003` |
| **Admission** — in MVP list, no FR behind it | MVP scope | `PC-004` |
| **BookShop, Canteen, School Hall rental** — specified in Master Plan v5.2 §17.6–17.9 (newer than the idea-bank extraction); needs FR/rule/entity extraction and settlement design | Retail outlets, hall rental | `PC-005` *(proposed — not yet ticketed)* |
| **Student Wallet** — stored-value legal review and GL design | Wallet | `PC-006` *(proposed — not yet ticketed)* |

---

## 7. Delivery plan

**First milestone: Platform Core & RBAC** — `PLT-EPIC-01` … `PLT-EPIC-09`, ~199 points. (Story count: see `docs/work/PLATFORM_CORE_PLAN.md`; the Jira plan file lists 33 — reconcile if they differ.)

Epic and story IDs are taken unchanged from the corpus and are the traceability backbone. **Do not renumber them.**

| Epic | Name | Pts |
|---|---|---|
| `PLT-EPIC-01` | Authentication & Session Management | 34 |
| `PLT-EPIC-02` | Dynamic RBAC & Policy Engine | 42 |
| `PLT-EPIC-03` | Licensing & Entitlement Enforcement | 29 |
| `PLT-EPIC-04` | Immutable Audit Logging System | 21 |
| `PLT-EPIC-05` | Error & Diagnostic Logging Engine | 18 |
| `PLT-EPIC-06` | Dynamic Module Registry & System Settings | 16 |
| `PLT-EPIC-07` | Multi-Channel Notification Router | 13 |
| `PLT-EPIC-08` | Storage & File Manager | 13 |
| `PLT-EPIC-09` | System Health & Monitoring | 13 |

**Critical path:** `PLT-EPIC-01` → `PLT-EPIC-02` → `PLT-EPIC-03` → `PLT-EPIC-04`. Every later module assumes these decorators exist and work.

> **`PLT-101`'s Definition of Done is amended (⚑N4, owner-approved 2026-10-05).** The Jira DoD required mobile parity, while `D5` / `ADR-005` place `apps/mobile` in milestone 2 — so the DoD was unsatisfiable and `PLT-101` could not be formally signed off. Mobile parity is **removed** from the web/API Definition of Done. The story is complete on web/API scope; `PLT-104`, `PLT-106` and the push half of `PLT-702` carry the mobile work into milestone 2.

**Decided scope (September 27, 2026):** licensing ships in this milestone (D4). **`apps/mobile` is milestone 2** (D5) — `PLT-104`, `PLT-106` and the push half of `PLT-702` move with it. The milestone-2 MVP is a **reduced vertical slice**: enrolment → class assignment → attendance → fee invoice → GL posting → receipt.

Plan: `docs/work/PLATFORM_CORE_PLAN.md`.

### 7.1 How to work an epic

0. **Pre-work analysis (no implementation without it):** review the current schema/migrations, the modules involved, data flow and state management, and the current phase.
1. Confirm the **epic** and its **success criteria**. If none are given, propose them (functional tests; performance/security where relevant) and get confirmation.
2. Build the smallest independently testable slice.
3. Write tests alongside the code (§4.1) — integration tests for critical flows: attendance → alert, fee → payment → GL, outlet sale → settlement, hall booking → deposit → settlement.
4. Do not start the next epic, or bundle unrelated epics, until the current one's success criteria are demonstrably met.
5. "It compiles" is not "done."

---

## 8. Coding conventions

**TypeScript strict everywhere.** No `any` without a `// TODO: type this` comment **and** a linked ticket. No `@ts-ignore` / `@ts-expect-error` — fix the type.

| Concern | Convention |
|---|---|
| Files | `kebab-case.ts`, `kebab-case.tsx`, `page.tsx`, `layout.tsx` |
| Components | `PascalCase.tsx` |
| Functions/vars | `camelCase` |
| Interfaces/types | `PascalCase`; ports prefixed `I` (`IFacilityBookingAdapter`) |
| Constants | `UPPER_SNAKE_CASE` |
| Validation | Zod at every boundary (DTO in, domain value object out) |
| Errors | Typed domain errors; never swallow. No bare `catch {}` |
| Money | integer minor units + explicit currency code |
| Dates | UTC in storage, school timezone at the edges, `IClock` for "now" |
| Imports | explicit, no barrel cycles; type-only imports marked `import type`; alias `@/*` → `./src/*` |

**Never hardcode** a school's timezone, currency, language or academic calendar. Read from school settings.

**Do not add a new state-management library, ORM, or CSS framework** without explicit instruction. Check `package.json` first. ESLint + Prettier must pass; a pre-commit hook enforces it; no direct commits to protected branches.

---

## 9. Commit, ticket and worklog conventions

- Commit messages reference the requirement ID: `feat(fees): implement FR-FEE-03 late-fee accrual (PLT-301)`.
- Conventional Commits: `feat` `fix` `test` `refactor` `docs` `chore`.
- Every new sensitive route adds a row to the RBAC permission-matrix fixture. **Do not merge a route without updating it** — this is `PLT-205`'s living matrix.
- **If work is not in the worklog, it did not happen.** Update `docs/work/WORKLOG.md` and `docs/work/TODO.md` **in the same commit** as the change: log "In Progress" before starting; log immediately after completing a task, decision, test/build run or bug fix. Entry fields: Date, Phase, Task, Agent/Developer, Status, Activity, Files Changed, Decisions Made (with rationale), Next Steps, Quality (tests, lint/build, issues). PRs without an updated worklog are not mergeable.
- Unscheduled ideas go to `docs/work/BACKLOG.md`; module working notes to `docs/modules/<module>/`.

---

## 10. Process framework: directives, orchestration, execution

LLMs are probabilistic; business logic, DB operations, hardware access and builds must be deterministic.

- **Layer 1 — Directives (what):** Markdown SOPs in `directives/` — goals, inputs, outputs, constraints, edge cases, approved tools. Living documents.
- **Layer 2 — Orchestration (deciding):** the agent reads directives, sequences work, handles errors, asks when ambiguous, and updates directives with what it learns. It routes intent to deterministic code; it does not implement heavy logic itself.
- **Layer 3 — Execution (doing):** deterministic, idempotent, testable code.

**Self-annealing loop:** read the error → fix the root cause → re-run and validate → update the directive.

| Responsibility | Agent |
|---|---|
| Core orchestration | `core` |
| Planning & task breakdown | `planner` |
| Code implementation | `builder` |
| Review & refactoring advice | `reviewer` |
| Accessibility audits | `accessibility` |
| SEO & metadata (public pages) | `seo` |
| Testing & validation | `tester` |
| CI/CD & workflows | `ci` |
| Git operations | `github` |
| Decisions & long-term knowledge | `memory` |
| Error investigation & log analysis | `detective` |

No agent operates outside its responsibility; the orchestrator delegates rather than executes; multi-responsibility tasks are split and routed. Every agent logs its own activity (§9).

*Optional:* if `graphify-out/GRAPH_REPORT.md` exists, read it first; if `graphify-out/wiki/index.md` exists, navigate it instead of raw files; run `graphify update .` after code changes. Absence never blocks work.

---

## 11. Environment variables and secrets

`.env.example` (tracked) documents every variable with placeholders; `.env` / `.env.local` (git-ignored) hold real values.

```
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?schema=public"
REDIS_URL="redis://<host>:6379"
JWT_ACCESS_SECRET="<generate with: openssl rand -base64 32>"
JWT_REFRESH_SECRET="<generate with: openssl rand -base64 32>"
LICENSE_PUBLIC_KEY_PATH="./keys/license.pub.pem"
STORAGE_ENDPOINT="<s3-compatible endpoint>"
# OAuth client IDs/secrets, payment, WhatsApp/SMS/email and video providers: see docs/core
```

**Never put a real credential — or a real-looking example — in any tracked file.** Start-up must fail fast naming the missing variable; no silent defaults.

---

## 12. Where to look

| Question | Answer lives in |
|---|---|
| What are we building, and why this way? | `docs/adr/ADR-003-*` |
| What is the current state of the project? | `docs/core/SSOT.md` |
| How is it architected? | `docs/core/ARCHITECTURE.md`, Master Plan v5.2 §5 |
| What are the exact business rules? | 🔴 **`docs/idea-bank/business-rules.md` is an empty stub — see §6.** Until `REQ-03` runs: SRS v1.2, then Master Plan v5.2 |
| What entities and fields exist? | 🔴 **`docs/idea-bank/domain-entities.md` is an empty stub.** Until `REQ-02` runs: `SSOT.md` §4 decisions, `ADR-002`, and the ERD once it exists |
| What is in the MVP? | **`docs/core/EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` Part D §19** — not the idea-bank, which is a stub |
| BookShop / Canteen / Hall / newer requirements? | Master Plan v5.2 §17; SRS v1.2 FR-RET / FR-CAN / FR-BKS / FR-FAC / FR-WAL |
| What are we building first? | `docs/work/PLATFORM_CORE_PLAN.md` |
| How do I write epics/stories? | `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` |
| What is the next task? | `docs/work/TODO.md` |
| What was decided and why? | `docs/adr/` |
| What can I reuse from the legacy app? | `docs/analysis/LEGACY_REUSE_INVENTORY.md` |
| What is the UI direction? | `docs/design/FRONTEND_TEMPLATE.md` |
| What is the original corpus? | `docs/core/` — the SRS, Master Plan, Jira epics, setup workflow and agentic prompt pack. **There is no `docs/archive/corpus/`; it was never created.** |

---

## 13. What NOT to do

- **Do not build tenancy-scoping machinery.** See §2.1. This is the single most likely wrong turn, because the legacy codebase is full of it and it looks like a good pattern.
- **Do not port legacy code that is not on the reuse whitelist.** See §5.
- **Do not add a route without all three guards.** CI must fail on a missing `@RequirePermission`.
- **Do not write directly to `journal_entries` or `audit_records`.**
- **Do not create a second attendance, stock, booking, approval, document or notification engine.** See §2.9.
- **Do not fork BookShop/Canteen logic per operator model**, and do not give vendors more than their own outlet and the minimum student data.
- **Do not use `float` for money.**
- **Do not call `Date.now()`/`new Date()` in domain or use-case code.**
- **Do not hardcode user-facing strings, providers, currencies, tax rules, or school-specific values.**
- **Do not auto-submit purchase orders, publish AI output, or let the chatbot write without human approval.**
- **Do not ship a screen that works only in one theme, one language, or left-to-right only.**
- **Do not renumber `PLT-*` IDs.**
- **Do not treat the corpus figures as a build order without running the extraction first.** `AGENTS.md` §6 is the requirements baseline; the working extraction target is `docs/idea-bank/`.
- **Do not implement real Google/Microsoft/Apple/Facebook OAuth** without confirming which client credentials and redirect URIs are configured for the current environment — these differ between local, staging and production.
- **Do not add a new top-level module** without checking `docs/idea-bank/module-inventory.md` and Master Plan §5 — it may already be scoped.

---

## 14. Commands

Confirm against `package.json` / `turbo.json` once scaffolded — this is the expected baseline.

```bash
pnpm install
docker-compose -f infra/docker/docker-compose.yml up -d     # Postgres + Redis
pnpm --filter web dev && pnpm --filter api dev              # mobile: milestone 2
pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build
pnpm test:integration && pnpm test:e2e
pnpm --filter api migration:generate --name <name> && pnpm --filter api migration:run
```

---

*This file is the contract. It is read before any code change. If it conflicts with a comment in code, this file wins — flag the conflict rather than guessing. Update it whenever a structural or architectural convention changes; stale `AGENTS.md` content is a bug.*
