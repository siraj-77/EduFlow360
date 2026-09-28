# EduFlow — Jira/Epic-Style Action Plan
## Module: Platform Core & RBAC (Master Plan §5 "PLATFORM" / SRS §3.1)

**Project Key:** `PLT`
**Sprint Assumption:** 2-week sprints, story points on Fibonacci scale (1,2,3,5,8,13)
**Source Requirements:** SRS FR-PLT-01 → FR-PLT-08, Master Plan §5 (Platform Core Framework), §4 (Licensing), §6 (Audit/Diagnostics)
**Why this module first:** Every other Master Plan module (Academic, Attendance, Finance, etc.) depends on Auth, RBAC, Licensing, and Audit Logging existing and being stable — this is the dependency root of the whole system (per SRS §16 Day-1 checklist).

---

## Epic Index

| Epic ID | Epic Name | Priority | Est. Points | Sprint Target |
|---|---|---|---|---|
| PLT-EPIC-01 | Authentication & Session Management | P0 | 34 | Sprint 1–2 |
| PLT-EPIC-02 | Dynamic RBAC & Policy Engine | P0 | 42 | Sprint 2–3 |
| PLT-EPIC-03 | Licensing & Entitlement Enforcement | P0 | 29 | Sprint 3 |
| PLT-EPIC-04 | Immutable Audit Logging System | P0 | 21 | Sprint 2 (parallel) |
| PLT-EPIC-05 | Error & Diagnostic Logging Engine | P1 | 18 | Sprint 3 |
| PLT-EPIC-06 | Dynamic Module Registry & System Settings | P0 | 16 | Sprint 2 |
| PLT-EPIC-07 | Multi-Channel Notification Router (Platform-level skeleton) | P1 | 13 | Sprint 4 |
| PLT-EPIC-08 | Storage & File Manager | P1 | 13 | Sprint 3 |
| PLT-EPIC-09 | System Health & Monitoring | P2 | 13 | Sprint 4 |

**Total estimated:** ~199 points ≈ 4 sprints (8 weeks) for a 3–4 backend-engineer team, run in parallel with Frontend/QA as noted per story.

---

## EPIC PLT-EPIC-01: Authentication & Session Management

**Goal:** A user can securely log in, stay logged in appropriately, and be logged out/rotated correctly, across Web and Mobile, for every role in the system.
**Maps to:** FR-PLT-01, FR-PLT-02 | Master Plan §5 "Authentication (JWT, OTP, Sessions, Token Rotation)"
**Definition of Ready:** ERD for `User`, `Session`, `RefreshToken` entities agreed in Phase 0 workshop.
**Definition of Done:** All stories below pass unit + integration tests; security review of token handling completed; works identically on Web and Mobile clients.

### Story PLT-101: JWT Login (Email/Username + Password)
- **As a** registered user (any role) **I want to** log in with my credentials **so that** I can access the system appropriately scoped to my role.
- **Tasks:**
  - [ ] Design `User` entity (id, email/username, password_hash, role_id, status, school_id)
  - [ ] Implement password hashing (bcrypt/argon2) with configurable cost factor
  - [ ] Implement `POST /auth/login` endpoint issuing access token (short-lived, e.g. 15 min) + refresh token (long-lived, e.g. 7 days)
  - [ ] Implement account lockout after N failed attempts (configurable), with cooldown
  - [ ] Frontend: Login form (Web) with validation, error states
  - [ ] Mobile: Login screen reusing shared API client
- **Acceptance Criteria:**
  - Given valid credentials, login returns access + refresh tokens and a 200 response.
  - Given invalid credentials, login returns 401 without leaking whether email or password was wrong.
  - After 5 failed attempts within 10 minutes, account locks for a configurable cooldown period and returns 429.
  - Password is never returned in any API response or logged in plaintext (verify against §6 Logging Rules — password redaction).
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `frontend`, `mobile`, `security`

### Story PLT-102: Token Refresh & Rotation
- **As the** system **I want to** rotate refresh tokens on use **so that** a stolen refresh token has a limited window of exploitability.
- **Tasks:**
  - [ ] Implement `POST /auth/refresh` — validates refresh token, issues new access + refresh token pair, invalidates old refresh token (rotation)
  - [ ] Store refresh-token family/lineage to detect reuse of a revoked token (replay-attack detection)
  - [ ] On detected reuse, revoke entire token family and force re-login
  - [ ] Unit test: expired token rejected; reused-after-rotation token triggers family revocation
