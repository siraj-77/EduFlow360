# EduFlow360 — Jira/Epic-Style Action Plan (Epic → Story → Task → Sub-task)
## Module: Platform Core & RBAC + Admin Console (Master Plan §5, §5.4 / SRS §3.1)

**Version:** 2.0 · **Date:** October 9, 2026 · **Supersedes:** v1 (stories only)
**Project key:** `PLT` · **Sprints:** 2-week · **Points:** Fibonacci
**Source requirements:** SRS v1.3 FR-PLT-01 → FR-PLT-15 · Master Plan v5.3 §4, §5, §5.4, §6 · AGENTS.md
**Build model:** single-tenant (one database + one deployment per school) · **fresh development** — nothing from any earlier implementation · default system user **`superadmin`** · web `http://localhost:3030` · admin `http://localhost:3030/admin` · **70–80% agentic coding**.

**Sub-task executor legend:** 🤖 agent-led (human skims) · 🤝 paired (agent drafts, human decides) · 👤 human-led.
**Hierarchy:** Epic → Story → Task (`<STORY>-T<n>`) → Sub-task (`<STORY>-T<n>-S<m>`). Every story ends with a close-out task (`<STORY>-C`).
**Agent share** is the estimated share of *implementation effort* done by the agent for that story (security-critical stories are lower because human review is heavier). The plan-wide target is **70–80%**.
**Rules that apply to every sub-task:** AGENTS.md is the contract · TDD (RED → GREEN → REFACTOR) · one story per session · templates are used as-is (AGENTS.md §2.17) · no code from any other project (fresh build) · every route guarded and audited · money in integer minor units · time via `IClock` · i18n ×4 + RTL + light/dark.

---

## Epic index

| Epic ID | Epic name | Priority | Points | Agent share |
|---|---|---|---|---|
| PLT-EPIC-01 | Authentication & Session Management | P0 | 39 | ~71% |
| PLT-EPIC-02 | Dynamic RBAC & Policy Engine | P0 | 42 | ~69% |
| PLT-EPIC-03 | Licensing & Entitlement Enforcement | P0 | 29 | ~76% |
| PLT-EPIC-04 | Immutable Audit Logging System | P0 | 21 | ~75% |
| PLT-EPIC-05 | Error & Diagnostic Logging Engine | P0 | 18 | ~74% |
| PLT-EPIC-06 | Dynamic Module Registry & System Settings | P0 | 16 | ~80% |
| PLT-EPIC-07 | Multi-Channel Notification Router (Platform Skeleton) | P0 | 13 | ~80% |
| PLT-EPIC-08 | Storage & File Manager | P0 | 13 | ~71% |
| PLT-EPIC-09 | System Health & Monitoring | P0 | 13 | ~74% |
| PLT-EPIC-10 | Admin Console Shell, Template Port & Dev Environment | P0 | 29 | ~65% |
| **Total** | | | **233** | **~72%** |

**Total: 233 points · agent share ≈ 72%**

---

## EPIC PLT-EPIC-01 — Authentication & Session Management

**Priority:** P0 · **Points:** 39 · **Agent share:** ~71%

**Goal:** A user can securely log in, stay logged in appropriately, and be logged out/rotated correctly for every role; a fresh single-tenant deployment ships with a seeded default `superadmin`.
**Maps to:** FR-PLT-01, FR-PLT-02 | Master Plan §5 "Authentication (JWT, OTP, Sessions, Token Rotation)"
**Definition of Ready:** ERD for `User`, `Session`, `RefreshToken` entities agreed in Phase 0 workshop.
**Definition of Done:** All stories below pass unit + integration tests; security review of token handling completed; works identically on Web and Mobile clients.

### Story PLT-101 — JWT Login (Email/Username + Password)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~65% 🤖 | `backend`, `frontend`, `mobile`, `security` |

**User story:** As a registered user (any role) I want to log in with my credentials so that I can access the system appropriately scoped to my role.

**Acceptance criteria**
1. Given valid credentials, login returns access + refresh tokens and a 200 response.
2. Given invalid credentials, login returns 401 without leaking whether email or password was wrong.
3. After 5 failed attempts within 10 minutes, account locks for a configurable cooldown period and returns 429.
4. Password is never returned in any API response or logged in plaintext (verify against §6 Logging Rules — password redaction).
5. The seeded `superadmin` user (PLT-107) can log in with its initial password and is then forced to change it before any other call succeeds.
6. Lockout is enforced **server-side only**; the template's client-side demo lockout and demo credentials are not carried over.

**Tasks & sub-tasks**
- [ ] **PLT-101-T1** — Design `User` entity (id, email/username, password_hash, role_id, status, school_id)
  - [ ] `PLT-101-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-101-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-101-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-101-T2** — Implement password hashing (bcrypt/argon2) with configurable cost factor
  - [ ] `PLT-101-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-101-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-101-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-101-T3** — Implement `POST /auth/login` endpoint issuing access token (short-lived, e.g. 15 min) + refresh token (long-lived, e.g. 7 days)
  - [ ] `PLT-101-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-101-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-101-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-101-T4** — Implement account lockout after N failed attempts (configurable), with cooldown
  - [ ] `PLT-101-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-101-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-101-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-101-T5** — Frontend: Login form (Web) with validation, error states
  - [ ] `PLT-101-T5-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-101-T5-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-101-T5-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-101-T6** — Mobile: Login screen reusing shared API client
  - [ ] `PLT-101-T6-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-101-T6-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-101-T6-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-101-C** — Close-out
  - [ ] `PLT-101-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-101-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-101-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-101-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-102 — Token Refresh & Rotation
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~65% 🤖 | `backend`, `security` |

**User story:** As the system I want to rotate refresh tokens on use so that a stolen refresh token has a limited window of exploitability.

**Acceptance criteria**
1. A refresh token can only be used once; reuse invalidates all tokens issued from that login session.
2. Access-token expiry is enforced server-side on every protected route (not just client-trusted).

**Tasks & sub-tasks**
- [ ] **PLT-102-T1** — Implement `POST /auth/refresh` — validates refresh token, issues new access + refresh token pair, invalidates old refresh token (rotation)
  - [ ] `PLT-102-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-102-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-102-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-102-T2** — Store refresh-token family/lineage to detect reuse of a revoked token (replay-attack detection)
  - [ ] `PLT-102-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-102-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-102-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-102-T3** — On detected reuse, revoke entire token family and force re-login
  - [ ] `PLT-102-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-102-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-102-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-102-T4** — Unit test: expired token rejected; reused-after-rotation token triggers family revocation
  - [ ] `PLT-102-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **PLT-102-C** — Close-out
  - [ ] `PLT-102-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-102-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-102-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-102-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-103 — Session Management & Forced Logout
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~80% 🤖 | `backend`, `mobile` |

**User story:** As an Admin I want to view and revoke a user's active sessions so that I can respond to lost devices or role changes.

**Acceptance criteria**
1. Revoking a session immediately invalidates that session's tokens on next API call (not just on next refresh cycle).
2. A role change to a currently logged-in user forces re-authentication within one request cycle.

