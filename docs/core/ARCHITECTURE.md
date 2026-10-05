# ARCHITECTURE — EduFlow

**Status:** Contract. Normative.
**Last updated:** 2026-10-05
**Precedence:** `AGENTS.md` and `docs/adr/ADR-003-*` > this document > all other architecture prose.
**Implementation state:** milestone 1 in progress — `PLT-101` and `PLT-107` are shipped (5 routes, 16 Prisma models, 3 enforcing guards), `PLT-EPIC-02` is ~75% built, and 9 of the 12 API module directories are still empty scaffolds. This document specifies what the code **must** satisfy so the first module does not set a precedent that later modules inherit.

> ⚠️ **§17 is not yet fully true of itself.** Nine of the twenty-five rows in *Where Each Rule Is Enforced* name scripts, hooks or CI that **do not exist**, and two describe checks `scripts/check-route-guards.mjs` demonstrably does not implement. By this document's own standard at the close of §17 — *"A rule that is not mechanically enforced is a suggestion"* — those rows are suggestions presented as enforced. Each is being closed under `OPS-08` / `SEC-11x` in `docs/work/TODO.md`. **Read §17 as intent, not as current state.**

---

## 1. The One-Paragraph Version

A **single-tenant** school ERP: one Next.js web app, one NestJS API, one PostgreSQL database and one deployment **per school**. Clean Architecture with dependencies flowing inward — presentation → application → domain ← infrastructure. Domain and use-case code imports **no framework**. Every request passes three fail-closed guards (permission, entitlement, audit). Money is integer minor units. Time comes from an injected `IClock`. All seven concerns that could plausibly be built twice (attendance, stock, booking, approval, documents, notifications, ledger) are built **once**, as a shared engine, and extended by implementing an interface.

---

## 2. Layer Dependency Rule

```
Presentation (controllers, pages)
        ↓
Application (use-cases)
        ↓
Domain (entities, value objects, ports) ← Infrastructure (adapters)
```

**The rule, stated as a test:** a file under `domain/` or `use-cases/` may not import `@nestjs/*`, Prisma, BullMQ, any UI library, or any vendor SDK. Enforce with an ESLint `no-restricted-imports` rule scoped by path — see `ARC-03`.

| Layer | May import | May **not** import |
|---|---|---|
| `domain/entities` | other domain files, `shared-types` | anything framework |
| `domain/services` (rule engines) | domain files, `IClock` | adapters, repositories-with-implementations |
| `domain/ports` | nothing but types | everything |
| `use-cases` | domain, ports | adapter implementations, Prisma, NestJS decorators |
| `infrastructure/adapters` | vendor SDKs, ports | domain rules |
| `infrastructure/postgres` | Prisma, ports, domain types | — |
| `controllers` | use-cases, DTOs, guards | Prisma, domain rule logic |
| `apps/web/src/features/*` | `ui-kit`, `i18n-resources`, `shared-types`, API client | server-only code, `api` internals |

**Enforcement is mechanical, not cultural.** A rule in `packages/config` (`REPO-04`) fails the build on a violation. An unenforced convention is a suggestion.

---

## 3. Module Anatomy

Every module, in both `apps/api` and `apps/web`, is one folder holding its whole vertical slice:

```
apps/api/src/modules/<module>/
  controllers/            # routes + @RequirePermission / @RequireEntitlement / @Audited
  use-cases/              # application layer — orchestrates domain + ports, no framework
  domain/
    entities/             # pure domain
    repositories/         # interfaces (ports), no implementations
    services/             # rule engines (promotion, accrual, posting, conflict…)
    ports/                # adapter interfaces
  infrastructure/
    postgres/             # Prisma implementations of the repository ports
    adapters/             # vendor/hardware adapters
  dto/                    # Zod schemas
```

```
apps/web/src/features/<module>/
  pages/  components/  hooks/  services/  schemas/  types/  i18n/  permissions/
```

**Rules:**
- Root-level `components/` and `hooks/` are for **genuinely shared** code only. If it is used by exactly one module, it lives in that module.
- A `.tsx` approaching ~300 lines, or mixing fetch and render, is split. A component renders **or** fetches — not both.
- A module never imports another module's `infrastructure/`. Cross-module collaboration goes through a domain port or an event.