- **Acceptance Criteria:**
  - A refresh token can only be used once; reuse invalidates all tokens issued from that login session.
  - Access-token expiry is enforced server-side on every protected route (not just client-trusted).
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `security`

### Story PLT-103: Session Management & Forced Logout
- **As an** Admin **I want to** view and revoke a user's active sessions **so that** I can respond to lost devices or role changes.
- **Tasks:**
  - [ ] `Session` entity tracking device info, IP, last-active timestamp, per login
  - [ ] `GET /users/:id/sessions` and `DELETE /users/:id/sessions/:sessionId` endpoints (RBAC-gated to Admin/self)
  - [ ] Force-logout on role change (existing tokens for the affected user are invalidated immediately)
  - [ ] Mobile: "Remote session revoked" handling — app detects invalidated token and redirects to login gracefully
- **Acceptance Criteria:**
  - Revoking a session immediately invalidates that session's tokens on next API call (not just on next refresh cycle).
  - A role change to a currently logged-in user forces re-authentication within one request cycle.
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `mobile`

### Story PLT-104: OTP-Based Login/Verification (Parent/Student Self-Service)
- **As a** Parent/Student **I want to** log in or verify my identity via OTP (SMS/Email) **so that** I don't need to remember a password for lightweight self-service access.
- **Tasks:**
  - [ ] `POST /auth/otp/request` — generates time-limited OTP, sends via Email (MVP) / SMS (P1) adapter
  - [ ] `POST /auth/otp/verify` — validates OTP, issues tokens on success
  - [ ] Rate-limit OTP requests per phone/email (prevent abuse/cost blowout on SMS)
  - [ ] OTP expiry (e.g., 5 minutes), single-use enforcement
- **Acceptance Criteria:**
  - OTP is single-use and expires after the configured window.
  - Requesting more than N OTPs per hour for the same identifier is rate-limited.
- **Story Points:** 5 | **Priority:** P1 | **Labels:** `backend`, `notifications`

### Story PLT-105: Password Reset Flow
- **As a** user **I want to** reset my forgotten password securely **so that** I can regain access without Admin intervention.
- **Tasks:**
  - [ ] `POST /auth/password-reset/request` — emails a signed, time-limited reset link/token
  - [ ] `POST /auth/password-reset/confirm` — validates token, sets new password, invalidates all existing sessions for that user
  - [ ] Frontend: reset request + reset confirmation pages
- **Acceptance Criteria:**
  - Reset token is single-use, expires after configurable window (e.g., 1 hour).
  - Successful reset invalidates all prior sessions (security best practice).
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `frontend`

### Story PLT-106: Jailbreak/Root Detection for Sensitive Mobile Roles *(Mobile hardening)*
- **As the** system **I want to** detect a jailbroken/rooted device for Finance/HR roles **so that** sensitive mobile sessions aren't run on compromised devices.
- **Tasks:**
  - [ ] Integrate root/jailbreak detection library in Expo build
  - [ ] Block or warn-and-log login for flagged roles on flagged devices (configurable: block vs. warn)
- **Acceptance Criteria:** A rooted device attempting login as a Finance/HR role triggers the configured policy (block/warn), and the event is audit-logged.
- **Story Points:** 3 | **Priority:** P2 | **Labels:** `mobile`, `security`

---

## EPIC PLT-EPIC-02: Dynamic RBAC & Policy Engine

**Goal:** Every module-, page-, action-, and API-level access decision is governed by a configurable role/permission model with ownership-aware policies, enforced consistently on both UI and API.
**Maps to:** FR-PLT-03, FR-PLT-04 | Master Plan §5 "Dynamic RBAC & Policy Engine," Pillar #1
**Definition of Ready:** Role catalog (Super Admin, School Admin, Teacher, Student, Parent, Staff + custom roles) and initial permission taxonomy agreed.
**Definition of Done:** A permission-matrix test suite proves every module's key actions are correctly allowed/denied per role, including ownership edge cases.