**Tasks & sub-tasks**
- [ ] **PLT-103-T1** — `Session` entity tracking device info, IP, last-active timestamp, per login
  - [ ] `PLT-103-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-103-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-103-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-103-T2** — `GET /users/:id/sessions` and `DELETE /users/:id/sessions/:sessionId` endpoints (RBAC-gated to Admin/self)
  - [ ] `PLT-103-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-103-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-103-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-103-T3** — Force-logout on role change (existing tokens for the affected user are invalidated immediately)
  - [ ] `PLT-103-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-103-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-103-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-103-T4** — Mobile: "Remote session revoked" handling — app detects invalidated token and redirects to login gracefully
  - [ ] `PLT-103-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-103-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-103-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-103-C** — Close-out
  - [ ] `PLT-103-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-103-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-103-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-104 — OTP-Based Login/Verification (Parent/Student Self-Service)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | Deferred (mobile) | ~80% 🤖 | `backend`, `notifications` |

**User story:** As a Parent/Student I want to log in or verify my identity via OTP (SMS/Email) so that I don't need to remember a password for lightweight self-service access.

**Acceptance criteria**
1. OTP is single-use and expires after the configured window.
2. Requesting more than N OTPs per hour for the same identifier is rate-limited.

**Tasks & sub-tasks**
- [ ] **PLT-104-T1** — `POST /auth/otp/request` — generates time-limited OTP, sends via Email (MVP) / SMS (P1) adapter
  - [ ] `PLT-104-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-104-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-104-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-104-T2** — `POST /auth/otp/verify` — validates OTP, issues tokens on success
  - [ ] `PLT-104-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-104-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-104-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-104-T3** — Rate-limit OTP requests per phone/email (prevent abuse/cost blowout on SMS)
  - [ ] `PLT-104-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-104-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-104-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-104-T4** — OTP expiry (e.g., 5 minutes), single-use enforcement
  - [ ] `PLT-104-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-104-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-104-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-104-C** — Close-out
  - [ ] `PLT-104-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-104-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-104-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-105 — Password Reset Flow
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As a user I want to reset my forgotten password securely so that I can regain access without Admin intervention.

**Acceptance criteria**
1. Reset token is single-use, expires after configurable window (e.g., 1 hour).
2. Successful reset invalidates all prior sessions (security best practice).

**Tasks & sub-tasks**
- [ ] **PLT-105-T1** — `POST /auth/password-reset/request` — emails a signed, time-limited reset link/token
  - [ ] `PLT-105-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-105-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-105-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-105-T2** — `POST /auth/password-reset/confirm` — validates token, sets new password, invalidates all existing sessions for that user
  - [ ] `PLT-105-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-105-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-105-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-105-T3** — Frontend: reset request + reset confirmation pages
  - [ ] `PLT-105-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-105-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-105-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-105-C** — Close-out
  - [ ] `PLT-105-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-105-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-105-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-106 — Jailbreak/Root Detection for Sensitive Mobile Roles
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P2 | Deferred (mobile) | ~65% 🤖 | `mobile`, `security` |

**User story:** As the system I want to detect a jailbroken/rooted device for Finance/HR roles so that sensitive mobile sessions aren't run on compromised devices.

**Acceptance criteria**
1. A rooted device attempting login as a Finance/HR role triggers the configured policy (block/warn), and the event is audit-logged.

**Tasks & sub-tasks**
- [ ] **PLT-106-T1** — Integrate root/jailbreak detection library in Expo build
  - [ ] `PLT-106-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-106-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-106-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-106-T2** — Block or warn-and-log login for flagged roles on flagged devices (configurable: block vs. warn)
  - [ ] `PLT-106-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-106-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-106-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-106-C** — Close-out
  - [ ] `PLT-106-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-106-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-106-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-106-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-107 — Seed default Superadmin system user (single-tenant)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~65% 🤖 | `backend`, `security` |

**User story:** As the school's installer I want a default `superadmin` system user created automatically on a fresh deployment so that the school can sign in to `/admin` immediately and then create named accounts.

**Depends on:** PLT-101 (login), PLT-105 (password change/reset), PLT-201 (roles)

**Acceptance criteria**
1. Fresh database + seed ⇒ exactly one `superadmin` with role `SUPERADMIN`; running the seed twice leaves one user and an unchanged password.
2. With the secret unset, the seed succeeds in development (random password shown once) and **fails fast** in staging/production naming `SEED_SUPERADMIN_PASSWORD`.
3. First login succeeds but every other API call returns a "password change required" error until the password is changed.
4. API attempts to delete, rename, demote or disable the last active Superadmin are rejected and audited.
5. The password never appears in logs, audit records, test snapshots or tracked files (secret scan green).

**Tasks & sub-tasks**
- [ ] **PLT-107-T1** — `User` flags `isSystemUser`, `mustChangePassword`; immutable role `SUPERADMIN` holding every permission (server-side protection against edit/delete)
  - [ ] `PLT-107-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-107-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-107-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-107-T2** — Idempotent seed command `pnpm --filter api db:seed` (also runs on first boot in development): creates exactly one `superadmin`; never resets an existing password; never creates a second
  - [ ] `PLT-107-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-107-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-107-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-107-T3** — Initial password from `SEED_SUPERADMIN_PASSWORD`; development-only fallback = random password printed once; staging/production fail fast when unset; value never logged, audited or committed
  - [ ] `PLT-107-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-107-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-107-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-107-T4** — First-login forced password change (reuse PLT-105 flow); until changed only the change-password endpoint is callable
  - [ ] `PLT-107-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-107-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-107-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-107-T5** — Protections: cannot delete, rename, change role of, or disable the last active `SUPERADMIN`; every attempt audited
  - [ ] `PLT-107-T5-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-107-T5-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-107-T5-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-107-T6** — 👤 Owner sets the production secret in the secrets manager and records the break-glass procedure in the handover pack
  - [ ] `PLT-107-T6-S1` 👤 Owner sets the production secret in the secrets manager and records the break-glass procedure in the handover pack
