# AGENTS.md — EduFlow360 (fresh development)

> **Read this before writing any code.** It is the operating contract for this repository.
> **Decided:** September 27, 2026 · **Governing ADR:** `docs/adr/ADR-003-fresh-build-single-tenant.md`
> **Revised:** October 9, 2026 — product renamed **EduFlow360**; fresh build (no legacy code); default **Superadmin** system user; admin console at `http://localhost:3030/admin`; **template-fidelity** rule; School Setup & Academic modules; 70–80% agentic delivery model.
> **Status:** pre-scaffold. No application code exists yet.

**Precedence:** this file and ADR-003 win over every other planning document. Where the Master Plan, SRS or idea-bank disagree with them (for example on tenancy), follow this file and flag the discrepancy.

---

## 1. What this repository is

EduFlow360 is a **school management system / school ERP** being built as a **new application**: web (Next.js), API (NestJS), mobile (Expo, milestone 2). Features are gated by a **digitally signed licence** (Basic / Standard / Deluxe / Enterprise). Languages: **English (default), Tamil, Sinhala, Arabic (RTL)**.

This repository contains the requirements, architecture and delivery plan. The codebase is not yet scaffolded.

**This is a fresh development.** EduFlow360 has **no relationship to any earlier implementation** (including any project named EduFlow360, (removed) or similar). Do not look for, read, copy, port, or import code, schemas, tests or conventions from any other codebase on the developer's machine. Everything is built new from the planning documents and the approved UI templates. See §5.

**Planning documents (current):** `EduFlow360_Project_Master_Plan_v5.3.md` (architecture, module tree, editions, roadmap), `EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md` (FR-xxx requirements, test strategy, MVP, phases), `EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md` (epic/story/AC template). Keep them under `docs/core/`.

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
- **There is no cross-school ("platform") super-user.** The highest role is **`SUPERADMIN`**, which exists *inside* this one school's deployment only. It is seeded as the default system user (§2.16). There is nothing cross-tenant for it to administer.
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

- **A route with no `@RequirePermission` is a defect.** A CI static check must fail on any controller route lacking it. Fail-closed, never fail-open.
- `@RequireEntitlement` is required on any feature-gated capability so a Basic-edition school cannot reach Deluxe functionality by calling the API directly.
- `@Audited` is required on every sensitive action: finance, grades, permissions, attendance overrides, leave approvals, document issuance, GL postings, hall-booking overrides, wallet movements.
- **Ownership policies are enforced, not just roles** (`IOwnershipPolicy`): teacher → own classes, parent → own children, vendor → own outlet. Role-denial and ownership-denial are distinguishable in logs.
- The frontend permission gate is **UX only**. It is never the security boundary.
- No module ships without auth and RBAC wired in from its first commit. There is no "secure it later" phase.

### 2.4 Time-dependent logic uses `IClock`

Domain and use-case code **must never** call `Date.now()` or `new Date()` directly. Inject `IClock`. Required for deterministic tests of accrual, licence expiry, deadlines and hold expiry.

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

**Start from the approved templates (§2.17).** `docs/template/EduFlow360_Template_Landing_Auth.html` already contains a complete `en`/`ta`/`si`/`ar` dictionary, a working RTL implementation (`html[dir="rtl"]` rules plus a runtime `dir` attribute) and the light/dark token set. Move the dictionary into `packages/i18n-resources/` and the tokens into `packages/ui-kit` **without changing any value or wording**. Placeholder marketing copy in the templates is reproduced as-is and flagged as *owner decision pending* (§2.17 rule 6).

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

### 2.16 Default system user: `superadmin`

This is a **single-tenant** application, so every fresh deployment starts with exactly one built-in **system user**:

| Property | Value |
|---|---|
| Username | `superadmin` (immutable) |
| Role | `SUPERADMIN` — immutable system role holding every permission |
| Flags | `isSystemUser = true`, `mustChangePassword = true` |
| Created by | Idempotent seed (`pnpm --filter api db:seed`), also run automatically on first boot in dev |
| Initial password | Read from `SEED_SUPERADMIN_PASSWORD` in the git-ignored `.env`. If unset **in development only**, a random password is generated and printed to the console **once**. In staging/production the seed **fails fast** if it is unset. |