### Story PLT-201: Role & Permission Data Model
- **As the** system **I want to** store roles as a configurable set of permissions **so that** schools can define custom roles beyond the immutable system roles.
- **Tasks:**
  - [ ] `Role` entity (id, name, is_system_role: boolean, school_id nullable for system roles)
  - [ ] `Permission` entity (id, key e.g. `ATTENDANCE_MARK`, `FINANCE_INVOICE_REVERSE`, module, action type)
  - [ ] `RolePermission` join table
  - [ ] Seed immutable system roles (Super Admin, School Admin) that cannot be edited/deleted
  - [ ] Admin UI: Role management screen (list, create custom role, assign permissions via checkbox matrix)
- **Acceptance Criteria:**
  - System roles cannot be deleted or have their core permissions removed via API (enforced server-side, not just UI-hidden).
  - A custom role can be created with an arbitrary subset of available permissions.
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `frontend`

### Story PLT-202: Permission-Check Guard (API Layer)
- **As a** developer **I want to** decorate any NestJS route with a required permission **so that** access control is declarative and consistent across all modules.
- **Tasks:**
  - [ ] Implement `@RequirePermission('ATTENDANCE_MARK')` decorator + `PermissionGuard`
  - [ ] Guard resolves current user's role → permissions, denies with 403 if missing
  - [ ] Guard must be applied by default (fail-closed) — new routes without an explicit decorator should fail a lint/CI check rather than silently being open
  - [ ] Unit tests: guard allows/denies correctly for a matrix of role × permission combinations
- **Acceptance Criteria:**
  - Any controller route missing an explicit permission decorator fails a CI static-check ("no route left unguarded" rule).
  - Permission checks add negligible latency (<5ms) — cache role→permission resolution in Redis with invalidation on role change.
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `security`

### Story PLT-203: Ownership Policy Engine
- **As a** Teacher **I want to** only be able to edit grades for classes I'm assigned to **so that** cross-class data tampering is impossible even with the correct role.
- **Tasks:**
  - [ ] Design `IOwnershipPolicy` interface — pluggable per-entity-type ownership check (e.g., `TeacherClassOwnershipPolicy`, `ParentChildOwnershipPolicy`)
  - [ ] Implement policy resolution in the same `PermissionGuard` pipeline (permission check passes → ownership check runs if entity-scoped)
  - [ ] Register ownership policies for: Teacher→Class/Section, Parent→Child, Homeroom Teacher→Homeroom Students
  - [ ] Unit tests: teacher A cannot edit teacher B's class grades even with `GRADE_ENTER` permission; parent cannot view a non-associated child's record
- **Acceptance Criteria:**
  - A user with the correct role-level permission but wrong ownership scope receives 403, and the denial reason is distinguishable in logs (role-denial vs. ownership-denial) for debugging.
  - Ownership policies are pluggable — adding a new entity type's ownership rule doesn't require touching the core guard.
- **Story Points:** 13 | **Priority:** P0 | **Labels:** `backend`, `security`, `architecture`