- [ ] **PLT-107-C** — Close-out
  - [ ] `PLT-107-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-107-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-107-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-107-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-02 — Dynamic RBAC & Policy Engine

**Priority:** P0 · **Points:** 42 · **Agent share:** ~69%

**Goal:** Every module-, page-, action-, and API-level access decision is governed by a configurable role/permission model with ownership-aware policies, enforced consistently on both UI and API.
**Maps to:** FR-PLT-03, FR-PLT-04 | Master Plan §5 "Dynamic RBAC & Policy Engine," Pillar #1
**Definition of Ready:** Role catalog (Superadmin, School Admin, Teacher, Student, Parent, Staff + custom roles) and initial permission taxonomy agreed.
**Definition of Done:** A permission-matrix test suite proves every module's key actions are correctly allowed/denied per role, including ownership edge cases.

### Story PLT-201 — Role & Permission Data Model
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As the system I want to store roles as a configurable set of permissions so that schools can define custom roles beyond the immutable system roles.

**Acceptance criteria**
1. System roles cannot be deleted or have their core permissions removed via API (enforced server-side, not just UI-hidden).
2. A custom role can be created with an arbitrary subset of available permissions.

**Tasks & sub-tasks**
- [ ] **PLT-201-T1** — `Role` entity (id, name, is_system_role: boolean, school_id nullable for system roles)
  - [ ] `PLT-201-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-201-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-201-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-201-T2** — `Permission` entity (id, key e.g. `ATTENDANCE_MARK`, `FINANCE_INVOICE_REVERSE`, module, action type)
  - [ ] `PLT-201-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-201-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-201-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-201-T3** — `RolePermission` join table
  - [ ] `PLT-201-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-201-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-201-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-201-T4** — Seed immutable system roles (`SUPERADMIN`, `SCHOOL_ADMIN`) that cannot be edited/deleted
  - [ ] `PLT-201-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-201-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-201-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-201-T5** — Admin UI: Role management screen (list, create custom role, assign permissions via checkbox matrix)
  - [ ] `PLT-201-T5-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-201-T5-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-201-T5-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-201-C** — Close-out
  - [ ] `PLT-201-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-201-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-201-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-202 — Permission-Check Guard (API Layer)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~65% 🤖 | `backend`, `security` |

**User story:** As a developer I want to decorate any NestJS route with a required permission so that access control is declarative and consistent across all modules.

**Acceptance criteria**
1. Any controller route missing an explicit permission decorator fails a CI static-check ("no route left unguarded" rule).
2. Permission checks add negligible latency (<5ms) — cache role→permission resolution in Redis with invalidation on role change.

**Tasks & sub-tasks**
- [ ] **PLT-202-T1** — Implement `@RequirePermission('ATTENDANCE_MARK')` decorator + `PermissionGuard`
  - [ ] `PLT-202-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-202-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-202-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-202-T2** — Guard resolves current user's role → permissions, denies with 403 if missing
  - [ ] `PLT-202-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-202-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-202-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-202-T3** — Guard must be applied by default (fail-closed) — new routes without an explicit decorator should fail a lint/CI check rather than silently being open
  - [ ] `PLT-202-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-202-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-202-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-202-T4** — Unit tests: guard allows/denies correctly for a matrix of role × permission combinations
  - [ ] `PLT-202-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **PLT-202-C** — Close-out
  - [ ] `PLT-202-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-202-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-202-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-202-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-203 — Ownership Policy Engine
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 13 | P0 | M1 | ~65% 🤖 | `backend`, `security`, `architecture`, `architecture` |

**User story:** As a Teacher I want to only be able to edit grades for classes I'm assigned to so that cross-class data tampering is impossible even with the correct role.

**Acceptance criteria**
1. A user with the correct role-level permission but wrong ownership scope receives 403, and the denial reason is distinguishable in logs (role-denial vs. ownership-denial) for debugging.
2. Ownership policies are pluggable — adding a new entity type's ownership rule doesn't require touching the core guard.

**Tasks & sub-tasks**
- [ ] **PLT-203-T1** — Design `IOwnershipPolicy` interface — pluggable per-entity-type ownership check (e.g., `TeacherClassOwnershipPolicy`, `ParentChildOwnershipPolicy`)
  - [ ] `PLT-203-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-203-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-203-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-203-T2** — Implement policy resolution in the same `PermissionGuard` pipeline (permission check passes → ownership check runs if entity-scoped)
  - [ ] `PLT-203-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-203-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-203-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-203-T3** — Register ownership policies for: Teacher→Class/Section, Parent→Child, Homeroom Teacher→Homeroom Students
  - [ ] `PLT-203-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-203-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-203-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-203-T4** — Unit tests: teacher A cannot edit teacher B's class grades even with `GRADE_ENTER` permission; parent cannot view a non-associated child's record
  - [ ] `PLT-203-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **PLT-203-C** — Close-out
  - [ ] `PLT-203-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-203-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-203-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-203-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-204 — Frontend Permission-Aware UI Rendering
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~75% 🤖 | `frontend` |

**User story:** As a user I want to only see UI elements (menu items, buttons, pages) I'm actually permitted to use so that the interface isn't cluttered with inaccessible actions and no UI-only "security."

**Acceptance criteria**
1. Navigation menu only shows modules/actions the logged-in user has permission for.
2. Directly hitting a restricted page URL redirects to a 403 page, not a broken UI.

**Tasks & sub-tasks**
- [ ] **PLT-204-T1** — `usePermissions()` React hook exposing the current user's resolved permission set (fetched once at login, cached)
  - [ ] `PLT-204-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-204-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-204-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-204-T2** — `<PermissionGate permission="FINANCE_INVOICE_REVERSE">` wrapper component for conditional rendering
  - [ ] `PLT-204-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-204-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-204-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-204-T3** — Route-level guards in Next.js (redirect to 403 page if a route's required permission is missing)
  - [ ] `PLT-204-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-204-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-204-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-204-T4** — **Explicitly note:** this is UX only — the API-layer guard (PLT-202) is the actual security boundary, never trust the frontend check alone
  - [ ] `PLT-204-T4-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-204-T4-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-204-T4-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-204-C** — Close-out
  - [ ] `PLT-204-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-204-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-204-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-205 — Module/Page/Action/API-Level Granularity Verification
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~65% 🤖 | `qa`, `security` |

**Acceptance criteria**
1. 100% of the defined matrix rows pass; matrix is maintained as new modules are added (living document, updated per new Epic).

**Tasks & sub-tasks**
- [ ] **PLT-205-T1** — Build a test matrix spreadsheet/fixture: Role × Module × Action → Expected (Allow/Deny)
  - [ ] `PLT-205-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-205-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-205-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-205-T2** — Automate as a parametrized integration test suite (one test run per matrix row)
  - [ ] `PLT-205-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-205-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-205-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-205-T3** — Include negative tests: attempting to call an API directly (bypassing frontend) with insufficient permission
  - [ ] `PLT-205-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-205-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-205-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-205-C** — Close-out
  - [ ] `PLT-205-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-205-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-205-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-205-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-03 — Licensing & Entitlement Enforcement

**Priority:** P0 · **Points:** 29 · **Agent share:** ~76%

**Goal:** The application validates a signed license certificate at startup, enforces feature/module/limit entitlements consistently on UI and API, and degrades gracefully rather than catastrophically on license issues.
**Maps to:** FR-PLT-05, FR-PLT-06 | Master Plan §4 (full Licensing Architecture)
**Definition of Ready:** Certificate payload schema (§4.2) finalized; RSA/ECDSA keypair generation process agreed with Ops.

### Story PLT-301 — License Certificate Local Validator
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~65% 🤖 | `backend`, `security` |

**User story:** As the system I want to verify a signed license certificate against an embedded public key at startup so that tampered or invalid licenses are rejected before the app serves traffic.

**Acceptance criteria**
1. A tampered certificate is rejected and the system enters locked maintenance mode (not a crash, not silent bypass).
2. Validation result and parsed entitlements are cached to avoid re-verifying the signature on every request.