Rules:
- **No password is ever written in a tracked file, test fixture (use generated values), log, or audit payload.** `.env.example` holds a placeholder only.
- First login **must** force a password change (reuse the reset flow). Until changed, the session may call only the change-password endpoint.
- `superadmin` cannot be deleted, renamed, or have its role changed; it cannot be disabled while it is the last active `SUPERADMIN`. Enforce server-side and test it.
- The seed is idempotent: running it again never creates a second user and **never resets an existing password**.
- Every use is audited (`LOGIN_*`, `PASSWORD_CHANGED`, any permission or settings change). `SUPERADMIN` actions are not exempt from `@Audited`.
- `SUPERADMIN` may create `SCHOOL_ADMIN` and other users; day-to-day work should use named accounts, and the school is advised to keep `superadmin` for break-glass use.
- Never implement a "backdoor" bypass of guards for `superadmin`: it passes the same guards as everyone, because it holds all permissions.

### 2.17 Template fidelity (use the UI templates as they are)

The approved HTML templates are the **visual source of truth**:

| Template | Contents |
|---|---|
| `docs/template/EduFlow360_Template_Landing_Auth.html` | Landing page (animated hero), theme toggle, language switcher (EN/TA/SI/AR + RTL), login, forgot password, reset password |
| `docs/template/EduFlow360_Template_Admin_Dashboard.html` | Admin app shell (collapsible left menu with submenus, top bar), School Dashboard, Settings-style tabbed form pattern |

**Rules (hard):**
1. **Do not modify the template files.** They are read-only reference artefacts. Only the owner changes them, and only by explicit instruction recorded in `docs/work/WORKLOG.md` (as "Template change authorised by owner").
2. **Reproduce them as they are** in the Next.js app: same layout, structure, spacing, colours (CSS tokens), typography, iconography, copy, animations, light/dark behaviour, RTL behaviour and responsive breakpoints. Do **not** "improve", re-style, rename, re-order, re-colour or simplify anything.
3. **What you may change without asking:** replace demo *behaviour* with real behaviour — the template's client-side demo lockout, demo credentials, fake social buttons and static numbers are demo logic, not design. Wire real services behind the same markup. Keep the markup/visual output identical.
4. **Screens that do not exist in the templates** (e.g. School Setup tabs, Academic screens) must be composed **only from the templates' existing tokens, components and patterns** (cards, tabs, tables/rows, form fields, buttons, pills, toggles, progress bars). Do not invent a new visual language. Show a screenshot to the owner and get approval before merging a new screen pattern.
5. If a template cannot be reproduced exactly (a technical limitation), **stop and ask**; record the deviation and the owner's decision.
6. **Placeholder copy** in the templates (e.g. marketing numbers such as "200+ schools", "1.2M students", "Start Free Trial") is reproduced as-is and flagged in `docs/work/TODO.md` as *owner decision pending*. Do not silently rewrite it.
7. Visual regression tests (Playwright screenshot comparison against the template, both themes, LTR and RTL) are part of the Definition of Done for every templated screen.
8. shadcn/ui primitives are allowed and preferred **where they can be styled to match the template exactly**. Template fidelity wins over shadcn defaults.

### 2.18 Dev server, ports and the admin console

| Item | Value |
|---|---|
| Web dev server | **`http://localhost:3030`** (port **3030**; `next dev -p 3030`, `next start -p 3030`) |
| **Admin console** | **`http://localhost:3030/admin`** |
| Public pages | `/` landing · `/login` · `/forgot-password` · `/reset-password` |
| API dev server | `http://localhost:3031` (assumption — change in `.env` if needed; never hard-code) |

- Ports come from `WEB_PORT` / `API_PORT` in `.env` with these defaults; scripts, CORS, Playwright `baseURL`, e-mail links and OAuth redirect URIs must all derive from them.
- `/admin` and everything beneath it require authentication **and** the `ADMIN_CONSOLE_ACCESS` permission. Unauthenticated → redirect to `/login?next=/admin`; authenticated but unauthorised → 403 page.
- Admin routes: `/admin` (dashboard) · `/admin/school-setup` (tabs `?tab=general|system|holidays|event-categories|houses|scheduler`) · `/admin/academic/<screen>` · `/admin/settings/...`.