---

## 4. The Four Guards — Fail-Closed, Always

Every route. All three where applicable. None optional.

| Guard | Decorator | Enforces |
|---|---|---|
| Permission | `@RequirePermission('<PERMISSION_KEY>')` | The user's role grants this action |
| Entitlement | `@RequireEntitlement('<feature_key>')` | The school's licence includes this feature |
| Audit | `@Audited('<ACTION_KEY>')` | The action is recorded, append-only |
| **Public** | **`@Public('<reason>')`** | **The only exemption from `@RequirePermission`. The reason is mandatory** |

- **A route with neither `@RequirePermission(...)` nor `@Public('<reason>')` is a defect.** The CI static check accepts either and rejects everything else. Fail-closed, never fail-open.
- **Every `@Public` use is listed in a checked-in allowlist with its justification**, enforced in both directions, so exemptions are **reviewable rather than invisible** (`ADR-018`).
- Legitimate exemptions are few and knowable in advance: health probes, metrics scraping, login, and licence activation — the last two are unauthenticated by necessity, because a locked-out user has no session and activation is how a school obtains a licence.
- **A missing escape hatch would be worse than a documented one.** Without `@Public`, exemptions get built as fake permission keys, commented-out guards or `skipAuth` booleans — all invisible to the check, and a fake key can even be granted to a role. `ADR-018` exists so that does not happen.
- `@Public` is rejected on a feature-gated route (a route that skips permission resolution has no resolved entitlement) and on a route declaring entity-scoped ownership (there is no actor to own anything).
- `@RequireEntitlement` is required on any feature-gated capability so a Basic-edition school cannot reach Deluxe functionality **by calling the API directly**. Hiding a menu item is not enforcement.
- `@Audited` is required on: finance, grades, permissions, attendance overrides, leave approvals, document issuance, GL postings, hall-booking overrides, wallet movements.
- **The frontend gate is UX only.** It is never the security boundary.

### 4.1 Ownership policies (`IOwnershipPolicy`)

Roles alone are insufficient. A teacher holds `GRADE_ENTER` but only for **their** classes; a parent holds `CHILD_VIEW` but only for **their** children; a vendor holds `SALE_CREATE` but only for **their** outlet.

- Role-denial and ownership-denial return 403 but are **distinguishable in logs**.
- Policies are pluggable: adding a new entity type's rule does not touch the core guard.
- The permission matrix (`ARC-05`) is seeded in Sprint 1 and is a **living fixture** — every new route adds a row in the same commit.

### 4.2 Proving the negative

Security is demonstrated by what **cannot** happen, not by what can. These are mandatory integration tests, not optional:

- Teacher A cannot edit teacher B's class grades, even holding `GRADE_ENTER`.
- A parent's session cannot read another family's child.
- A vendor cannot read beyond its own outlet.
- A Basic-edition school cannot reach a Deluxe route by direct API call.
- A chatbot query cannot read data outside the asking user's RBAC scope.

---

## 5. Single-Tenant — and a Worked Counter-Example

**The model:** one PostgreSQL database, one deployment, per school. Data isolation is **physical**: a missing `WHERE` clause cannot leak across schools, because no other school's rows exist in that database.

`schoolId` is carried on school-scoped entities for **auditability, licence portability and future flexibility**. It is **metadata, not a security control**. Uniqueness constraints are scoped within a school's database and are never assumed global.

### 5.1 The rejected design, in detail