**Tasks & sub-tasks**
- [ ] **PLT-301-T1** — Implement signature verification (RSA-2048/ECDSA) against embedded public key
  - [ ] `PLT-301-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-301-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-301-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-301-T2** — Parse and cache the validated certificate payload (edition, allowed_modules, limits, features, expiry) in memory/Redis
  - [ ] `PLT-301-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-301-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-301-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-301-T3** — Startup health check fails fast with a clear error if signature is invalid
  - [ ] `PLT-301-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-301-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-301-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-301-T4** — Unit tests: valid cert passes; tampered payload (bit-flip test) fails; expired cert flagged separately from invalid-signature cert
  - [ ] `PLT-301-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **PLT-301-C** — Close-out
  - [ ] `PLT-301-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-301-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-301-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-301-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-302 — Feature Entitlement Enforcer (API + UI)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As the system I want to gate module/feature access based on the current license's `allowed_modules` and `features` so that a Basic-edition school cannot use Deluxe-only functionality even if they guess the API route.

**Acceptance criteria**
1. Every licensable feature/module is checked at the API layer, not just hidden in the UI.
2. Exceeding a numeric limit (e.g., max students) returns a clear, actionable error rather than a generic 500.

**Tasks & sub-tasks**
- [ ] **PLT-302-T1** — `@RequireEntitlement('ai_timetable_assistant')` decorator + `EntitlementGuard`, composable with `PermissionGuard` (PLT-202)
  - [ ] `PLT-302-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-302-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-302-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-302-T2** — Frontend: entitlement-aware UI hiding (reuse `PermissionGate` pattern, extend to `EntitlementGate`)
  - [ ] `PLT-302-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-302-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-302-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-302-T3** — Limit enforcement (e.g., `maximum_students`) — block new-student creation past the licensed cap with a clear error message, not a silent failure
  - [ ] `PLT-302-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-302-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-302-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-302-T4** — Unit tests: Basic-edition license blocks Deluxe-only route at API level even with valid auth/RBAC permission
  - [ ] `PLT-302-T4-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **PLT-302-C** — Close-out
  - [ ] `PLT-302-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-302-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-302-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-303 — Online Activation Flow
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As a School Admin I want to activate my serial key online so that the school gets its signed license without manual file handling.

**Acceptance criteria**
1. A valid serial key results in a stored, validated certificate and immediate feature unlock without app restart (or with a clearly communicated restart requirement).

**Tasks & sub-tasks**
- [ ] **PLT-303-T1** — `POST /license/activate` — calls the Activation Server with serial key + hardware footprint (school_id, server MAC hash)
  - [ ] `PLT-303-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-303-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-303-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-303-T2** — Store returned signed certificate securely (encrypted at rest)
  - [ ] `PLT-303-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-303-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-303-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-303-T3** — Admin UI: Activation screen with clear success/failure states
  - [ ] `PLT-303-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-303-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-303-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-303-C** — Close-out
  - [ ] `PLT-303-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-303-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-303-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-304 — Offline Activation Flow
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As a School Admin at an air-gapped site I want to activate via an offline token/`.lic` file exchange so that schools without reliable internet can still activate.

**Acceptance criteria**
1. A correctly generated `.lic` file activates the school exactly as the online path would, with identical validation rigor.

**Tasks & sub-tasks**
- [ ] **PLT-304-T1** — Generate a local system request token (hardware fingerprint bundle) for upload via any internet-connected device
  - [ ] `PLT-304-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-304-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-304-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-304-T2** — Import/parse a `.lic` file, validate signature (reuses PLT-301), and apply
  - [ ] `PLT-304-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-304-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-304-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-304-T3** — Admin UI: guided offline-activation wizard (generate token → instructions → upload `.lic`)
  - [ ] `PLT-304-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-304-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-304-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-304-C** — Close-out
  - [ ] `PLT-304-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-304-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-304-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-305 — Grace Period & Graceful Degradation
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As a School Admin I want to get a warning banner instead of a sudden lockout if the activation/renewal server is unreachable so that operations aren't disrupted mid-day.

**Acceptance criteria**
1. Losing connectivity to the licensing server does not lock out the school for at least the configured grace window; the countdown is visible to Admins.