### 2.19 School Setup & Academic terminology (avoid collisions)

The owner's UI labels are authoritative for users; use **distinct domain names** in code:

| UI label | Domain name | Notes |
|---|---|---|
| Academic Sections (Academic Level) | `AcademicLevel` | KG, Primary, Secondary… (was "Education Stage" in earlier plans). Holds the class schedule and break configuration. |
| Section | `Section` | A, B, C… class division |
| Grade | `Grade` | belongs to one `AcademicLevel` |
| Class | `SchoolClass` | Grade + Section + Medium + Syllabus (+ Academic Year) — avoid the bare identifier `class` |
| Class Medium | `ClassMedium` | language of instruction |
| Academic Calendar | `AcademicYear` | |
| Terms Management | `AcademicTerm` | term / semester / quarter |

Configuration entities are **singletons** (School Profile, System Configuration, Scheduler Constraints) or **lists with soft-delete/deactivate** (everything else). Never hard-delete a record that other records reference.

---

## 3. Repository structure

Scaffold **both** trees in full before writing logic in a new module.

```
eduflow360/
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
| Web | Next.js, React, TypeScript (strict), Tailwind CSS, shadcn/ui — UI only; the API is a separate service (no server actions). Dev port **3030**, admin at `/admin` |
| API | NestJS, Prisma, Zod |
| Database | PostgreSQL, one per school |
| Cache / queue | Redis + BullMQ |
| Storage | S3-compatible behind `IStorageAdapter` |
| Mobile | React Native + Expo (milestone 2) |
| i18n | per Master Plan §2.1 (`next-intl`/`react-i18next` web, `i18next` mobile) — confirm before adding |
| Documents | headless Chromium or PDFKit/Handlebars, locale-aware font embedding |
| Testing | Jest, React Testing Library, Playwright (web), Detox (mobile) |

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
| E2E | `pnpm test:e2e` | Playwright (web) / Detox (mobile) |

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

## 5. Fresh build — no legacy code

EduFlow360 is **new development**. There is no legacy implementation to reuse and none must be consulted.

- **Never** import, copy or "port" code, schemas, migrations, tests, scripts, assets or conventions from any other project. If you recall patterns from other repositories (tenant scoping, global unique constraints, raw SQL repositories, server actions), do not apply them here — the rules in §2 are the whole specification.
- Re-derive everything from: this file, the planning documents (§0), the requirements baseline (§6) and the approved UI templates (§2.17).
- Third-party open-source libraries are allowed through normal package management (checked against the tech-stack table, §3.1).
- If you believe code from elsewhere is needed, **stop and ask**; the owner decides and records it in an ADR.

---

## 6. Requirements baseline

The authoritative requirements are in `docs/idea-bank/`, extracted from the archived planning corpus:

| File | Contents |
|---|---|
| `module-inventory.md` | 139 modules across 20 domains, with priority and required entities |
| `business-rules.md` | 257 rules with source citations and edge cases |
| `domain-entities.md` | 35 entities, field definitions, constraints, `schoolId`/money flags |
| `edge-cases-and-risks.md` | 15 risks, 40 boundary tests, 41 failure modes, test standards, known gaps |
| `fr-index.md` | 73 FRs + 9 NFRs, MVP in/out, traceability |

**Read the relevant idea-bank section before implementing any module.** **Before creating any entity, enum, interface or engine, check `docs/core/SSOT.md`, the idea-bank and §2.9 for an existing equivalent** — creating a parallel concept under a new name is the most common way this codebase drifts.

### 6.1 Known requirements gaps — resolve before building these

These are **blocking**. The corpus does not contain the design.

| Gap | Blocks | Ticket |
|---|---|---|
| **Attendance** — no design at all | Attendance module | `PC-000` |
| **Leave / Workforce** — no design at all | Workforce, leave accrual | `PC-001` |
| **Grading & Moderation** — P0, zero rules | Exams, report cards, promotion, analytics | `PC-002` |
| **Tax & currency** — never mentioned, despite invoicing | Fees, payroll, procurement | `PC-003` |
| **Admission** — in MVP list, no FR behind it | MVP scope | `PC-004` |
| **BookShop, Canteen, School Hall rental** — specified in Master Plan v5.3 §17.6–17.9 (newer than the idea-bank extraction); needs FR/rule/entity extraction and settlement design | Retail outlets, hall rental | `PC-005` *(proposed — not yet ticketed)* |
| **Student Wallet** — stored-value legal review and GL design | Wallet | `PC-006` *(proposed — not yet ticketed)* |

---

## 7. Delivery plan

**Milestone 1 — Platform Core & RBAC + Admin Console:** `PLT-EPIC-01` … `PLT-EPIC-10` (39 stories, 233 points — see `docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md`). **Milestone 2 — School Setup & Academic Setup:** `SET-EPIC-00` … `SET-EPIC-06`, `HRM-EPIC-01` (minimal teacher directory), `ACD-EPIC-01` … `ACD-EPIC-08` — 54 stories, 269 points — see `docs/core/EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md`. (Mobile is a later milestone.)

Epic and story IDs are taken unchanged from the corpus and are the traceability backbone. **Do not renumber them.**

| Epic | Name | Pts |
|---|---|---|
| `PLT-EPIC-01` | Authentication & Session Management (incl. default `superadmin` seed, PLT-107) | 39 |
| `PLT-EPIC-02` | Dynamic RBAC & Policy Engine | 42 |
| `PLT-EPIC-03` | Licensing & Entitlement Enforcement | 29 |
| `PLT-EPIC-04` | Immutable Audit Logging System | 21 |
| `PLT-EPIC-05` | Error & Diagnostic Logging Engine | 18 |
| `PLT-EPIC-06` | Dynamic Module Registry & System Settings | 16 |
| `PLT-EPIC-07` | Multi-Channel Notification Router | 13 |
| `PLT-EPIC-08` | Storage & File Manager | 13 |
| `PLT-EPIC-09` | System Health & Monitoring | 13 |
| `PLT-EPIC-10` | Admin Console Shell, Template Port & Dev Environment (port 3030) | 29 |

**Critical path:** `PLT-EPIC-01` → `PLT-EPIC-02` → `PLT-EPIC-03` → `PLT-EPIC-04`. Every later module assumes these decorators exist and work.

**Decided scope:** licensing ships in milestone 1 (D4). **`apps/mobile` is deferred** (D5) — `PLT-104`, `PLT-106` and the push half of `PLT-702` move with it. The first business MVP is a **reduced vertical slice**: School Setup → Academic Setup → enrolment → class assignment → attendance → fee invoice → GL posting → receipt. **Default system user `superadmin` (PLT-107) replaces the earlier "bootstrap token" idea.**

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
WEB_PORT="3030"
API_PORT="3031"
WEB_BASE_URL="http://localhost:3030"
API_BASE_URL="http://localhost:3031"
SEED_SUPERADMIN_PASSWORD="<set a strong value in the git-ignored .env; never commit>"
STORAGE_ENDPOINT="<s3-compatible endpoint>"
# OAuth client IDs/secrets, payment, WhatsApp/SMS/email and video providers: see docs/core
```

