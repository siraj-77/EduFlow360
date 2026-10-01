### Story PLT-107: First-Administrator Bootstrap via a One-Time Setup Token

- **As a** school's principal **I want to** claim this installation by entering a one-time setup token **so that** a fresh deployment can have its first administrator without a seed script, a database console, or a shipped default password.
- **Status:** ✅ **Approved by owner 2026-09-30** (`D-4.3`). Story written 2026-09-30. **Not started.**
- **Decides, not defers:** `EduFlow_School_Setup_Workflow_v1.md` §6.5 (Phase 3, first launch, first administrator) requires this and **no existing story covered it**. `PLT-101` is ordinary credential login and cannot deliver it.
- **Why not a seed script:** a seed is cheaper and adequate for _one database per school_ (`ADR-003`), but it leaves the **documented** first-launch workflow unimplementable, so §6.5 would need amending instead. The seed then falls out of this story as a dev convenience rather than becoming the production path. The owner's decision, recorded.
- **Depends on:** `PLT-101` (this consumes the credential-setting path it builds). **Blocks:** `PLT-101` acceptance, and therefore all of Epic 01.

**The schema question, answered here rather than discovered during implementation**

There is **no setup-token table**. `UserStatus.INVITED` and a nullable `User.passwordHash` exist and are exactly the state this flow ends in — but nothing holds the _token_. Two options, and the choice matters because it decides whether this is a **sixteenth model**:

| Option                                                                                        | Shape                                                   | Verdict                                                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **(a) `SetupToken` model** — hash, expiry, consumed-at, issued-for                            | General: any number of pending invites, one table       | The right answer for **`PLT-104` OTP**, which is milestone 2 and needs many |
| **(b) Columns on `User`** — `setupTokenHash`, `setupTokenExpiresAt`, on the one `INVITED` row | No new model. Exactly one bootstrap, ever, per database | ✅ **Chosen for this story**                                                |

**(b), because the first administrator is singular.** A dedicated table for exactly one row that is written once and consumed once is a generalisation with one instance, and a sixteenth model trips three registration points (`PLATFORM_CORE_MODELS`, `PLATFORM_CORE_ENTITIES`, `CLUSTER`) for no present benefit. `PLT-104` will need (a) for many concurrent invites, and promoting these two columns into a table at that point is a small, honest migration.

⚠️ **Consequence to state now:** under (b), a deployment that loses its setup token has **no in-product recovery** and must use a console, because there is exactly one row and no second copy. That is acceptable for a single-school install and would not be for a hosted product. Recorded rather than hidden.

**Tasks:**

- [ ] Add `setupTokenHash String?` (`@map("setup_token_hash")`) and `setupTokenExpiresAt DateTime?` to `User` in `schema-source.mjs`, both nullable
- [ ] **Never store the token in the clear** — hash it. Same rule as `RefreshToken.tokenHash` (`AGENTS.md` §2.13)
- [ ] `POST /auth/setup/complete` — accepts `token` + `email` + `username` + `password`, and sets the credential
- [ ] Token is **single-use**: consumed atomically, so two concurrent claims cannot both succeed
- [ ] Reject an expired token, and reject a second claim on a consumed one
- [ ] Generate the token with a CSPRNG (`IClock`'s sibling for randomness — the codebase already requires an injected id generator, §2.4)
- [ ] `mustChangePassword` stays `false`; the user chose this password deliberately
- [ ] `@Audited('SETUP_COMPLETE')` on the completion route (`AGENTS.md` §2.3 — this is a sensitive action)
- [ ] `@Public('<reason>')` on that route, with the reason recorded in the checked-in allowlist — it is the **only** unauthenticated write in the system
- [ ] Rate-limit the route. It is unauthenticated, so this is the only thing standing between an attacker and the administrator account
- [ ] A dev-only `seed.mjs` may set a token for local convenience; it must not be reachable in a production build
- [ ] Update `docs/diagrams/ERD_PLATFORM_CORE.md` §5 question 1, which this story answers

**Acceptance Criteria:**

- Given a valid, unexpired setup token, when `POST /auth/setup/complete` is called with a compliant password, then the user becomes `ACTIVE` with `passwordHash` set, `mustChangePassword` is `false`, and the token is consumed.
- Given a token that has already been consumed, when the same request is repeated, then it is **rejected** with 409, and no second administrator is created.
- Given two concurrent requests presenting the same token, then **exactly one** succeeds and one is rejected. The consumption is atomic, not a read-then-write. _(This is the case a naive implementation passes and this one must not.)_
- Given an expired token, then it is rejected with a distinct status, and the error does **not** reveal whether the token ever existed.
- Given a password that fails the password policy, then the token is **not** consumed, so a rejected attempt does not burn the school's only way in.
- Given the completion request, then an `audit_records` row exists with action `SETUP_COMPLETE`, and the response and logs contain **no** token and **no** password (`AGENTS.md` §2.13).
- Given no setup token has been issued, then the route returns 404 rather than 403 — an unenrolled deployment does not advertise the endpoint.
- Given more than N attempts from one source, then the route is rate-limited and returns 429.

**Story Points:** 5 | **Priority:** P0 | **Labels:** `backend`, `security`

**Not in this story, and deliberately:**

- **`PLT-104` OTP** — many concurrent invites, needs a real `SetupToken` table, milestone 2.
- **Recovery when the token is lost** — a console procedure, documented, not a product feature under (b).
- **`PLT-101` itself** — the login path this consumes.

**Definition of Done:** unit + integration tests for every AC above, including the concurrency case against a real PostgreSQL (not a mock — the atomicity claim is a database claim); the `@Public` reason present in the allowlist; the RBAC permission-matrix fixture updated if any other route is touched.

_Refs: `D-4.3`, `ADR-003`, `ADR-007`, `AGENTS.md` §2.3, §2.4, §2.13, §3, `EduFlow_School_Setup_Workflow_v1.md` §6.5, `D-4.1` (`UserRole`), `PLT-101`, `PLT-104`_