**Tasks & sub-tasks**
- [ ] **PLT-305-T1** — Implement configurable grace-period countdown (default 14 days) from last-successful-validation timestamp
  - [ ] `PLT-305-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-305-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-305-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-305-T2** — Persistent, dismissible-but-recurring Admin banner during grace period
  - [ ] `PLT-305-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-305-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-305-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-305-T3** — Full feature lock (maintenance mode) only after grace period expires without renewal
  - [ ] `PLT-305-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-305-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-305-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-305-T4** — Background job: periodic re-validation attempt against the Activation Server
  - [ ] `PLT-305-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-305-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-305-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-305-C** — Close-out
  - [ ] `PLT-305-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-305-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-305-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-04 — Immutable Audit Logging System

**Priority:** P0 · **Points:** 21 · **Agent share:** ~75%

**Goal:** Every sensitive action across every module produces a correct, tamper-proof, append-only audit record, queryable by Admins.
**Maps to:** FR-PLT-07 | Master Plan §6.1
**Definition of Ready:** Audit Record schema (§6.1) finalized; list of "sensitive actions" per module agreed (living list, expands as new modules ship).

### Story PLT-401 — Audit Record Schema & Append-Only Storage
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~65% 🤖 | `backend`, `database`, `security` |

**User story:** As the system I want to store audit records in an append-only table so that modification/deletion via application logic is architecturally prevented, not just discouraged.

**Acceptance criteria**
1. Attempting an `UPDATE`/`DELETE` against the audit table at the database connection level (not just via the app) fails due to revoked grants.
2. No code path in the repository layer can modify an existing audit record.

**Tasks & sub-tasks**
- [ ] **PLT-401-T1** — `AuditRecord` entity per §6.1 schema (id, timestamp, actor_id, actor_role, ip_address, device_info, action, module, entity_type, entity_id, before_value, after_value JSONB, reason)
  - [ ] `PLT-401-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-401-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-401-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-401-T2** — Database-level protection: revoke `UPDATE`/`DELETE` grants on the audit table for the application's DB role (defense in depth beyond just "don't call update in code")
  - [ ] `PLT-401-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-401-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-401-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-401-T3** — Repository layer exposes only `create()` and `query()` — no update/delete methods exist in the codebase at all
  - [ ] `PLT-401-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-401-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-401-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-401-C** — Close-out
  - [ ] `PLT-401-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-401-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-401-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-401-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-402 — Audit Interceptor (Automatic Capture)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As a developer I want to decorate a sensitive use-case with `@Audited('GRADE_MODIFIED')` so that audit logging is consistent and can't be forgotten module-by-module.

**Acceptance criteria**
1. A developer adding a new sensitive action only needs to add the decorator + a `reason` field to the DTO — no manual audit-write code required.

**Tasks & sub-tasks**
- [ ] **PLT-402-T1** — Implement NestJS interceptor that captures actor context (from the authenticated request), before/after snapshots (where applicable), and writes the audit record asynchronously (non-blocking, via queue) after the action completes successfully
  - [ ] `PLT-402-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-402-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-402-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-402-T2** — Mandatory-`reason` enforcement for a configurable subset of high-sensitivity actions (e.g., fee reversal, grade change) — request is rejected with 400 if `reason` is missing
  - [ ] `PLT-402-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-402-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-402-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-402-T3** — Unit + integration tests: interceptor fires exactly once per action, captures correct before/after diff
  - [ ] `PLT-402-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-402-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-402-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-402-C** — Close-out
  - [ ] `PLT-402-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-402-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-402-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-403 — Admin Audit Log Viewer
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As an Admin I want to search/filter audit records by actor, module, date range, and action type so that I can investigate incidents or answer compliance questions.

**Acceptance criteria**
1. An Admin can find "all fee reversals by User X in the last 30 days" in under 3 clicks, with correct results.

**Tasks & sub-tasks**
- [ ] **PLT-403-T1** — `GET /audit-logs` with filter/pagination support (indexed on timestamp, module, actor_id)
  - [ ] `PLT-403-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-403-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-403-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-403-T2** — Admin UI: filterable table with before/after JSON diff viewer
  - [ ] `PLT-403-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-403-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-403-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-403-T3** — Export to CSV for compliance reporting
  - [ ] `PLT-403-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-403-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-403-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-403-C** — Close-out
  - [ ] `PLT-403-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-403-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-403-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-404 — Retention Policy Enforcement
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P2 | M1 | ~70% 🤖 | `backend`, `devops` |

**User story:** As the system I want to retain audit records per the configured retention policy (e.g., ≥7 years for finance actions) so that compliance requirements (NFR-07) are met without unbounded storage growth for non-critical logs.

**Acceptance criteria**
1. No finance or security-category audit record is purgeable before its configured minimum retention period, enforced at the job level (not just documented policy).

**Tasks & sub-tasks**
- [ ] **PLT-404-T1** — Configurable retention period per module/action-category
  - [ ] `PLT-404-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-404-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-404-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-404-T2** — Scheduled archival job (move to cold storage) rather than deletion, for categories with long retention
  - [ ] `PLT-404-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-404-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-404-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-404-T3** — Never auto-delete finance/security records within the mandated minimum window
  - [ ] `PLT-404-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-404-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-404-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-404-C** — Close-out
  - [ ] `PLT-404-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-404-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-404-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-05 — Error & Diagnostic Logging Engine

**Priority:** P0 · **Points:** 18 · **Agent share:** ~74%

**Goal:** Structured, redacted, rotated application logs exist for operational debugging without bloating storage or leaking secrets.
**Maps to:** FR-PLT-08 | Master Plan §6.2
**Definition of Ready:** Logging library selected (e.g., Pino/Winston); redaction field list agreed (passwords, tokens, card details, secret keys, biometric templates).

### Story PLT-501 — Structured JSON Logger with Correlation IDs
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M1 | ~80% 🤖 | `backend`, `observability` |

**User story:** As a developer I want to log every request with a correlation ID so that I can trace a single request's full lifecycle across services in production.

**Acceptance criteria**
1. Every log line for a given request shares the same correlation ID, queryable end-to-end.

**Tasks & sub-tasks**
- [ ] **PLT-501-T1** — Middleware generates/propagates a correlation ID per incoming request (header passthrough for mobile/web clients)
  - [ ] `PLT-501-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-501-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-501-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-501-T2** — Structured log format: timestamp, level, correlation_id, user_id, route, message, stack_trace (on error)
  - [ ] `PLT-501-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-501-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-501-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-501-T3** — Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL, configurable per environment
  - [ ] `PLT-501-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-501-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-501-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-501-C** — Close-out
  - [ ] `PLT-501-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-501-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-501-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-502 — Automatic Redaction of Sensitive Fields
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~65% 🤖 | `backend`, `security` |

**User story:** As the system I want to strip passwords, tokens, card details, secret keys, and biometric templates before writing any log line so that logs are never a data-leak vector.

**Acceptance criteria**
1. No test-covered sensitive field ever appears in raw log output, verified by an automated log-content scan in CI.

**Tasks & sub-tasks**
- [ ] **PLT-502-T1** — Redaction middleware/serializer applied globally to the logger (deny-list of field names + pattern-based detection for token-like strings)
  - [ ] `PLT-502-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-502-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-502-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-502-T2** — Unit tests: a log call containing a `password` field, an `Authorization` header, or a card-number-shaped string is redacted in the output
  - [ ] `PLT-502-T2-S1` 🤖 Write and run the tests; confirm they fail for the right reason before the implementation exists, then pass after it
- [ ] **PLT-502-C** — Close-out
  - [ ] `PLT-502-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-502-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-502-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-502-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-503 — Log Rotation (25MB cap, 3 historical files)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P1 | M1 | ~70% 🤖 | `backend`, `devops` |

**Acceptance criteria**
1. Log directory never exceeds ~100MB (4 files × 25MB) under sustained load; critical errors remain queryable in the DB even after file rotation purges them from disk.

**Tasks & sub-tasks**
- [ ] **PLT-503-T1** — Configure rotation: `app.log` active file capped at 25MB, rotates to `app.log.1/.2/.3`
  - [ ] `PLT-503-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-503-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-503-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-503-T2** — Oldest file purged automatically when a 4th rotation occurs
  - [ ] `PLT-503-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-503-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-503-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-503-T3** — Critical/ERROR-level entries additionally persisted to a database table (not just file) for the Admin Diagnostics Viewer
  - [ ] `PLT-503-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-503-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-503-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-503-C** — Close-out
  - [ ] `PLT-503-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-503-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-503-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-504 — Admin Diagnostics Viewer
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P2 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As an Admin I want to search/filter error logs from the control panel so that I can self-diagnose issues without SSH/server access.

**Acceptance criteria**
1. An Admin can locate all CRITICAL errors from the last 24 hours and view the associated stack trace/correlation ID without engineering assistance.

**Tasks & sub-tasks**
- [ ] **PLT-504-T1** — `GET /diagnostics/errors` with filter by severity, date range, correlation ID, module
  - [ ] `PLT-504-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-504-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-504-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-504-T2** — Admin UI: diagnostics table with stack-trace expansion
  - [ ] `PLT-504-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-504-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-504-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-504-C** — Close-out
  - [ ] `PLT-504-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-504-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-504-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-06 — Dynamic Module Registry & System Settings

**Priority:** P0 · **Points:** 16 · **Agent share:** ~80%

**Goal:** Modules can be registered, enabled/disabled per license, and configured centrally; school-level settings have one canonical home.
**Maps to:** Master Plan §5 "Dynamic Module Registry," "System Settings Engine"

### Story PLT-601 — Module Registry
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As the system I want to maintain a registry of all installable modules and their current enabled/disabled state (derived from license + Admin toggle) so that the UI and API can consistently know what's active.

**Acceptance criteria**
1. Disabling a module via Admin settings immediately removes it from navigation and blocks its API routes (composes with `EntitlementGuard`).

**Tasks & sub-tasks**
- [ ] **PLT-601-T1** — `ModuleRegistry` entity/service — single source of truth combining license entitlement (PLT-302) with any Admin-level module toggle (e.g., a Deluxe school choosing not to enable Hostel even though eligible)
  - [ ] `PLT-601-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-601-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-601-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-601-T2** — `GET /modules` endpoint returning the resolved active-module list for the current school
  - [ ] `PLT-601-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-601-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-601-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-601-T3** — Frontend: navigation dynamically renders only active modules
  - [ ] `PLT-601-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-601-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-601-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-601-C** — Close-out
  - [ ] `PLT-601-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-601-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-601-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-602 — School Configuration & System Settings Engine
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~80% 🤖 | `backend`, `frontend` |