**Never put a real credential — or a real-looking example — in any tracked file.** Start-up must fail fast naming the missing variable; no silent defaults.

---

## 12. Where to look

| Question | Answer lives in |
|---|---|
| What are we building, and why this way? | `docs/adr/ADR-003-fresh-build-single-tenant.md` |
| What is the current state of the project? | `docs/core/SSOT.md` |
| How is it architected? | `docs/core/ARCHITECTURE.md`, Master Plan v5.3 §5 |
| What are the exact business rules? | `docs/idea-bank/business-rules.md` |
| What entities and fields exist? | `docs/idea-bank/domain-entities.md` |
| What is in the MVP? | `docs/idea-bank/fr-index.md`, SRS v1.3 Part D |
| BookShop / Canteen / Hall / newer requirements? | Master Plan v5.3 §17; SRS v1.3 FR-RET / FR-CAN / FR-BKS / FR-FAC / FR-WAL |
| What are we building first? | `docs/work/PLATFORM_CORE_PLAN.md` |
| How do I write epics/stories? | `EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md` |
| What is the next task? | `docs/work/TODO.md` |
| What was decided and why? | `docs/adr/` |
| What is the UI direction? | `docs/template/*.html` (read-only, §2.17) and `docs/design/FRONTEND_TEMPLATE.md` |
| School Setup / Academic field-level spec? | Master Plan v5.3 §5A–5B; SRS v1.3 FR-SET / FR-ACD; `EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md` |
| What is the original corpus? | `docs/archive/corpus/` (historical) |