The legacy app at `EduFlowV3\EduFlowV3\eduflow\` is a multi-tenant SaaS. It defends isolation with:

1. `lib/prisma-tenant-extension.ts` — a Prisma client extension injecting `schoolId` into every query
2. `tenant-context.ts` — ambient AsyncLocalStorage tenant context
3. Scoping columns on ~35 of its 59 models
4. 14 global `@unique` constraints that assume a shared database
5. 149 `$queryRaw`/`$executeRaw` call sites, each one a place the extension does not apply

**Why every one of those is wrong here:** each defends against a threat that does not exist in a single-tenant deployment, and each is a **new surface that can be bypassed**. A Prisma client extension is bypassed by raw SQL — and there are 149 raw-SQL sites. An ambient context is bypassed by any code path that does not thread it. A global `@unique` constraint is *wrong*, not merely redundant, because two schools in one database may legitimately hold the same value.

**There is no threat behind any of it.** The most likely wrong turn in this project is copying these patterns because the legacy codebase is full of them and they look like good practice. `prisma-tenant-extension.ts` is on the do-not-reuse list (`AGENTS.md` §5.2). Do not restore it.

**The one thing worth keeping:** the *habit* of asking "what is the blast radius if this is wrong?" — applied here it produces "none, because there is no other school's data here", and the correct response is to delete the machinery rather than harden it.

### 5.2 What is explicitly forbidden

- ❌ `schoolId`-scoped query extensions, ambient tenant context, cross-tenant guards, row-level-security dependency for isolation
- ❌ A `SUPER_ADMIN` cross-tenant role. The highest role is an in-school administrator
- ❌ Cross-school aggregate queries against the product database. That is a separate analytical store, out of scope
- ❌ `if (schoolId === ...)` branches and ad hoc feature flags. Capability gating goes through the licence/entitlement engine only
- ✅ `schoolId` as a column: yes. As a security control: no.

---

## 6. The Shared Engines — One Per Concern

**Never build a second engine for something that already has one. Extend it.** Creating a parallel concept under a new name is the most common way this codebase drifts; check this table before creating any entity, enum, interface or engine.

| Concern | The one engine | Covers | Never |
|---|---|---|---|
| **Attendance** | `AttendanceRecord` (actor-agnostic) + `IAttendanceCaptureAdapter` | student, teacher, staff; transport, hostel, club and video-session presence as **contexts/sources** | a second attendance model |
| **Stock** | shared stock engine, ledger-style movements | asset consumables, **BookShop**, **Canteen** | a bare `stock_on_hand` field; per-outlet stock models (Library circulation is its own domain) |
| **Facility booking** | `IFacilityBookingAdapter` | pool, courts, grounds, IT lab, **School Hall** | per-facility booking tables |
| **Approvals** | `IApprovalWorkflow` | leave, gate passes, facility/hall hire, prefect appointments, certificates, wallet refunds, ticket escalation | per-module approval chains |
| **Documents** | Document/Print engine, versioned templates | ID cards, certificates, report cards (A4/A5/CR80), receipts, hire agreements, settlement statements | per-document PDF pipelines |
| **Notifications** | `INotificationChannelAdapter` router | every alert and message | one-off integrations inside a module |
| **Ledger** | `ILedgerPostingRule` | all money | direct journal writes |

**Version pinning:** issued documents keep the template version they were issued with. A template change never alters a past document.

**Open/Closed in practice:** adding a capability means implementing an existing interface — a new `ILedgerPostingRule`, a new `IConcessionSettlementStrategy`, a new payment adapter — never editing the core engine.

---

## 7. Money

- **Integer minor units**, e.g. `amount_minor: bigint`, with an **explicit currency code**. Never `float`/`number` with implicit rounding.
- A journal entry whose debits and credits do not sum equal is **rejected in the domain layer, before it reaches the database**. This invariant has a dedicated unit test and must never be weakened.
- **Rounding mode and minor-unit scale are a per-school setting**, read from school configuration. Never hard-coded.
- No provider, country tax rule, currency or payment gateway is hard-coded in a use-case, entity or DTO. Provider selection belongs in `infrastructure/adapters/`; rates and currency come from school settings.

**Operator-model accounting** (§2.6): `SCHOOL_RUN` outlets post gross sales + cost of goods; `THIRD_PARTY` outlets post only rent/commission. Hall damage deposits post to a *Deposits Held* liability. Student Wallet balances are a liability. Period close is a **soft** close — warn on backdated postings; hard-lock is a later Enterprise control.

---

## 8. Time

Domain and use-case code **must never** call `Date.now()` or `new Date()`. Inject `IClock`. Required for deterministic tests of accrual, licence expiry, deadlines and hold expiry.

Enforced by a static check (`ARC-03`): a `Date.now()` or `new Date()` in `domain/` or `use-cases/` fails the build.

**Storage:** UTC. **Edges:** school timezone. **"Now":** `IClock`. A school's timezone, currency, language and academic calendar are never hard-coded — read from school settings.

---

## 9. Audit Records Are Append-Only

- The audit repository exposes only `create()` and `query()`. **There is no `update()` or `delete()` — and no `delete` on the interface means no code path can call one.**
- No raw SQL that mutates `audit_records`.
- **Database-level too:** revoke `UPDATE`/`DELETE` grants on the audit table from the application role. Defence in depth, not convention.

### 9.1 Durability — same transaction, not a queue

**Sensitive-action audit rows are written in the same database transaction as the business change** (`ADR-013`).

- One transaction covers both the domain write and the audit insert. **Either both commit or neither does.** A committed business change always has its audit row.
- Queuing remains correct for **non-critical, high-volume events** — cases where losing the record is acceptable and per-event transactions are undesirable.
- No mail and no vendor call happens inside the transaction.

This **overrides** the Jira document's `PLT-402` wording ("asynchronously, via queue"), which would allow a committed financial or disciplinary action with **no audit record at all** if the queue were unavailable. A record that exists to answer *"did this happen, and who did it"* cannot be written probabilistically. `ADR-017` records the deviation.

The port therefore takes a transaction context — which changes its **signature**, not its shape. It is still create-only:

```ts
create(record: AuditRecord, tx: TransactionContext): Promise<void>
```

### 9.2 What is audited

Login success · login failure · lockout · logout and session revocation · refresh-reuse detection · password reset request and confirm · role change and forced logout · every sensitive action in `AGENTS.md` §2.3.

Epic 01 defines the `IAuditRecorder` **port** with an interim adapter; the real audit store arrives later and **retrofits every auth event** (`ADR-017` deviation ④). The retrofit is a named deliverable with its own human gate, not a nice-to-have — if it is skipped, auth events are unaudited.

---

## 10. Adapters — Where Vendors Live

Vendor and hardware integrations sit behind interfaces. **A use-case or domain file never calls a vendor SDK.**

| Port | Implementations |
|---|---|
| `IBellHardwareAdapter` | bell control hardware |
| `IWhatsAppAdapter` | Vvaslution API |
| `ISmsAdapter` | **provider deliberately undecided — must stay vendor-agnostic and replaceable without touching domain or use-case code** |
| `IVideoConferenceAdapter` | Zoom / Google Meet / Jitsi |
| `IAttendanceCaptureAdapter` | manual / QR / biometric / RFID / geo-fenced |
| `IStorageAdapter` | AWS S3 / Cloudflare R2 / MinIO |
| `INotificationChannelAdapter` | Email (default) / SMS / WhatsApp / Push |
| `IPaymentGatewayAdapter` | per-school configured gateway |
| `IFacilityBookingAdapter` | facility registry + rate cards |

**Notification routing** resolves the channel from the user's preference, defaulting to **email**. SMS and WhatsApp are **per-message billed**, so they require per-recipient rate limiting and digesting. Push is free; email is comparatively cheap. **Emergency alerts bypass digesting.**

**Offline-first where connectivity is unreliable:** attendance kiosk, outlet POS and teacher attendance capture are **local-first** — queue locally, sync when connected, resolve conflicts through an admin-review queue. Not "online with an offline fallback bolted on". (Applies as those modules are built; mobile is milestone 2.)

---

## 11. Human-in-the-Loop for Automation and AI

AI timetables, substitution proposals, AI report-card comments, lesson plans and auto-generated purchase orders are **drafts until a person approves them**.

- The AI chatbot never performs a write without explicit user confirmation.
- It is scoped to the asking user's RBAC permissions.
- It answers policy questions **only** from retrieved school documents, and falls back to opening a Helpdesk ticket when unsure.
- Auto-generated purchase orders are **always drafts** that a person approves.
- Hall/facility: an internal event may pre-empt only a **tentative** hold. Displacing a **confirmed** booking requires an audited Admin override with a reason.

---

## 12. Privacy and Child Safety

- Biometric templates are stored as **irreversible hashes** and **never logged**.
- Alumni data is **consent-based**; alumni are no longer minors and fall outside the child-safeguarding model.
- Mentorship is **school-mediated**, never direct alumni-to-minor.
- Logs redact passwords, tokens, card data, secrets and biometric templates.
- Vendors are **data-minimised**: scoped to their own outlet, receiving a student token plus the minimum flags needed to serve them (e.g. allergy alert) — never a full student profile. Every vendor lookup is logged.
- Canteen allergy flags are shown at POS; overriding one is an explicit, logged staff action. The system **supports but never guarantees** allergen safety, and depends on parent-entered data.
- Student Wallet is optional, a GL liability, and **must not be enabled without legal review** of stored-value rules in the jurisdiction.

---

## 13. Settings Is a First-Class Subsystem

Thresholds, toggles, grace periods, rate cards, retention periods, rounding — all in settings, **never constants**.

All consuming modules read settings through **one shared service**. No module hard-codes a school-specific value.

**Default every screen to the simplest view for the school's licensed modules.** Hide unused menus and fields; do not delete advanced options.

---

## 13a. Configuration Is Validated at the Process Edge

`AGENTS.md` §11: *"Start-up must fail fast naming the missing variable; no silent defaults."*

Configuration is validated by a Zod schema at the **process edge**, in `apps/api/src/config/env.ts`, **before** the Nest application is constructed — so an invalid environment fails with a readable message rather than a dependency-injection error twenty frames deep. Every invalid variable is named **in one throw**, not one restart at a time.

**There are three states for `DATABASE_URL`, not two.** A missing variable is neither defaulted nor fatal:

| State | Behaviour |
|---|---|
| **Absent** | `persistence: 'disabled'`. The API boots, prints a loud banner naming what is missing and why that is acceptable *at this stage*, and **constructs no repository at all** |
| **Present but invalid** — not `postgresql://`, still a `<placeholder>`, unparseable | **Throws.** Names every invalid variable at once |
| **Present and valid** | `persistence: 'enabled'` |

