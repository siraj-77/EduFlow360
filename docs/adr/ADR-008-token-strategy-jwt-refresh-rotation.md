# ADR-008 — Token Strategy: Short-Lived Access JWT, Rotating Refresh with Family Reuse Detection

**Status:** ✅ **Accepted 2026-09-30 (owner)**
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-B)
**Affects:** `PLT-101`, `PLT-102`, `PLT-103` · `AGENTS.md` §2.2
**Source:** Prompt Pack §2.1 (D-B) · Master Plan §5 "Authentication (JWT, OTP, Sessions, Token Rotation)"

---

## Context

Every request needs an authenticated caller, and a school runs all day on a shared device — a teacher's tablet in a staff room, a gate kiosk, a reception PC. So the system needs short-lived credentials so a forgotten or stolen session stops working quickly, **and** a renewal mechanism so users are not forced to log in several times a day.

That combination is the entire difficulty. A long-lived refresh token is a bearer credential: whoever holds it *is* the user, for its whole lifetime. A short access token alone is unusable ergonomically. The design has to make a stolen refresh token have a bounded window of usefulness **and** make revocation actually work — because `PLT-103` requires that revoking a session takes effect on the **next request**, not at the next refresh, and that a role change forces re-authentication within one request cycle.

The last requirement rules out stateless-only JWTs. A stateless access token cannot be revoked before it expires, so a role change would not take effect for the token's remaining lifetime.

## Decision

**Access token:** JWT, **~15 minutes**.
**Refresh token:** opaque, **~7 days**, **single-use with rotation**, stored server-side.

- **Refresh tokens rotate on every use.** Using a refresh token invalidates it and issues a new pair.
- **Tokens belong to a family.** Every token issued from one login shares a family ID.
- **Reuse detection:** presenting an already-rotated refresh token means the token was captured and replayed, so **the entire family is revoked** and the user must log in again. This is the standard OAuth 2.0 BCP response and it converts silent theft into a detectable, recoverable event.
- **Access-token expiry is enforced server-side on every protected route**, never trusted from the client (`PLT-102`).
- **Session state is server-side** (a `Session` record per login), which is what makes immediate revocation possible. Sessions track device, IP and last-active.
- **Role change forces re-authentication** within one request cycle, integrating with `PLT-103`.
- **Secrets come from the environment.** `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are separate values (`AGENTS.md` §11), and startup fails naming any missing variable.

### Mandatory tests

| Test | Why |
|---|---|
| Expired access token rejected | Boundary |
| Reuse of a rotated refresh token ⇒ **whole family revoked** | The core of the design |
| **Concurrent refresh race** — two simultaneous refreshes with one token | Real behaviour under a mobile client retrying on a flaky network. One must win; the other's rejection must **not** nuke the family, or every user on a poor connection gets logged out |
| Revoked session invalid on the **next request**, not the next refresh | `PLT-103`'s acceptance criterion |
| Tokens never appear in logs or responses | `AGENTS.md` §2.13 redaction |

## Consequences

### Positive
- A stolen access token is useless within 15 minutes.
- A stolen refresh token is detected on its **next** use, and the whole family dies — so theft cannot be sustained silently.
- Immediate revocation is possible, which is what makes `PLT-103` and role-change enforcement work.
- Server-side sessions give an administrator a real answer to "who is logged in, from where" — needed for a school's incident response.

### Negative / accepted costs
- **A database read per protected request** for session/revocation state. Mitigated by the Redis permission cache in ADR-012 and by the fact that this is one small lookup on a per-school deployment.
- **Refresh adds a round trip** roughly every 15 minutes. Acceptable; a silent background refresh in the web client handles it.
- **The concurrent-refresh case is subtle and easy to get wrong.** A naive implementation treats the loser's rejection as reuse and revokes a legitimate session. This is why it is called out as a mandatory test.
- **Refresh tokens must be stored**, so they are sensitive data at rest and must be hashed or otherwise protected, and must never be logged.

### Neutral
- `PLT-104` (OTP login) is milestone 2 (`AGENTS.md` §7 D5) and issues tokens through this same path.
- `PLT-106` (jailbreak detection) is also milestone 2.

## Rejected alternatives

**❌ Long-lived access tokens (hours or days).** Rejected: revocation cannot be prompt, so a role change or a session revoke would not take effect for hours. Directly conflicts with `PLT-103`.

**❌ Stateless refresh tokens (no server-side record).** Rejected: the same revocation problem, plus no family reuse detection, so a stolen refresh token is valid for its full lifetime with no way to notice.

**❌ No rotation — one long-lived refresh token, reused freely.** Rejected: a stolen token is indistinguishable from normal use. It cannot be detected, so it cannot be revoked.

**❌ Server sessions instead of JWTs (opaque access tokens).** Rejected: fully valid, and it would simplify revocation further. Rejected only because `SRS` §3.1 and the Prompt Pack both specify JWT, and the stateless access token is cheaper per request on a deployment already reading session state for revocation. **This is the closest call in this ADR** — if per-request cost ever dominates, opaque access tokens are the better answer.

**❌ Store refresh tokens in `localStorage`.** Rejected: readable by any XSS on the page. An httpOnly, SameSite cookie is the correct carrier; the token itself stays server-side.

## Links
- `AGENTS.md` §2.2, §2.13, §11 · Master Plan §5
- `PLT-101`, `PLT-102`, `PLT-103`, `PLT-104` (M2), `PLT-106` (M2)
- `docs/adr/ADR-007-password-hashing-argon2id.md`, `ADR-012-permission-catalogue-in-code.md`

## Revisit when
- Refresh is needed from a client that cannot keep an httpOnly cookie (a native mobile app in milestone 2) — a short-lived in-memory token plus a platform-secure refresh store is the pattern then, and the family/rotation logic is unchanged.
