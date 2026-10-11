# Resume — for the session after 2026-10-11 21:30 (session 2)

> **Supersedes** `docs/work/RESUME_2026-10-11.md` — read this file whole;
> it is self-contained and carries the state forward. Companion:
> `docs/work/WORKLOG.md` (six entries for 2026-10-11, newest first) and
> `docs/work/EPIC_STATUS.md` (the epic table).
>
> **Read this file, then the newest WORKLOG entry, then the Jira epic
> `docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md`.**

## State of the tree (2026-10-11 21:30)

- **`main` is `89dbff1`, clean, pushed.** Everything this session and the
  previous one produced is merged. **No open PRs.**
- Merged in this session, in order, per the ordering rule the previous
  handover recorded:

  | PR | Branch | Content | Merge notes |
  |---|---|---|---|
  | **#4** | `fix/env-local-precedence` | ENV-01 `.env.local` precedence + SEC-116 preflight CORS | direct |
  | **#2** | `feat/plt-304-305-activation-grace` | `PLT-304` offline activation + `PLT-305` grace window | conflicted in `TODO.md` header only |
  | **#3** | `feat/auth-screens-approved-template` | `PLT-105` T3 auth screens + `POST /auth/sign-out` | conflicted in `TODO.md` + 2 `WORKLOG.md` hunks |
  | **#5** | `fix/sign-out-relative-url` | the sign-out defect (below) | direct |

  Both conflicts were **docs-only and mechanical**. `branch:main` protection
  enforces `CI` + `Secret scan` with `enforce_admins`, so `gh pr merge` is the
  path — a direct push to `main` is refused.
- Test totals now: **API 91 files / 1,474 tests** · **web 21 files / 212
  tests** (+2 files, +14 cases this session).

## What this session did

1. **Updated git** — merged #4 → #2 → #3, resolving the predicted
   guard-registry conflicts (none: they were additive inserts and merged
   cleanly; only the two docs files conflicted).
2. **Ran a real Chrome through the running dev stack** (the lesson is the
   method — see SEC-116 below; it still holds). Verified: landing renders in
   light and dark, the dark branch of `prefers-color-scheme` actually
   executes (a gap `AUD-30-04` recorded — Playwright never hit it), `/ar`
   gives `dir=rtl` + `lang=ar` with the correct `Noto Naskh Arabic` stack,
   sign-in matches the approved template structure, **the full login cycle
   works**, and sign-out **did not**.
3. **Compared the two approved templates** — findings that gate
   `PLT-EPIC-10` are under "What is next".
4. **Found, root-caused, fixed and merged a session-security defect** —
   below. This was the highest-value hour of the session.

## The defect: sign-out was a no-op that lied to the user

Measured in the browser before any change:

| request | result |
|---|---|
| `fetch('/auth/sign-out')` — what the code did | **404** — an HTML page from Next.js |
| `fetch('http://localhost:3001/auth/sign-out')` — the API | **200** `{"signedOut":true}` |

`pages/signed-in-screen.tsx` used a **root-relative URL**, which the browser
resolves against the *web* app's origin (`:3500`), not the API's (`:3001`).
The handler read no status and unconditionally ran `window.location.replace`,
so clicking "Sign out" showed the sign-in page and the message "You have
been signed out." **while the session row stayed live and the cookie stayed
valid** — `GET /permissions/me` answered **200 with the full permission
list**. On a shared machine that is one Back-click from a session the user
believed they had ended.

**Why every suite was green.** Each auth test asserted the *redirect*; none
asserted the request *reached the API*. And the e2e suite provisions a web
server only — no session — so nothing could catch it there either.

**The fix** (TDD, RED → GREEN, checkpoints preserved on the merged branch):

- `features/auth/sign-out-request.ts` (new) — the wire contract on
  `sign-in-request.ts`'s pure-function pattern. The URL comes from
  `signOutEndpoint` → `apiUrl`, the one module that knows where the API
  lives, so **no call site can name a path the API does not serve**.
- `classifySignOutResponse` — `signedOut` is the only outcome that means the
  session is ended. **The redirect is now earned**: a 403 (`CsrfGuard`
  refused, nothing revoked), a network failure, and any unexpected status —
  including the 404 the defect itself produced — keep the user on a screen
  that says the sign-out failed and the session is still active.
- `signOutHeaders` shares one header set with `signInHeaders` instead of
  duplicating it.
- `sendSignOut` also catches, closing the unhandled rejection the old handler
  produced on a network failure.

**Verified in a real browser:** after the fix, clicking sign out leaves
`/permissions/me` answering **401**; the session row carries `revokedAt`
(was `null`); the `SIGN_OUT` audit row is written with the correct
`actorId`.

**The RED commit is the thing to read first** — it asserts the outbound
URL, which is the assertion whose absence let this ship.

## The login path (unchanged, re-verified this session)

The local database still ships with **no stored credentials** by design — the
seed creates a password-less `SCHOOL_ADMIN` bootstrap account in `PLT-107`'s
invited state. The local admin is now **ACTIVE** (it was activated through
this flow during the browser test), so a fresh session can simply sign in:

```
POST /auth/login  { identifier: "admin@school.lk", password: "Admin@360#12" }
GET  /permissions/me  with the cookie   → 200
POST /auth/sign-out   with the cookie   → 200
GET  /permissions/me  with the OLD cookie → 401   ← works now
```

`Admin@360#12` is the owner's local password. **Consequence:** the local
`database-contract` D42 assertion ("the seed never creates a password") fails
locally and passes in CI on a fresh database — do not weaken D42 to fix it.

**Open gap, still worth a ticket:** no local tooling to mint a setup token.
A `dev:setup-token` script, or seed support for `SEED_ADMIN_PASSWORD`, would
make a fresh local environment reachable without hand-minting a
`sha256(plaintext)` token. **The owner has not ruled on the shape.**

## What is next

### 1. `PLT-EPIC-10` — the app shell (recommended next epic)

The template it reproduces is the approved
`docs/template/EduFlow360_Template_Admin_Dashboard.html`, and the
owner-authorised 2026-10-09 menu change (`School Setup` + `Academic` groups)
is already in it. Menu groups: Overview, Academics, Finance, Operations,
Community, Administration. Breakpoints: 1000px + 860px drawer with scrim.

### 2. BUT apply the `--brand2` token fix first — it is a real blocker

Verified by reading the computed styles off the running app:

| Token | Both approved templates | `packages/ui-kit` | Consequence |
|---|---|---|---|
| `--brand2` | `#7c3aed` | **named `--brand-2`** | `var(--brand2)` is `null` at runtime. The dashboard template's `.item.active` and `.prog i` gradients **render as nothing** if the CSS is copied verbatim. |
| `--warn` | declared in Admin_Dashboard | **absent** | add it — one line |
| `--radius` | Landing_Auth `--radius:14px`; Admin_Dashboard hardcodes `16px`/`9px` | `--radius-card:14px`, `--radius-control:9px` | values already agree; name the dashboard's literals to tokens |

Fix: rename `--brand-2` → `--brand2` in the kit (or alias it) and add
`--warn`, before any dashboard CSS is written. This is a one-line change that
prevents a silent visual null.

### 3. Then, in order

- `PLT-403`'s audit viewer (its API half can ship before the shell) — the
  first screen where `@RequirePermission('AUDIT_READ')` meets a real user.
- `PC-000`…`PC-006` — they gate every feature module and are still unwritten.
- `FIX-11` (shadcn components), `FIX-12` (font subsets).

## Known gaps and debts (all recorded, none invented)

- **`tsconfig` excludes `**/*.spec.ts` from typecheck** — spec fixtures can
  drift from production types silently. Discovered 2026-10-11 when a
  `LicenceCacheState.graceUntil` addition made a stale fixture and
  `pnpm typecheck` still passed. Needs an owner decision (speed vs fixture rot).
- **`@RequireEntitlement` still guards no route** — the enforcer exists; the
  shell's first licence-gated screen is its acceptance test.
- **No authenticated e2e coverage at all.** The suite provisions a web server
  only; an authenticated flow needs a session factory (API provisioning,
  seeding, an admin). This is exactly why the sign-out defect survived; a
  session factory is real scaffolding and worth a ticket.
- **Two dashboards exist in the templates and they invite the wrong pick.**
  `Template_Landing_Auth.html` also contains a `view-dashboard` with a
  smaller 3-section sidebar; it is **superseded** by the standalone
  `Template_Admin_Dashboard.html`, which carries the owner-authorised menu
  change. Worth a one-line note in `docs/template/` saying which is
  authoritative for `PLT-EPIC-10`.
- **The landing page bypasses `ui-kit` entirely** (a local
  `landing.css` with its own button system). It is the pattern that will
  repeat if unchecked.
- **`Template_Landing_Auth.html` has zero `@media` queries** — it is not
  responsive. The app's landing page already is (e2e-verified at 6
  viewports), so this is a deliberate, correct deviation from a
  "reproduce as-is" template; it is undocumented.
- A **pre-existing** `act(...)` warning comes from
  `reset-password-form.spec.tsx` (shipped in PR #3), not from anything here.
- `PLT-303`'s activation-server exchange — no server exists.
- A `favicon.ico` 404 on every page (cosmetic).

## Local dev quick reference

```
pnpm dev                                    # API :3001, web :3500
pnpm typecheck && pnpm lint && pnpm test --force
node scripts/check-route-guards.mjs         # every route guarded
pnpm test:integration                       # needs PostgreSQL
psql is NOT installed locally — query the DB with a throwaway
@prisma/client script, or with docker exec if you start the container.
```

`DATABASE_URL` for that script:
`postgresql://eduflowdbuser:eduflow123@localhost:5432/eduflow360db?schema=public`.

## Quality gates (all green on `main`, verified locally and in CI)

`typecheck 8/8 · lint 8/8 · format:check · route-guards · coverage-tiers ·
docs:verify 263 refs · build 9/9 · unit (re-run with --force, 0 cached) API
1,474 + web 212 · CI + Secret scan green on every PR.` The full local suite
takes roughly five minutes; the integration suite needs real PostgreSQL.