---

## 13. What NOT to do

- **Do not build tenancy-scoping machinery.** See §2.1. This is a common wrong turn because multi-tenant patterns look like good practice; here they are unnecessary and harmful.
- **Do not use, read or port code from any other project.** This is a fresh build. See §5.
- **Do not modify the UI templates**, restyle them, or "improve" them. See §2.17.
- **Do not create a second default/system user, a backdoor, or a hard-coded password.** See §2.16.
- **Do not hard-code ports or URLs.** Web `3030`, admin at `/admin`, API `3031` come from configuration. See §2.18.
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
- **Do not treat `docs/archive/corpus/` as a build order.** It is a historical reference. The working requirements are in `docs/idea-bank/`.
- **Do not implement real Google/Microsoft/Apple/Facebook OAuth** without confirming which client credentials and redirect URIs are configured for the current environment — these differ between local, staging and production.
- **Do not add a new top-level module** without checking `docs/idea-bank/module-inventory.md` and Master Plan §5 — it may already be scoped.

---

## 14. Commands

Confirm against `package.json` / `turbo.json` once scaffolded — this is the expected baseline.

```bash
pnpm install
docker-compose -f infra/docker/docker-compose.yml up -d     # Postgres + Redis
pnpm --filter api db:seed                                   # creates default 'superadmin' (idempotent)
pnpm --filter web dev        # http://localhost:3030  (admin: /admin)
pnpm --filter api dev        # http://localhost:3031  (mobile: later milestone)
pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build
pnpm test:integration && pnpm test:e2e
pnpm --filter api migration:generate --name <name> && pnpm --filter api migration:run
```

---

---

## 15. Agentic delivery model (70–80% of the code is agent-written)

Roughly **70–80% of implementation is done by AI agents**; humans decide, review, verify and operate. The Jira plans tag every sub-task: 🤖 agent-led · 🤝 paired (agent drafts, human decides) · 👤 human-led.

**Agent-ready story contract (Definition of Ready):** a story is only handed to an agent when it has (1) a one-paragraph goal, (2) numbered acceptance criteria, (3) the ports/interfaces involved, (4) the template screen or pattern to reproduce (if UI), (5) the permission keys, audit action keys and i18n namespaces, (6) any open decision marked *owner decision pending*. Otherwise the agent must ask — never guess.

**Per-story loop:** plan (read-only) → owner/lead approves plan for risky stories → RED → GREEN → REFACTOR → gates → fresh-session reviewer → human gate → merge. One story per session; the repo, `WORKLOG.md` and `TODO.md` are the memory, not the chat.

**Humans always own:** product and policy decisions; the permission matrix; security and authorization review; licence keys and secrets; production infrastructure; legal/compliance (wallet, e-invoicing, data protection); template changes; UAT and sign-off; anything marked ⚠ Provisional.

**Agent guardrails:** no scope creep; never weaken a test to pass; never edit `AGENTS.md`, ADRs, or template files without explicit owner instruction; stop and ask on ambiguity; report deviations honestly in the worklog.

**Reviewer independence:** the session that wrote the code never approves it — run the review prompt in a fresh session (Prompt Pack §4.3).

---

*This file is the contract. It is read before any code change. If it conflicts with a comment in code, this file wins — flag the conflict rather than guessing. Update it whenever a structural or architectural convention changes; stale `AGENTS.md` content is a bug.*