**User story:** As a School Admin I want to configure school-wide settings (name, logo, academic-year start, timezone, locale, notification preferences) so that the system reflects our school's identity and operating rules.

**Acceptance criteria**
1. A setting change takes effect without a server restart; all consuming modules read settings through one shared service (no module hardcodes a school-specific value).

**Tasks & sub-tasks**
- [ ] **PLT-602-T1** — `SchoolSettings` key-value/JSONB store with typed accessors
  - [ ] `PLT-602-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-602-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-602-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-602-T2** — Admin UI: Settings screen grouped by category (General, Academic Defaults, Notifications, Branding)
  - [ ] `PLT-602-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-602-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-602-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-602-T3** — Settings changes are audit-logged (composes with PLT-402)
  - [ ] `PLT-602-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-602-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-602-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-602-C** — Close-out
  - [ ] `PLT-602-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-602-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-602-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-07 — Multi-Channel Notification Router (Platform Skeleton)

**Priority:** P0 · **Points:** 13 · **Agent share:** ~80%

**Goal:** A single, reusable dispatch point exists for routing any platform event to the right channel(s) per user preference — full channel adapters (WhatsApp/SMS) are built later per-module, but the router itself is Platform Core.
**Maps to:** Master Plan §5 "Multi-Channel Notification Router," FR-COM-01 (partial), FR-MOB-03

### Story PLT-701 — Notification Router Core Service
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P1 | M1 | ~80% 🤖 | `backend`, `architecture` |

**User story:** As a developer in any module I want to call `notificationRouter.send(event)` so that I don't need to know which channel(s) to use — the router resolves that from user preference and event urgency.

**Acceptance criteria**
1. Calling the router with an event and no explicit channel results in delivery via the user's preferred channel; an EMERGENCY-urgency event is never batched/delayed.

**Tasks & sub-tasks**
- [ ] **PLT-701-T1** — `NotificationEvent` interface (type, recipient, payload, urgency: NORMAL|EMERGENCY)
  - [ ] `PLT-701-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-701-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-701-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-701-T2** — Channel adapter interface `INotificationChannelAdapter` (Email, Push implemented in Platform Core; SMS/WhatsApp adapters stubbed for later modules)
  - [ ] `PLT-701-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-701-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-701-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-701-T3** — Per-user channel-preference resolution (default channel per event type, override-able by user)
  - [ ] `PLT-701-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-701-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-701-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-701-T4** — Emergency events bypass digest/batching and send immediately on all configured channels
  - [ ] `PLT-701-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-701-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-701-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-701-C** — Close-out
  - [ ] `PLT-701-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-701-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-701-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-702 — Email & Push Channel Adapters (MVP channels)
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 (email) · push deferred | ~80% 🤖 | `backend`, `mobile` |

**User story:** As the system I want to deliver notifications via Email and Push (Expo Push/FCM/APNs) so that MVP-critical alerts (absence, fee due) reach users without waiting for SMS/WhatsApp adapters.

**Acceptance criteria**
1. A test event delivered via both channels is received and its delivery status is correctly recorded.

**Tasks & sub-tasks**
- [ ] **PLT-702-T1** — Email adapter (transactional email provider integration)
  - [ ] `PLT-702-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-702-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-702-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-702-T2** — Push adapter (Expo Push Service)
  - [ ] `PLT-702-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-702-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-702-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-702-T3** — Delivery-status tracking (sent/delivered/failed) per notification
  - [ ] `PLT-702-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-702-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-702-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-702-C** — Close-out
  - [ ] `PLT-702-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-702-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-702-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-08 — Storage & File Manager

**Priority:** P0 · **Points:** 13 · **Agent share:** ~71%

**Goal:** A single, access-controlled abstraction over object storage (S3-compatible) is available to every module that needs to store files (photos, documents, PDFs).
**Maps to:** Master Plan §5 "Storage & File Manager"

### Story PLT-801 — Storage Abstraction Layer
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P1 | M1 | ~65% 🤖 | `backend`, `architecture`, `security` |

**User story:** As a developer I want to call `storageService.upload(file, scope)` so that every module stores files consistently, access-controlled, without directly touching S3 SDK calls.

**Acceptance criteria**
1. No module code references an S3 SDK directly; all file access goes through signed URLs with appropriate expiry; a file's access is governed by the same RBAC/ownership rules as its parent entity (e.g., a homework submission file is only retrievable by the submitting student, their teacher, and their parent).

**Tasks & sub-tasks**
- [ ] **PLT-801-T1** — `IStorageAdapter` interface over S3-compatible providers (AWS S3, Cloudflare R2, MinIO for local dev)
  - [ ] `PLT-801-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-801-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-801-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-801-T2** — Signed-URL generation for time-limited, access-controlled file retrieval (no public buckets)
  - [ ] `PLT-801-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-801-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-801-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-801-T3** — File-scope tagging (student-document, homework-submission, id-photo, etc.) for retention-policy and access-rule application
  - [ ] `PLT-801-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-801-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-801-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-801-T4** — Virus/malware scan hook on upload (configurable, at least for user-submitted content)
  - [ ] `PLT-801-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-801-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-801-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-801-C** — Close-out
  - [ ] `PLT-801-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-801-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-801-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-801-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-802 — File Size/Type Validation & Quota
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P1 | M1 | ~80% 🤖 | `backend` |

**User story:** As the system I want to enforce file-type and size limits per upload context so that storage costs and abuse vectors are controlled.

**Acceptance criteria**
1. An oversized or disallowed-type upload is rejected with a clear client-facing error before any storage write occurs.

**Tasks & sub-tasks**
- [ ] **PLT-802-T1** — Configurable max file size and allowed MIME types per scope (e.g., homework submissions vs. ID photos have different rules)
  - [ ] `PLT-802-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-802-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-802-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-802-T2** — Per-school storage quota tracking tied to license `limits` (extendable in future cert versions)
  - [ ] `PLT-802-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-802-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-802-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-802-C** — Close-out
  - [ ] `PLT-802-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-802-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-802-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-09 — System Health & Monitoring

**Priority:** P0 · **Points:** 13 · **Agent share:** ~74%

**Goal:** Operational visibility into service health, ready for production support.
**Maps to:** Master Plan §5 "System Health & Monitoring," NFR-01 (Availability)

### Story PLT-901 — Health Check Endpoints
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P2 | M1 | ~70% 🤖 | `backend`, `devops` |

**Acceptance criteria**
1. Readiness check correctly fails (503) when DB or Redis is unreachable, or when the license is in locked maintenance mode.

**Tasks & sub-tasks**
- [ ] **PLT-901-T1** — `/health/liveness` (process is up) and `/health/readiness` (DB/Redis reachable, license valid) endpoints
  - [ ] `PLT-901-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-901-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-901-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-901-T2** — Integrate with deployment platform's health-check configuration
  - [ ] `PLT-901-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-901-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-901-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-901-C** — Close-out
  - [ ] `PLT-901-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-901-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-901-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-902 — Metrics & Alerting Hooks
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P2 | M1 | ~70% 🤖 | `backend`, `devops`, `observability` |

