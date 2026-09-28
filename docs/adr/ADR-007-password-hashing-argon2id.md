# ADR-007 — Password Hashing: argon2id Behind `IPasswordHasher`

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-A)
**Affects:** `PLT-101`, `PLT-105` · `AGENTS.md` §2.2, §5.1
**Source:** Prompt Pack §2.1 (D-A) · `AGENTS.md` §5.1 (auth logic is on the legacy reuse whitelist)

---

## Context

EduFlow holds credentials for staff, teachers, students and parents. A breach of this table exposes every account in one school, and the same credential may be reused across schools — so the blast radius is not one school.

`AGENTS.md` §5.1 places login and authentication logic on the legacy **reuse whitelist**, which includes password hashing. That creates a specific risk: the legacy implementation's algorithm and cost factor are a *security parameter*, not a detail. Porting a cost factor chosen for different hardware or a different threat model would silently weaken it.

## Decision

**`argon2id`, behind an `IPasswordHasher` port.**

- **Verify-and-rehash:** on successful login, if the stored hash uses an older algorithm or a weaker cost, re-hash with the current parameters and replace it. This is the migration path for any legacy bcrypt hash admitted under the reuse whitelist — no forced reset, no user-visible change.
- **Parameters are configuration**, not constants (`AGENTS.md` §2.14 — settings is a first-class subsystem). Argon2 is tuned for memory hardness, so the cost parameters depend on the target hardware; a school's deployment may be a small VM. Hard-coding a factor picked on a laptop is how a strong default becomes a weak one.
- **Timing-safe comparison** is used for verification. A naive `===` on a hash leaks information through response time.
- **The hash is never returned in any API response and never logged** (`PLT-101` acceptance criteria). Not truncated, not masked — absent.
- **Generic authentication errors.** A login failure never reveals whether the email exists, the password was wrong, or the account is locked (`PLT-101`; see the user-enumeration test in the Prompt Pack §7 row for `PLT-101`).

## Consequences

### Positive
- Memory-hard, so GPU cracking gains far less than it does against bcrypt.
- Current parameters apply to every user over time, via rehash-on-login, with no migration project.
- The port means the algorithm can change again without touching a use-case (`AGENTS.md` §2.2, SOLID-L).
- Configuration-driven cost lets a small deployment tune without a code change.

### Negative / accepted costs
- **Memory-hard hashing is expensive per hash.** On a small school VM with concurrent logins at start of day, the memory cost is the real constraint. This is why the parameters are configurable rather than a library default.
- Argon2 support requires a native module in the NestJS build, so the container needs a compatible platform target. A real deployment consideration, resolved in `REPO-06`.
- Rehash-on-login silently rewrites the stored hash, so `PLT-401`'s "audit table is immutable" rule does **not** apply here — the user row legitimately changes. Worth stating, because "never mutate a credential record" would otherwise look like a rule.

### Neutral
- The legacy whitelist still governs the *login logic* (credential verification, reset flow, session handling, CSPRNG temporary passwords) — this ADR governs only how a password is stored.

## Rejected alternatives

**❌ bcrypt.** Rejected: CPU-hard only, so it degrades against GPU attack, and its 72-byte input limit silently truncates longer passwords. Retained only as a **legacy read path** under verify-and-rehash.

**❌ scrypt.** Rejected: sound, but argon2id is the current recommendation and has better side-channel and parallel-attack characteristics. `AGENTS.md` §8 forbids adding libraries without instruction; swapping later means implementing `IPasswordHasher` twice, which the port makes cheap.

**❌ Node's built-in `crypto.scrypt`.** Rejected: no memory-hard option and no standard parameter encoding, so an upgrade is not transparent.

**❌ Hard-code the cost factor.** Rejected: a factor is only correct relative to target hardware. A school on a small VM and a school on a dedicated host need different values, and `AGENTS.md` §2.14 forbids constants for exactly this kind of value.

**❌ Store passwords reversibly for an administrator to read.** Rejected: defeats the purpose. No school administrator can read a user's password.

## Links
- `AGENTS.md` §2.2, §2.14, §5.1 (whitelist) · `PLT-101`, `PLT-105`
- `docs/analysis/LEGACY_REUSE_INVENTORY.md` §3.1 (auth reuse is permitted) · Prompt Pack §6 P5, §7

## Revisit when
- Argon2 parameters change materially, or a memory-hard algorithm supersedes it. The port makes this a new implementation, not a refactor.