### Story PLT-204: Frontend Permission-Aware UI Rendering
- **As a** user **I want to** only see UI elements (menu items, buttons, pages) I'm actually permitted to use **so that** the interface isn't cluttered with inaccessible actions and no UI-only "security."
- **Tasks:**
  - [ ] `usePermissions()` React hook exposing the current user's resolved permission set (fetched once at login, cached)
  - [ ] `<PermissionGate permission="FINANCE_INVOICE_REVERSE">` wrapper component for conditional rendering
  - [ ] Route-level guards in Next.js (redirect to 403 page if a route's required permission is missing)
  - [ ] **Explicitly note:** this is UX only — the API-layer guard (PLT-202) is the actual security boundary, never trust the frontend check alone
- **Acceptance Criteria:**
  - Navigation menu only shows modules/actions the logged-in user has permission for.
  - Directly hitting a restricted page URL redirects to a 403 page, not a broken UI.
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `frontend`

### Story PLT-205: Module/Page/Action/API-Level Granularity Verification
- **As** QA **I want to** run a comprehensive permission-matrix test **so that** we have confidence the RBAC system correctly gates at every level described in the Master Plan (module, page, action, API).
- **Tasks:**
  - [ ] Build a test matrix spreadsheet/fixture: Role × Module × Action → Expected (Allow/Deny)
  - [ ] Automate as a parametrized integration test suite (one test run per matrix row)
  - [ ] Include negative tests: attempting to call an API directly (bypassing frontend) with insufficient permission
- **Acceptance Criteria:** 100% of the defined matrix rows pass; matrix is maintained as new modules are added (living document, updated per new Epic).
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `qa`, `security`

---

## EPIC PLT-EPIC-03: Licensing & Entitlement Enforcement

**Goal:** The application validates a signed license certificate at startup, enforces feature/module/limit entitlements consistently on UI and API, and degrades gracefully rather than catastrophically on license issues.
**Maps to:** FR-PLT-05, FR-PLT-06 | Master Plan §4 (full Licensing Architecture)
**Definition of Ready:** Certificate payload schema (§4.2) finalized; RSA/ECDSA keypair generation process agreed with Ops.

### Story PLT-301: License Certificate Local Validator
- **As the** system **I want to** verify a signed license certificate against an embedded public key at startup **so that** tampered or invalid licenses are rejected before the app serves traffic.
- **Tasks:**
  - [ ] Implement signature verification (RSA-2048/ECDSA) against embedded public key
  - [ ] Parse and cache the validated certificate payload (edition, allowed_modules, limits, features, expiry) in memory/Redis
  - [ ] Startup health check fails fast with a clear error if signature is invalid
  - [ ] Unit tests: valid cert passes; tampered payload (bit-flip test) fails; expired cert flagged separately from invalid-signature cert
- **Acceptance Criteria:**
  - A tampered certificate is rejected and the system enters locked maintenance mode (not a crash, not silent bypass).
  - Validation result and parsed entitlements are cached to avoid re-verifying the signature on every request.
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `security`

### Story PLT-302: Feature Entitlement Enforcer (API + UI)
- **As the** system **I want to** gate module/feature access based on the current license's `allowed_modules` and `features` **so that** a Basic-edition school cannot use Deluxe-only functionality even if they guess the API route.
- **Tasks:**
  - [ ] `@RequireEntitlement('ai_timetable_assistant')` decorator + `EntitlementGuard`, composable with `PermissionGuard` (PLT-202)
  - [ ] Frontend: entitlement-aware UI hiding (reuse `PermissionGate` pattern, extend to `EntitlementGate`)
  - [ ] Limit enforcement (e.g., `maximum_students`) — block new-student creation past the licensed cap with a clear error message, not a silent failure
  - [ ] Unit tests: Basic-edition license blocks Deluxe-only route at API level even with valid auth/RBAC permission
- **Acceptance Criteria:**
  - Every licensable feature/module is checked at the API layer, not just hidden in the UI.
  - Exceeding a numeric limit (e.g., max students) returns a clear, actionable error rather than a generic 500.
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `frontend`

### Story PLT-303: Online Activation Flow
- **As a** School Admin **I want to** activate my serial key online **so that** the school gets its signed license without manual file handling.
- **Tasks:**
  - [ ] `POST /license/activate` — calls the Activation Server with serial key + hardware footprint (school_id, server MAC hash)
  - [ ] Store returned signed certificate securely (encrypted at rest)
  - [ ] Admin UI: Activation screen with clear success/failure states
- **Acceptance Criteria:** A valid serial key results in a stored, validated certificate and immediate feature unlock without app restart (or with a clearly communicated restart requirement).
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `frontend`

### Story PLT-304: Offline Activation Flow
- **As a** School Admin at an air-gapped site **I want to** activate via an offline token/`.lic` file exchange **so that** schools without reliable internet can still activate.
- **Tasks:**
  - [ ] Generate a local system request token (hardware fingerprint bundle) for upload via any internet-connected device
  - [ ] Import/parse a `.lic` file, validate signature (reuses PLT-301), and apply
  - [ ] Admin UI: guided offline-activation wizard (generate token → instructions → upload `.lic`)
- **Acceptance Criteria:** A correctly generated `.lic` file activates the school exactly as the online path would, with identical validation rigor.
- **Story Points:** 5 | **Priority:** P1 | **Labels:** `backend`, `frontend`

### Story PLT-305: Grace Period & Graceful Degradation
- **As a** School Admin **I want to** get a warning banner instead of a sudden lockout if the activation/renewal server is unreachable **so that** operations aren't disrupted mid-day.
- **Tasks:**
  - [ ] Implement configurable grace-period countdown (default 14 days) from last-successful-validation timestamp
  - [ ] Persistent, dismissible-but-recurring Admin banner during grace period
  - [ ] Full feature lock (maintenance mode) only after grace period expires without renewal
  - [ ] Background job: periodic re-validation attempt against the Activation Server
- **Acceptance Criteria:** Losing connectivity to the licensing server does not lock out the school for at least the configured grace window; the countdown is visible to Admins.
- **Story Points:** 3 | **Priority:** P1 | **Labels:** `backend`, `frontend`

---

## EPIC PLT-EPIC-04: Immutable Audit Logging System

**Goal:** Every sensitive action across every module produces a correct, tamper-proof, append-only audit record, queryable by Admins.
**Maps to:** FR-PLT-07 | Master Plan §6.1
**Definition of Ready:** Audit Record schema (§6.1) finalized; list of "sensitive actions" per module agreed (living list, expands as new modules ship).

### Story PLT-401: Audit Record Schema & Append-Only Storage
- **As the** system **I want to** store audit records in an append-only table **so that** modification/deletion via application logic is architecturally prevented, not just discouraged.
- **Tasks:**
  - [ ] `AuditRecord` entity per §6.1 schema (id, timestamp, actor_id, actor_role, ip_address, device_info, action, module, entity_type, entity_id, before_value, after_value JSONB, reason)
  - [ ] Database-level protection: revoke `UPDATE`/`DELETE` grants on the audit table for the application's DB role (defense in depth beyond just "don't call update in code")
  - [ ] Repository layer exposes only `create()` and `query()` — no update/delete methods exist in the codebase at all
- **Acceptance Criteria:**
  - Attempting an `UPDATE`/`DELETE` against the audit table at the database connection level (not just via the app) fails due to revoked grants.
  - No code path in the repository layer can modify an existing audit record.
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `database`, `security`

### Story PLT-402: Audit Interceptor (Automatic Capture)
- **As a** developer **I want to** decorate a sensitive use-case with `@Audited('GRADE_MODIFIED')` **so that** audit logging is consistent and can't be forgotten module-by-module.
- **Tasks:**
  - [ ] Implement NestJS interceptor that captures actor context (from the authenticated request), before/after snapshots (where applicable), and writes the audit record asynchronously (non-blocking, via queue) after the action completes successfully
  - [ ] Mandatory-`reason` enforcement for a configurable subset of high-sensitivity actions (e.g., fee reversal, grade change) — request is rejected with 400 if `reason` is missing
  - [ ] Unit + integration tests: interceptor fires exactly once per action, captures correct before/after diff
- **Acceptance Criteria:** A developer adding a new sensitive action only needs to add the decorator + a `reason` field to the DTO — no manual audit-write code required.
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `architecture`

### Story PLT-403: Admin Audit Log Viewer
- **As an** Admin **I want to** search/filter audit records by actor, module, date range, and action type **so that** I can investigate incidents or answer compliance questions.
- **Tasks:**
  - [ ] `GET /audit-logs` with filter/pagination support (indexed on timestamp, module, actor_id)
  - [ ] Admin UI: filterable table with before/after JSON diff viewer
  - [ ] Export to CSV for compliance reporting
- **Acceptance Criteria:** An Admin can find "all fee reversals by User X in the last 30 days" in under 3 clicks, with correct results.
- **Story Points:** 5 | **Priority:** P1 | **Labels:** `backend`, `frontend`

### Story PLT-404: Retention Policy Enforcement
- **As the** system **I want to** retain audit records per the configured retention policy (e.g., ≥7 years for finance actions) **so that** compliance requirements (NFR-07) are met without unbounded storage growth for non-critical logs.
- **Tasks:**
  - [ ] Configurable retention period per module/action-category
  - [ ] Scheduled archival job (move to cold storage) rather than deletion, for categories with long retention
  - [ ] Never auto-delete finance/security records within the mandated minimum window
- **Acceptance Criteria:** No finance or security-category audit record is purgeable before its configured minimum retention period, enforced at the job level (not just documented policy).
- **Story Points:** 3 | **Priority:** P2 | **Labels:** `backend`, `devops`

---

## EPIC PLT-EPIC-05: Error & Diagnostic Logging Engine

**Goal:** Structured, redacted, rotated application logs exist for operational debugging without bloating storage or leaking secrets.
**Maps to:** FR-PLT-08 | Master Plan §6.2
**Definition of Ready:** Logging library selected (e.g., Pino/Winston); redaction field list agreed (passwords, tokens, card details, secret keys, biometric templates).

### Story PLT-501: Structured JSON Logger with Correlation IDs
- **As a** developer **I want to** log every request with a correlation ID **so that** I can trace a single request's full lifecycle across services in production.
- **Tasks:**
  - [ ] Middleware generates/propagates a correlation ID per incoming request (header passthrough for mobile/web clients)
  - [ ] Structured log format: timestamp, level, correlation_id, user_id, route, message, stack_trace (on error)
  - [ ] Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL, configurable per environment
- **Acceptance Criteria:** Every log line for a given request shares the same correlation ID, queryable end-to-end.
- **Story Points:** 5 | **Priority:** P1 | **Labels:** `backend`, `observability`

### Story PLT-502: Automatic Redaction of Sensitive Fields
- **As the** system **I want to** strip passwords, tokens, card details, secret keys, and biometric templates before writing any log line **so that** logs are never a data-leak vector.
- **Tasks:**
  - [ ] Redaction middleware/serializer applied globally to the logger (deny-list of field names + pattern-based detection for token-like strings)
  - [ ] Unit tests: a log call containing a `password` field, an `Authorization` header, or a card-number-shaped string is redacted in the output
- **Acceptance Criteria:** No test-covered sensitive field ever appears in raw log output, verified by an automated log-content scan in CI.
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `security`

### Story PLT-503: Log Rotation (25MB cap, 3 historical files)
- **As** Ops **I want to** cap log file size and retain only recent history **so that** disk usage stays bounded.
- **Tasks:**
  - [ ] Configure rotation: `app.log` active file capped at 25MB, rotates to `app.log.1/.2/.3`
  - [ ] Oldest file purged automatically when a 4th rotation occurs
  - [ ] Critical/ERROR-level entries additionally persisted to a database table (not just file) for the Admin Diagnostics Viewer
- **Acceptance Criteria:** Log directory never exceeds ~100MB (4 files × 25MB) under sustained load; critical errors remain queryable in the DB even after file rotation purges them from disk.
- **Story Points:** 3 | **Priority:** P1 | **Labels:** `backend`, `devops`

### Story PLT-504: Admin Diagnostics Viewer
- **As an** Admin **I want to** search/filter error logs from the control panel **so that** I can self-diagnose issues without SSH/server access.
- **Tasks:**
  - [ ] `GET /diagnostics/errors` with filter by severity, date range, correlation ID, module
  - [ ] Admin UI: diagnostics table with stack-trace expansion
- **Acceptance Criteria:** An Admin can locate all CRITICAL errors from the last 24 hours and view the associated stack trace/correlation ID without engineering assistance.
- **Story Points:** 5 | **Priority:** P2 | **Labels:** `backend`, `frontend`

---

## EPIC PLT-EPIC-06: Dynamic Module Registry & System Settings

**Goal:** Modules can be registered, enabled/disabled per license, and configured centrally; school-level settings have one canonical home.
**Maps to:** Master Plan §5 "Dynamic Module Registry," "System Settings Engine"

### Story PLT-601: Module Registry
- **As the** system **I want to** maintain a registry of all installable modules and their current enabled/disabled state (derived from license + Admin toggle) **so that** the UI and API can consistently know what's active.
- **Tasks:**
  - [ ] `ModuleRegistry` entity/service — single source of truth combining license entitlement (PLT-302) with any Admin-level module toggle (e.g., a Deluxe school choosing not to enable Hostel even though eligible)
  - [ ] `GET /modules` endpoint returning the resolved active-module list for the current school
  - [ ] Frontend: navigation dynamically renders only active modules
- **Acceptance Criteria:** Disabling a module via Admin settings immediately removes it from navigation and blocks its API routes (composes with `EntitlementGuard`).
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `frontend`

### Story PLT-602: School Configuration & System Settings Engine
- **As a** School Admin **I want to** configure school-wide settings (name, logo, academic-year start, timezone, locale, notification preferences) **so that** the system reflects our school's identity and operating rules.
- **Tasks:**
  - [ ] `SchoolSettings` key-value/JSONB store with typed accessors
  - [ ] Admin UI: Settings screen grouped by category (General, Academic Defaults, Notifications, Branding)
  - [ ] Settings changes are audit-logged (composes with PLT-402)
- **Acceptance Criteria:** A setting change takes effect without a server restart; all consuming modules read settings through one shared service (no module hardcodes a school-specific value).
- **Story Points:** 8 | **Priority:** P0 | **Labels:** `backend`, `frontend`

---

## EPIC PLT-EPIC-07: Multi-Channel Notification Router (Platform Skeleton)

**Goal:** A single, reusable dispatch point exists for routing any platform event to the right channel(s) per user preference — full channel adapters (WhatsApp/SMS) are built later per-module, but the router itself is Platform Core.
**Maps to:** Master Plan §5 "Multi-Channel Notification Router," FR-COM-01 (partial), FR-MOB-03

### Story PLT-701: Notification Router Core Service
- **As a** developer in any module **I want to** call `notificationRouter.send(event)` **so that** I don't need to know which channel(s) to use — the router resolves that from user preference and event urgency.
- **Tasks:**
  - [ ] `NotificationEvent` interface (type, recipient, payload, urgency: NORMAL|EMERGENCY)
  - [ ] Channel adapter interface `INotificationChannelAdapter` (Email, Push implemented in Platform Core; SMS/WhatsApp adapters stubbed for later modules)
  - [ ] Per-user channel-preference resolution (default channel per event type, override-able by user)
  - [ ] Emergency events bypass digest/batching and send immediately on all configured channels
- **Acceptance Criteria:** Calling the router with an event and no explicit channel results in delivery via the user's preferred channel; an EMERGENCY-urgency event is never batched/delayed.
- **Story Points:** 8 | **Priority:** P1 | **Labels:** `backend`, `architecture`

### Story PLT-702: Email & Push Channel Adapters (MVP channels)
- **As the** system **I want to** deliver notifications via Email and Push (Expo Push/FCM/APNs) **so that** MVP-critical alerts (absence, fee due) reach users without waiting for SMS/WhatsApp adapters.
- **Tasks:**
  - [ ] Email adapter (transactional email provider integration)
  - [ ] Push adapter (Expo Push Service)
  - [ ] Delivery-status tracking (sent/delivered/failed) per notification
- **Acceptance Criteria:** A test event delivered via both channels is received and its delivery status is correctly recorded.
- **Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `mobile`

---

## EPIC PLT-EPIC-08: Storage & File Manager

**Goal:** A single, access-controlled abstraction over object storage (S3-compatible) is available to every module that needs to store files (photos, documents, PDFs).
**Maps to:** Master Plan §5 "Storage & File Manager"

### Story PLT-801: Storage Abstraction Layer
- **As a** developer **I want to** call `storageService.upload(file, scope)` **so that** every module stores files consistently, access-controlled, without directly touching S3 SDK calls.
- **Tasks:**
  - [ ] `IStorageAdapter` interface over S3-compatible providers (AWS S3, Cloudflare R2, MinIO for local dev)
  - [ ] Signed-URL generation for time-limited, access-controlled file retrieval (no public buckets)
  - [ ] File-scope tagging (student-document, homework-submission, id-photo, etc.) for retention-policy and access-rule application
  - [ ] Virus/malware scan hook on upload (configurable, at least for user-submitted content)
- **Acceptance Criteria:** No module code references an S3 SDK directly; all file access goes through signed URLs with appropriate expiry; a file's access is governed by the same RBAC/ownership rules as its parent entity (e.g., a homework submission file is only retrievable by the submitting student, their teacher, and their parent).
- **Story Points:** 8 | **Priority:** P1 | **Labels:** `backend`, `architecture`, `security`

### Story PLT-802: File Size/Type Validation & Quota
- **As the** system **I want to** enforce file-type and size limits per upload context **so that** storage costs and abuse vectors are controlled.
- **Tasks:**
  - [ ] Configurable max file size and allowed MIME types per scope (e.g., homework submissions vs. ID photos have different rules)
  - [ ] Per-school storage quota tracking tied to license `limits` (extendable in future cert versions)
- **Acceptance Criteria:** An oversized or disallowed-type upload is rejected with a clear client-facing error before any storage write occurs.
- **Story Points:** 5 | **Priority:** P1 | **Labels:** `backend`

---

## EPIC PLT-EPIC-09: System Health & Monitoring

**Goal:** Operational visibility into service health, ready for production support.
**Maps to:** Master Plan §5 "System Health & Monitoring," NFR-01 (Availability)

### Story PLT-901: Health Check Endpoints
- **As** Ops/DevOps **I want to** query a `/health` endpoint **so that** load balancers and uptime monitors can detect service health.
- **Tasks:**
  - [ ] `/health/liveness` (process is up) and `/health/readiness` (DB/Redis reachable, license valid) endpoints
  - [ ] Integrate with deployment platform's health-check configuration
- **Acceptance Criteria:** Readiness check correctly fails (503) when DB or Redis is unreachable, or when the license is in locked maintenance mode.
- **Story Points:** 3 | **Priority:** P2 | **Labels:** `backend`, `devops`

### Story PLT-902: Metrics & Alerting Hooks
- **As** Ops **I want to** export basic metrics (request latency, error rate, queue depth) **so that** we can monitor NFR-02 (attendance round-trip latency) and general system health in production.
- **Tasks:**
  - [ ] Instrument key routes with latency/error-rate metrics (Prometheus-compatible or equivalent)
  - [ ] Alert rule stubs for latency-SLA breach and elevated error rate (wired to Ops's chosen alerting tool)
- **Acceptance Criteria:** A dashboard exists showing p50/p95/p99 latency for at least the Attendance capture endpoint, satisfying NFR-02 observability.
- **Story Points:** 5 | **Priority:** P2 | **Labels:** `backend`, `devops`, `observability`

### Story PLT-903: Admin System Status Page
- **As an** Admin **I want to** see a simple system status summary (DB connected, license valid, last backup time) **so that** I have basic operational confidence without needing engineering access.
- **Tasks:**
  - [ ] Admin UI widget summarizing health-check + license + last-backup status
- **Acceptance Criteria:** Status page correctly reflects a simulated DB-down or license-invalid state in a staging test.
- **Story Points:** 5 | **Priority:** P2 | **Labels:** `frontend`, `backend`

---

## Cross-Epic Dependency Graph

```
PLT-EPIC-01 (Auth) ──┬──► PLT-EPIC-02 (RBAC) ──► PLT-EPIC-06 (Module Registry/Settings)
                      │                                    │
                      └──► PLT-EPIC-04 (Audit Logging) ◄───┘
                                    │
PLT-EPIC-03 (Licensing) ───────────┴──► PLT-EPIC-07 (Notification Router)
                                    │
PLT-EPIC-05 (Diagnostics) ─────────┘

PLT-EPIC-08 (Storage) — independent, can start in parallel after PLT-EPIC-01
PLT-EPIC-09 (Health/Monitoring) — independent, can start any time, lowest priority
```

**Critical path for MVP (per SRS Part D):** PLT-EPIC-01 → PLT-EPIC-02 → PLT-EPIC-03 → PLT-EPIC-04 must all be substantially complete before any other Master Plan module (Academic, Attendance, Finance) can safely begin its own build, since every subsequent module's stories will assume `@RequirePermission`, `@RequireEntitlement`, and `@Audited` decorators already exist and work.

---

## Suggested Sprint Breakdown (3–4 backend engineers)

| Sprint | Focus |
|---|---|
| Sprint 1 | PLT-101 → PLT-105 (Auth core), PLT-201 (Role/Permission model) started |
| Sprint 2 | PLT-202, PLT-203, PLT-204 (RBAC enforcement end-to-end), PLT-401, PLT-402 (Audit core) in parallel |
| Sprint 3 | PLT-301 → PLT-305 (Licensing), PLT-403, PLT-501 → PLT-503 (Diagnostics), PLT-601/602 |
| Sprint 4 | PLT-701/702 (Notification skeleton), PLT-801/802 (Storage), PLT-205 (RBAC matrix QA sign-off), PLT-901–903 (Health, lower priority, can slip to Sprint 5 if needed) |

**Sprint 2 exit gate = M2 "Foundation Complete" milestone** from the Roadmap document (SRS §24), since by end of Sprint 2 the core Auth+RBAC+Audit trio is functional enough for other module teams to start building against it.

---

*End of Jira/Epic-Style Action Plan — Platform Core & RBAC*