**Acceptance criteria**
1. A dashboard exists showing p50/p95/p99 latency for at least the Attendance capture endpoint, satisfying NFR-02 observability.

**Tasks & sub-tasks**
- [ ] **PLT-902-T1** — Instrument key routes with latency/error-rate metrics (Prometheus-compatible or equivalent)
  - [ ] `PLT-902-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-902-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-902-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-902-T2** — Alert rule stubs for latency-SLA breach and elevated error rate (wired to Ops's chosen alerting tool)
  - [ ] `PLT-902-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-902-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-902-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-902-C** — Close-out
  - [ ] `PLT-902-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-902-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-902-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-903 — Admin System Status Page
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P2 | M1 | ~80% 🤖 | `frontend`, `backend` |

**User story:** As an Admin I want to see a simple system status summary (DB connected, license valid, last backup time) so that I have basic operational confidence without needing engineering access.

**Acceptance criteria**
1. Status page correctly reflects a simulated DB-down or license-invalid state in a staging test.

**Tasks & sub-tasks**
- [ ] **PLT-903-T1** — Admin UI widget summarizing health-check + license + last-backup status
  - [ ] `PLT-903-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-903-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-903-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-903-C** — Close-out
  - [ ] `PLT-903-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-903-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-903-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## EPIC PLT-EPIC-10 — Admin Console Shell, Template Port & Dev Environment

**Priority:** P0 · **Points:** 29 · **Agent share:** ~65%

**Goal:** The web app runs on port 3030, the admin console lives at `http://localhost:3030/admin`, and the approved UI templates (landing/auth and admin dashboard) are reproduced exactly and wired to the real platform services.
**Maps to:** FR-PLT-14, FR-PLT-15 · AGENTS.md §2.17, §2.18
**Definition of Ready:** The two template HTML files are supplied by the owner and committed read-only under `docs/template/`.
**Definition of Done:** Public pages and the admin shell match the templates (visual regression green in light/dark × LTR/RTL); `/admin/**` is protected; no hard-coded ports or URLs.

### Story PLT-1001 — Dev environment contract: ports and base URLs
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 3 | P0 | M1 | ~70% 🤖 | `devops`, `backend`, `frontend` |

**User story:** As a developer I want the web app on port 3030 and the API on 3031 driven by configuration so that every URL, CORS rule and test derives from one place.

**Acceptance criteria**
1. `pnpm --filter web dev` serves `http://localhost:3030`; `/admin` responds (anonymous users are redirected to login).
2. Changing `WEB_PORT` changes every derived URL (CORS, e-mail links, Playwright) without code edits.
3. Start-up fails with a clear message naming the invalid/missing variable.
4. No hard-coded `localhost` URL exists in application source (check enforced in CI).

**Tasks & sub-tasks**
- [ ] **PLT-1001-T1** — Web scripts `dev`/`start` bind to `WEB_PORT` (default 3030); API binds to `API_PORT` (default 3031); Zod-validated env with fail-fast on missing/invalid values
  - [ ] `PLT-1001-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1001-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1001-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1001-T2** — CORS, cookie settings, e-mail link builder and Playwright `baseURL` derive from `WEB_BASE_URL`/`API_BASE_URL`; add a lint/grep check forbidding hard-coded `localhost:` URLs in `src`
  - [ ] `PLT-1001-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1001-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1001-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1001-T3** — README and `.env.example` (placeholders only) document ports, `/admin` and the seed
  - [ ] `PLT-1001-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1001-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1001-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1001-T4** — 👤 Owner confirms the API dev port (3031 is an assumption)
  - [ ] `PLT-1001-T4-S1` 👤 Owner confirms the API dev port (3031 is an assumption)
- [ ] **PLT-1001-C** — Close-out
  - [ ] `PLT-1001-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-1001-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-1001-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-1002 — `/admin` route group with authentication and permission guard
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~65% 🤖 | `frontend`, `backend`, `security` |

**User story:** As the school I want everything under `/admin` to require sign-in and the `ADMIN_CONSOLE_ACCESS` permission so that only authorised staff reach the console.

**Depends on:** PLT-101, PLT-202, PLT-204

**Acceptance criteria**
1. Anonymous `GET /admin` redirects to `/login?next=%2Fadmin`; after login the user lands on `/admin`.
2. A signed-in user without `ADMIN_CONSOLE_ACCESS` sees the 403 page; `superadmin` passes.
3. `next=https://evil.example` (or protocol-relative/encoded variants) is ignored and the user lands on `/admin`.
4. The API enforces the same permission independently of the web guard.

**Tasks & sub-tasks**
- [ ] **PLT-1002-T1** — Next.js route group/middleware protecting `/admin/**`; anonymous → redirect `/login?next=<path>`
  - [ ] `PLT-1002-T1-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1002-T1-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1002-T1-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1002-T2** — `next` parameter accepts only same-origin relative paths (open-redirect protection)
  - [ ] `PLT-1002-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1002-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1002-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1002-T3** — 403 page for authenticated but unauthorised users (template error-page styling)
  - [ ] `PLT-1002-T3-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-1002-T3-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-1002-T3-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-1002-T4** — Register permission `ADMIN_CONSOLE_ACCESS` and add RBAC-matrix rows
  - [ ] `PLT-1002-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1002-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1002-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1002-C** — Close-out
  - [ ] `PLT-1002-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-1002-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-1002-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-1002-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-1003 — Template import and fidelity baseline
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 5 | P0 | M1 | ~45% 🤖 | `frontend`, `devops`, `owner-decision` |

**User story:** As the owner I want the approved templates protected from accidental edits and a visual baseline so that the product always looks like the approved design.

**Acceptance criteria**
1. Modifying a template file makes CI fail with an explicit message.
2. Token values and dictionary keys/values in the packages equal the template's exactly.
3. Baseline screenshots exist for every templated screen in all four combinations.

**Tasks & sub-tasks**
- [ ] **PLT-1003-T1** — 👤 Owner commits the two template files to `docs/template/` (read-only) and approves the checksum list
  - [ ] `PLT-1003-T1-S1` 👤 Owner commits the two template files to `docs/template/` (read-only) and approves the checksum list
- [ ] **PLT-1003-T2** — CI check fails when a template file's checksum changes without an owner-authorisation entry in `WORKLOG.md`
  - [ ] `PLT-1003-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1003-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1003-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1003-T3** — Extract CSS tokens and the i18n dictionary **verbatim** into `packages/ui-kit` and `packages/i18n-resources` (no value or wording changes); unit test compares extracted values to the template
  - [ ] `PLT-1003-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1003-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1003-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1003-T4** — Playwright visual-regression harness: baseline screenshots taken from the template HTML itself (landing, login, forgot, reset, dashboard × light/dark × LTR/RTL)
  - [ ] `PLT-1003-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1003-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1003-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1003-C** — Close-out
  - [ ] `PLT-1003-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-1003-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-1003-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-1004 — Public pages port: landing, login, forgot password, reset password
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~65% 🤖 | `frontend`, `backend`, `security` |

**User story:** As a visitor I want the landing and authentication pages to look exactly like the approved template while working against the real platform.

**Depends on:** PLT-1003, PLT-101, PLT-105

**Acceptance criteria**
1. Screenshots match the template baselines within the agreed tolerance in all four combinations.
2. Five failed logins produce a **server-side** 429 and the template's error alert; no lockout logic exists in client code.
3. Language switch to Arabic flips direction to RTL; the choice persists.
4. Placeholder copy ("Trusted by 200+ schools" etc.) is unchanged and listed in `TODO.md` as *owner decision pending*.

**Tasks & sub-tasks**
- [ ] **PLT-1004-T1** — Port the landing page exactly (animated hero, preview card, marquee, features, theme toggle, language switcher EN/TA/SI/AR with RTL) — placeholder marketing copy unchanged
  - [ ] `PLT-1004-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-1004-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-1004-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-1004-T2** — Login, forgot-password and reset-password pages wired to the real auth API; remove demo credentials and client-side lockout; show server responses (401 generic, 429 lockout) using the template's alert styles
  - [ ] `PLT-1004-T2-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1004-T2-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1004-T2-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1004-T3** — Social-login buttons rendered per template; handler shows a "not configured" message until a social-login story exists (no OAuth in this milestone)
  - [ ] `PLT-1004-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1004-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1004-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1004-T4** — Visual-regression and RTL/light/dark tests against the baselines
  - [ ] `PLT-1004-T4-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1004-T4-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1004-T4-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1004-C** — Close-out
  - [ ] `PLT-1004-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-1004-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-1004-C-S3` 👤 Security review (attacker-style manual test: wrong role, wrong owner, replay, tampering)
  - [ ] `PLT-1004-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

