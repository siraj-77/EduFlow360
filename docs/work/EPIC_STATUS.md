# Epic status — 2026-10-03

> Measured from the tree, not from a plan file. Every figure below was read off the
> code. Where a claim is "0%" that means **no production code exists**, not that it is
> partially built.

**Legend:** ✔ done 풦 partial ⚠ blocked ❌ not started

| Epic          | Name                                | Pts | State       | Evidence                                                                                                        |
| ------------- | ----------------------------------- | --- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `PLT-EPIC-01` | Authentication & Session Management | 34  | 풦 **~90%** | 5 routes live and tested over a real socket; `PLT-105` not started; `PLT-104`/`PLT-106` are mobile, milestone 2 |
| `PLT-EPIC-02` | Dynamic RBAC & Policy Engine        | 42  | ~75%      | Catalogue, 5 system roles and seed built; ownership engine and permission cache built. **`SEC-110` closed 2026-10-05** — the shipped `PermissionGuard` now receives all four of its tokens, so `PLT-203` AC-2 holds in practice. T3-T6 of `PLT-205` open. Still uncommitted. |
| `PLT-EPIC-03` | Licensing & Entitlement Enforcement | 29  | ❌ 0%       | no entitlement code; `ARC-10` capability keys outstanding                                                       |
| `PLT-EPIC-04` | Immutable Audit Logging             | 21  | ❌ 0%       | `@Audited` writes **nothing**; `audit-immutability.sql` unwired                                                 |
| `PLT-EPIC-05` | Error & Diagnostic Logging Engine   | 18  | ❌ 0%       | no DB error log; file logging not implemented                                                                   |
| `PLT-EPIC-06` | Dynamic Module Registry & Settings  | 16  | 풦 partial  | `SchoolSettings` schema + 2 rules; no registry, no module gate                                                  |
| `PLT-EPIC-07` | Multi-Channel Notification Router   | 13  | ❌ 0%       | **0 notification code in `apps/api`** — and `PLT-105` depends on it                                             |
| `PLT-EPIC-08` | Storage & File Manager              | 13  | ❌ 0%       | no `IStorageAdapter`                                                                                            |
| `PLT-EPIC-09` | System Health & Monitoring          | 13  | ❌ 0%       | no probes beyond a boot banner                                                                                  |

**Total: ~100 of 199 points. Epic 02 is partly built and still the largest block.** Re-measured 2026-10-05: **2 of 34 stories complete** (`PLT-107` adds 5 pts), ~35 of 206 points. All ten `AGENTS.md` §4 gates are green.

---

## The single most important line in this document

> **Partly closed 2026-10-03.** `@RequirePermission` **now enforces.** `@RequireEntitlement`
> and `@Audited` **still enforce and write nothing.** The controls that stop something today
> are `CsrfGuard`, `SessionGuard` and `PermissionGuard`.

`check-route-guards` proves a decorator is **present**. Nothing proves it is **obeyed**.
That is the same shape as the defect where the shipped app could not boot: nine green
gates, no enforcement. `AGENTS.md` §4 asks whether a gate is _sound_, not whether it is green.

---

## Frontend: pages that exist, and pages that do not

`apps/web` holds **35 source files**. `features/auth/` exists and is wired to `POST /auth/login`.

| Page            | State             | Evidence                                                                             |
| --------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Sign in         | ⚠ **stub**        | `app/[locale]/sign-in/page.tsx` is 61 lines with **0 form controls and 0 API calls** |
| Forgot password | ❌ does not exist | no route, no page                                                                    |
| Reset password  | ❌ does not exist | no route, no page                                                                    |
| Landing + shell | ✔ real            | `features/landing/`, layout, middleware, i18n routing                                |
The **backend** for sign-in exists and is tested: `POST /auth/login` verifies, issues a
session and sets a real cookie, exercised over a socket. So the login page is the one
session and sets a real cookie, exercised over a socket. So the login page is the one
auth page that is buildable today.

---

## The frontend template: what it gives and what it does not

`docs/template/EduFlow - Frontend Template.html` (34.4 KB) is a **source of tokens and
direction, not of screens.** Per `AGENTS.md` §2.8:

| Asset                                                          | Verdict                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Light/dark token set                                           | ✔ harvest in full                                                                                           |
| RTL pattern (`dir` on `<html>`, rules under `html[dir="rtl"]`) | ✔ harvest the pattern                                                                                       |
| Application i18n keys                                          | ❌ **21 keys, all landing-page marketing copy, ZERO application keys**                                      |
| RTL implementation                                             | ❌ **4 CSS rules** mirroring a landing page — no sidebar, form, table, logical properties or icon mirroring |
| `prefers-reduced-motion`                                       | ❌ absent                                                                                                   |
| Marketing claims                                               | ❌ **false** — "Trusted by 200+ schools", "1.2M Students Managed" — and do not carry them over              |

**Consequence for planning:** every string on a login or reset page must be authored into
`en.json`, `ta.json`, `si.json`, `ar.json`, and Arabic RTL app-shell layout is built from
scratch. That is real work, and it is the same work three times over if built page by page —
which is why the sign-in page is worth doing **first** and doing properly.

---

## Why forgot/reset password is blocked, and it is not only "not started"

`PLT-105` Password Reset Flow — **5 pts, P0, `backend` + `frontend`** — is a written story with
no code. Its acceptance criteria:

- `POST /auth/password-reset/request` emails a signed, time-limited link
- `POST /auth/password-reset/confirm` sets the password and **invalidates all existing sessions**
- single-use token, configurable expiry (~1 hour)
- **Frontend:** reset request + reset confirmation pages

**And it has a documented dependency that is easy to walk into:**

> `PLT-105` (password reset) needs to send email before the router (`PLT-701`) exists — pull the
> **email adapter** forward

There is **0 notification code in `apps/api`**. Building the reset _pages_ now means building
forms against an endpoint that cannot exist yet. Whether to pull the `PLT-701` email adapter
forward is an **owner call**, not a build order.

---

## Recommended order, and the reasoning

| #   | Work                                         | Why now                                                                                                                                      |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Sign-in page**                             | The only auth page whose backend is proven. It exercises tokens, i18n and RTL **before** three more auth pages are built on an unproven one. |
| 2   | **Permission engine (`PLT-2xx`)**            | Turns `@RequirePermission` from vocabulary into control. 42 points, the largest single block, and the biggest soundness gap in the repo.     |
| 3   | `PLT-402` audit writer                       | `@Audited` is on sensitive routes and writes nothing. `AGENTS.md` §2.7 requires append-only records with DB-level immutability.              |
| 4   | `PLT-701` email adapter ⚠ **owner decision** | Unblocks `PLT-105`, and therefore forgot/reset.                                                                                              |
| 5   | `PLT-105` reset flow                         | Once 4 exists.                                                                                                                               |

**Two items owed by the owner, recorded not hidden:**

1. **The password policy is invented** — length bounds only, marked `provisional: true` (`SSOT.md` D62).
   `AGENTS.md` §6 forbids inventing a threshold to fill a corpus gap, and
   `EduFlow_School_Setup_Workflow_v1.md` §4 defers the policy, but `PLT-107`'s acceptance criteria demand one.
2. **Pull the `PLT-701` email adapter forward, or not** — this is what blocks `PLT-105`.

Also open: no **unlink** route exists, so a user who links the wrong Google account is stuck;
and `SetupTokenService.consume` may be dead code while `FakeSetupTokenRepository.consume`
invents a state the real adapter cannot produce.
