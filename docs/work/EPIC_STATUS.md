# Epic status — 2026-10-03 (corrected 2026-10-08, re-measured 2026-10-11 session 2, corrected again 2026-10-13)

> Measured from the tree, not from a plan file. Every figure below was read off the
> code. Where a claim is "0%" that means **no production code exists**, not that it is
> partially built.
>
> **2026-10-13 corrections (three stale rows, measured against `main` at `8aee552`):**
> the forgot-password and reset-password pages **exist** (`PLT-105` shipped — see the
> table below); `PLT-EPIC-07`'s "`PLT-105` depends on it" blocker is **resolved** at the
> adapter level (the `IEmailDelivery` port + `SmtpEmailAdapter` were pulled forward,
> `ADR-014`; the router itself is still 0%); and `PLT-EPIC-10` was missing from this
> table entirely — added below. The status block was **corrected, not bumped**, per the
> 2026-10-11 entry's reasoning.

**Legend:** âœ” done í’¦ partial âš  blocked âŒ not started

| Epic          | Name                                | Pts | State       | Evidence                                                                                                        |
| ------------- | ----------------------------------- | --- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `PLT-EPIC-01` | Authentication & Session Management | 34  | ✅ **~95%** | Password sign-in, OIDC, bootstrap/setup, password reset and `POST /auth/sign-out` all live and proven over a real socket; `PLT-105` shipped 2026-10-11. **Session-security defect found and fixed in a real browser 2026-10-11** (PR #5): the sign-out screen called a ROOT-RELATIVE URL that resolved against the web app origin, so the session was never revoked while the UI claimed it was. Remaining: `PLT-104`/`PLT-106` are mobile, milestone 2 |
| `PLT-EPIC-02` | Dynamic RBAC & Policy Engine        | 42  | ~75%      | Catalogue, 5 system roles and seed built; ownership engine and permission cache built. **`SEC-110` closed 2026-10-05** â€” the shipped `PermissionGuard` now receives all four of its tokens, so `PLT-203` AC-2 holds in practice. T3-T6 of `PLT-205` open. Committed and merged (2026-10-11). |
| `PLT-EPIC-03` | Licensing & Entitlement Enforcement | 29  | ðŸŸ¢ ~90%     | `PLT-301`/`302` + `PLT-304`/`305` shipped 2026-10-11 (validator, `EntitlementGuard`, cache, offline `.lic` activation, grace window). Remaining: `PLT-303`'s serial-key exchange needs an activation server that does not exist â€” recorded as a gap |
| `PLT-EPIC-04` | Immutable Audit Logging             | 21  | ðŸŸ¡ 67%      | `PLT-401` T1/T3 + `PLT-402` T1â€“T3 shipped 2026-10-11 (`@Audited` writes, append-only port, real-Postgres proof incl. ADR-013 rollback); remaining: `PLT-403` viewer (P1, needs shell), `PLT-404` retention (P2) |
| `PLT-EPIC-05` | Error & Diagnostic Logging Engine   | 18  | âŒ 0%       | no DB error log; file logging not implemented                                                                   |
| `PLT-EPIC-06` | Dynamic Module Registry & Settings  | 16  | í’¦ partial  | `SchoolSettings` schema + 2 rules; no registry, no module gate                                                  |
| `PLT-EPIC-07` | Multi-Channel Notification Router   | 13  | âŒ 0%       | **0 router code in `apps/api`**. Its old "`PLT-105` depends on it" blocker is **closed 2026-10-13**: the `IEmailDelivery` port + `SmtpEmailAdapter` were pulled forward for password reset (`ADR-014`), so `PLT-105` shipped; the router is still 0%                                             |
| `PLT-EPIC-08` | Storage & File Manager              | 13  | âŒ 0%       | no `IStorageAdapter`                                                                                            |
| `PLT-EPIC-09` | System Health & Monitoring          | 13  | âŒ 0%       | no probes beyond a boot banner                                                                                  |
| `PLT-EPIC-10` | Admin Console Shell, Template Port & Dev Environment | 29 | in progress | `PLT-1001` done · `PLT-1002` done · `PLT-1003` T2/T3 done (T1 owner-gated, presented) · **T4 next** · `PLT-1004`/`PLT-1005` unbuilt |

**Total: ~105 of 199 points for EPIC-01..09, plus `PLT-EPIC-10` (29 pts, in progress). `PLT-EPIC-01` ~95%. Epic 02 is still the largest block.** Re-measured 2026-10-13: `main` at `8aee552` (PR #15), no open PRs; forgot/reset pages confirmed to exist; `PLT-EPIC-07`'s `PLT-105` dependency closed at adapter level; `PLT-EPIC-10` row added. All `AGENTS.md` §4 gates green except the documented local-only integration case (D42).

---

## The single most important line in this document

> **2026-10-03 it read:** `@RequirePermission` **now enforces.** `@RequireEntitlement`
> and `@Audited` **still enforce and write nothing.** The controls that stop something today
> are `CsrfGuard`, `SessionGuard` and `PermissionGuard`.

> **Corrected 2026-10-13 (measured):** that gap is largely **closed.** `PLT-301`/`302`
> shipped the `EntitlementGuard`, so `@RequireEntitlement` enforces the licence;
> `PLT-402` shipped the audit writer, so `@Audited` writes append-only records
> (proven against real PostgreSQL, including the `ADR-013` rollback case).

What remains true, and is the sentence worth keeping: `check-route-guards` proves a
decorator is **present**. Nothing proves it is **obeyed**. Each decorator's enforcement
therefore lives in its own over-HTTP integration proof
(`permission-engine-over-http`, `licence-activation-over-http`), never in the static
check. `AGENTS.md` Â§4 asks whether a gate is _sound_, not whether it is green. The
2026-09-30 audit found four gates that were green and verified nothing; that failure
class, not any one guard, is what this paragraph exists to prevent.

---

## Frontend: pages that exist, and pages that do not

`apps/web` holds **75 source files** (re-measured 2026-10-13). `features/auth/` exists and is wired to `POST /auth/login`.

| Page            | State             | Evidence                                                                             |
| --------------- | ----------------- | ------------------------------------------------------------------------------------ |
| Sign in         | âœ” real             | `PLT-101` replaced the stub: the page (45 lines) delegates to `features/auth/pages/sign-in-screen.tsx`; form, state hook, request client and specs all exist |
| Forgot password | real (`PLT-105`)  | `app/[locale]/sign-in/forgot/page.tsx` + `features/auth/pages/forgot-password-screen.tsx`, wired to `POST /auth/password-reset/request` (constant 200) |
| Reset password  | real (`PLT-105`)  | `app/[locale]/sign-in/reset/page.tsx` + `features/auth/pages/reset-password-screen.tsx`, wired to `POST /auth/password-reset/confirm` (invalidates sessions) |
| Landing + shell | âœ” real            | `features/landing/`, layout, middleware, i18n routing                                |
All four public auth pages now exist and are wired: `POST /auth/login` verifies, issues a session and sets a real cookie; `POST /auth/password-reset/request` and `/confirm` are shipped behind the `IEmailDelivery` port (nodemailer SMTP in production, `RecordingEmailAdapter` when unconfigured). What remains is presentation work (`PLT-1004` re-styles them from the approved template), not plumbing.

---

## The frontend template: what it gives and what it does not

`docs/template/EduFlow - Frontend Template.html` (34.4 KB) is a **source of tokens and
direction, not of screens.** Per `AGENTS.md` Â§2.8:

| Asset                                                          | Verdict                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Light/dark token set                                           | âœ” harvest in full                                                                                           |
| RTL pattern (`dir` on `<html>`, rules under `html[dir="rtl"]`) | âœ” harvest the pattern                                                                                       |
| Application i18n keys                                          | âŒ **21 keys, all landing-page marketing copy, ZERO application keys**                                      |
| RTL implementation                                             | âŒ **4 CSS rules** mirroring a landing page â€” no sidebar, form, table, logical properties or icon mirroring |
| `prefers-reduced-motion`                                       | âŒ absent                                                                                                   |
| Marketing claims                                               | âŒ **false** â€” "Trusted by 200+ schools", "1.2M Students Managed" â€” and do not carry them over              |

**Consequence for planning:** every string on a login or reset page must be authored into
`en.json`, `ta.json`, `si.json`, `ar.json`, and Arabic RTL app-shell layout is built from
scratch. That is real work, and it is the same work three times over if built page by page â€”
which is why the sign-in page is worth doing **first** and doing properly.

---

## Why forgot/reset password was blocked — RESOLVED 2026-10-11 (section kept as history)

`PLT-105` Password Reset Flow shipped 2026-10-11: `POST /auth/password-reset/request`
emails a signed, single-use, time-limited link; `/confirm` sets the password and
invalidates all existing sessions; both pages exist and are wired (see the table above).
The email dependency was resolved by **pulling the adapter forward**: `IEmailDelivery`
with `SmtpEmailAdapter` (nodemailer) in production and `RecordingEmailAdapter` when
unconfigured (`ADR-014`). What remains for this area is `PLT-EPIC-07`'s router — the
adapter is the email channel it will own.

---

## Recommended order — 2026-10-03, SUPERSEDED (kept as history)

| # | Work | Status 2026-10-13 |
| --- | --- | --- |
| 1 | **Sign-in page** | done (`PLT-101`) |
| 2 | **Permission engine (`PLT-2xx`)** | done (`PLT-201..205`, `SEC-110`) |
| 3 | `PLT-402` audit writer | done 2026-10-11 |
| 4 | `PLT-701` email adapter | adapter pulled forward (`ADR-014`); **router still 0%** |
| 5 | `PLT-105` reset flow | done 2026-10-11 |

**Still owed by the owner, recorded not hidden:** the password policy is invented —
length bounds only, marked `provisional: true` (`SSOT.md` D62). `AGENTS.md` §6 forbids
inventing a threshold to fill a corpus gap, and `EduFlow_School_Setup_Workflow_v1.md` §4
defers the policy, but `PLT-107`'s acceptance criteria demand one.

Also open: no **unlink** route exists, so a user who links the wrong Google account is
stuck; and `SetupTokenService.consume` may be dead code while `FakeSetupTokenRepository.consume`
invents a state the real adapter cannot produce.