A guessed `localhost` URL is the silent default §11 forbids: it converts a two-second fix into an afternoon of debugging a connection error in a file that has nothing to do with configuration. Absence is visible; a convincing default is not. **From P4 the absent case is removed and the variable becomes required** (`ADR-019`).

Nothing is mocked or substituted. PostgreSQL remains the only database (`ADR-003`, and `ADR-002` needs real numerics for money). Docker is one convenient way to supply the variables, not a dependency.

---

## 14. Errors and Logging
Every `ERROR`/`CRITICAL` goes to **both** the rotating structured-JSON file log **and** the DB error log — never one without the other.

- Structured JSON with **correlation IDs**, propagated per request.
- Redaction is global and deny-list driven, covering password fields, `Authorization` headers and token-shaped/card-shaped strings.
- Rotation: **25 MB** active file, **3** historical files.
- The frontend permission gate is UX only; §4 is the boundary.

---

## 15. UI Rules

1. **All primitives are shadcn/ui.** No raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>`. Extend by composition and `className`; never edit generated files under `ui/`.
2. **Responsive, mobile-first.** Sidebar is a `Sheet` drawer on mobile, full sidebar on `lg:`. Tables use horizontal `ScrollArea` or a card layout. Touch targets ≥ 44 px.
3. **No monolithic pages.** Pages compose small section components; ~300 lines or mixed concerns is a split.
4. **Loading:** `<Skeleton>` for async data; buttons `disabled` + spinner while submitting; `loading.tsx` per route.
5. **Light and dark are both required**, one-click toggle. Tokens are CSS variables; **never a hard-coded hex in a component**; never ship a component that works in only one theme. `data-theme` on `<html>` before first paint; honour `prefers-color-scheme` when no choice is saved.
6. **RTL-safe:** logical properties (`ms/me/ps/pe`, `start/end`), mirrored directional icons, Arabic verified on every new screen.
7. **Fonts must cover Tamil, Sinhala and Arabic**, on screen **and** in generated PDFs. Motion ≤ 200 ms and respects `prefers-reduced-motion`.

**No hard-coded user-facing strings** (§2.8). All UI text goes through i18n resource files — English (default), Tamil, Sinhala, Arabic. A literal English string in JSX/TSX is enforced by CI, not left to review. Never ship a silent English fallback in a non-English locale.

---

## 16. The Existing Template — What It Is For

`docs/template/EduFlow — Frontend Template.html` is a **token and RTL-pattern donor only**.

- ✅ **Harvest:** the CSS token set (`--bg --surface --text --muted --border --brand --brand-2 --accent --danger --ok`), the light/dark `data-theme` mechanism, and the *pattern* of setting `dir` on `<html>`.
- ❌ **Do not harvest:** the i18n dictionary. It has **21 keys, all landing-page marketing copy, and zero application keys.** Real i18n content is authored per module.
- ❌ **Do not harvest:** the marketing claims — "Trusted by 200+ schools" and "1.2M Students Managed" are false, and "Start Free Trial" contradicts a per-school deployment sold on editions.
- ❌ **Do not harvest:** the Google / Microsoft / Apple / Facebook login buttons. `AGENTS.md` §13 forbids implementing these without confirmed client credentials and redirect URIs for the current environment.

Assessment and measurements: `docs/design/FRONTEND_TEMPLATE.md`.

---

## 17. Where Each Rule Is Enforced

A rule that is not mechanically enforced is a suggestion. Every rule above has a landing place:

| Rule | Enforced by | Story / ADR |
|---|---|---|
| Layer dependency | ESLint `no-restricted-imports` by path | `REPO-04`, ADR-001 |
| No `Date.now()` **or `Math.random()`** in domain/use-cases | ESLint | `ARC-03`, ADR-004 |
| Every route has `@RequirePermission` **or** `@Public('<reason>')` | `scripts/check-route-guards` (TypeScript AST) | `ARC-04`, **ADR-018** |
| Every `@Public` use is in a checked-in allowlist with a justification | CI, two-way (code ⇒ list and list ⇒ code) | **ADR-018** |
| `@Public` is rejected on a feature-gated route and on entity-scoped ownership routes | `check-route-guards` | **ADR-018** |
| New route ⇒ matrix row | CI check against the `PLT-205` fixture | `ARC-05`, ADR-012 |
| Journal entries balance, in the domain layer, before the DB | Domain unit test | `ARC-06`, ADR-002 |
| Money is integer minor units + explicit currency | Type system + review | ADR-002 |
| Sensitive audit rows share the business transaction | `IAuditRecorder` takes a `TransactionContext` | **ADR-013** |
| `any` needs `// TODO: type this` + ticket; `@ts-ignore` banned outright | ESLint | `REPO-04` |
| No user-facing literal in JSX/TSX | ESLint | `DSN-06` |
| No hard-coded hex in a component | ESLint | `DSN-06` |
| All four locale files have identical key sets | `scripts/check-i18n` | `DSN-02` |
| A PR changing source must change `WORKLOG.md` | `scripts/check-worklog` | `AGENTS.md` §9 |
| Commit message follows Conventional Commits | commit-msg hook | `AGENTS.md` §9 |
| Coverage thresholds | Vitest `coverage.thresholds` per path glob | `OPS-03` |
| No secrets tracked | gitleaks in CI | `OPS-04` |
| Audit table immutable | Postgres `REVOKE UPDATE, DELETE` | `PLT-401` |
| No raw SQL mutating `audit_records` | ESLint restricted pattern | `PLT-401` |
| No module imports an S3 SDK directly | ESLint | `PLT-801`, ADR-015 |
| Metrics labels are redacted and low-cardinality | ESLint + review | ADR-016 |
| Licence signature is over canonical JSON | Domain unit test | **ADR-009** |
| Private signing key never in this repo | Review + test keypair generation | **ADR-009**, ADR-010 |
| Documented paths exist | `docs:verify` script | `OPS-05` |

---

## 18. Explicit Non-Goals

- **No tenancy machinery** (§5). The single most likely wrong turn.
- **No second engine** for any concern in §6.
- **No mobile in milestone 1** (D5).
- **No cross-school reporting.** Multi-school/group console is out of scope (`SRS` §19).
- **No floating-point money.** No hard-coded providers, currencies, tax rules, timezones or school values. No new state-management library, ORM or CSS framework without explicit instruction.

---

*Companion documents: `SSOT.md` (current state and decisions) · `AGENTS.md` (the operating contract) · `docs/adr/` (decisions of record) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (gap analysis and action plan).*