### Story PLT-1005 — Admin shell port: sidebar, menu, top bar, dashboard
| Points | Priority | Milestone | Agent share | Labels |
|---|---|---|---|---|
| 8 | P0 | M1 | ~75% 🤖 | `frontend` |

**User story:** As an administrator I want the admin shell (collapsible sidebar with submenus, top bar, dashboard) to match the approved template and show only what I may use.

**Depends on:** PLT-1002, PLT-601, PLT-204

**Acceptance criteria**
1. The shell matches the template baselines in light/dark × LTR/RTL, desktop and mobile widths.
2. Menu entries disappear when the user lacks the permission or the module is disabled.
3. Keyboard navigation works; the mobile drawer opens/closes and traps focus.
4. The authorised menu additions are the only deviation from the template and are recorded.

**Tasks & sub-tasks**
- [ ] **PLT-1005-T1** — Port the shell exactly: collapsible left menu with submenus, mobile drawer, top bar (search, language, theme toggle, avatar)
  - [ ] `PLT-1005-T1-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-1005-T1-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-1005-T1-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-1005-T2** — Render the menu from a typed `MENU` config filtered by permission and module registry (visuals unchanged)
  - [ ] `PLT-1005-T2-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-1005-T2-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-1005-T2-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-1005-T3** — Dashboard widgets render the template's placeholder data until the owning modules exist (clearly marked as placeholder in code and `TODO.md`)
  - [ ] `PLT-1005-T3-S1` 🤖 Write failing tests first (RED) — unit, plus integration where persistence/guards are touched; run and show the failure
  - [ ] `PLT-1005-T3-S2` 🤖 Implement the minimum code (GREEN) behind ports; add guards, `@Audited`, error logging as required
  - [ ] `PLT-1005-T3-S3` 🤖 Refactor; update RBAC-matrix fixture, i18n keys, SSOT/docs as applicable
- [ ] **PLT-1005-T4** — Extract the template's tabbed-form/card/row patterns into reusable components (as-is) for School Setup and Academic screens
  - [ ] `PLT-1005-T4-S1` 🤖 Build the screen/component from the approved template's components, tokens and patterns — as-is, no redesign
  - [ ] `PLT-1005-T4-S2` 🤖 Component/hook tests; i18n keys (en/ta/si/ar); RTL, light/dark and mobile checks; template visual-regression
  - [ ] `PLT-1005-T4-S3` 🤝 Visual check against the template; owner approves any new pattern
- [ ] **PLT-1005-T5** — 👤 Owner reviews the menu additions "School Setup" and "Academic" (authorised template change recorded in `WORKLOG.md`)
  - [ ] `PLT-1005-T5-S1` 👤 Owner reviews the menu additions "School Setup" and "Academic" (authorised template change recorded in `WORKLOG.md`)
- [ ] **PLT-1005-C** — Close-out
  - [ ] `PLT-1005-C-S1` 🤖 Run all gates (typecheck, lint, route-guard/i18n/worklog checks, tests, coverage, build, integration); update `WORKLOG.md` and `TODO.md`; open PR with AC → test table
  - [ ] `PLT-1005-C-S2` 🤖 Independent review in a **fresh session** (Prompt Pack §4.3)
  - [ ] `PLT-1005-C-S4` 👤 Human gate: read the RED commit, verify acceptance criteria by hand, approve merge

---

## Dependency graph

```
PLT-EPIC-01 Auth ──┬──► PLT-EPIC-02 RBAC ──┬──► PLT-EPIC-06 Registry/Settings ──► PLT-EPIC-10 Admin shell
                   │                       │
                   └──► PLT-EPIC-04 Audit ◄┘
PLT-EPIC-03 Licensing ───────────────────────► PLT-EPIC-07 Notification router
PLT-EPIC-05 Diagnostics (minimal 501/502 pulled forward into the kernel)
PLT-EPIC-08 Storage · PLT-EPIC-09 Health (independent)
PLT-107 Superadmin seed needs PLT-101/105/201 · PLT-1002 needs PLT-101/202/204
```

**Critical path:** PLT-EPIC-01 → PLT-EPIC-02 → PLT-EPIC-03 → PLT-EPIC-04, with PLT-107 and PLT-EPIC-10 unlocking the usable admin console.

## Suggested sprint breakdown

| Sprint | Focus |
|---|---|
| 0 | Scaffold, quality gates/CI, API kernel (logger/redaction, errors, config, decorators), PLT-1001, PLT-1003 baseline |
| 1 | PLT-101, 102, 103, 105, **107**, 201 · template port of public pages (PLT-1004) starts |
| 2 | PLT-202–205, PLT-401–402, PLT-1002, PLT-1005 |
| 3 | PLT-301–305, 403–404, 503, 601–602, 701–702(email) |
| 4 | PLT-801–802, 901–903, 504, hardening, milestone close-out |

**Deferred (mobile milestone):** PLT-104 (OTP), PLT-106 (root/jailbreak), push half of PLT-702. **Proposed (not yet numbered):** social login (Google/Microsoft/Apple/Facebook), MFA.

---

*End of EduFlow360 Jira/Epic plan — Platform Core & RBAC + Admin Console v2.0*

## Implementation status appendix (2026-10-16, reference only)


- Docs verified (pnpm docs:verify green).
- v5.3 default superadmin claim is non-authoritative under AGENTS + ADR-003.
- See docs/work/EPIC_STATUS.md for the reconciled measured state.
