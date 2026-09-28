# ADR-004 — Time via an Injected `IClock`

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded*
**Affects:** `AGENTS.md` §2.4, §8 · `SRS` §10 · `ARC-03` · licence expiry, lockout, accrual, deadlines, hold expiry

---

## Context

At least six features in Platform Core and the domains behind it are **time-dependent**:

| Feature | Time dependency | Story |
|---|---|---|
| Access-token / refresh-token expiry | must be testable at the exact boundary | `PLT-102` |
| Account lockout cooldown | must be testable before, at and after expiry | `PLT-101` |
| OTP expiry (5 min), reset-token expiry (1 hour) | same | `PLT-104`, `PLT-105` |
| Licence expiry + 14-day grace countdown | **boundary day 13 / 14 / 15** | `PLT-301`, `PLT-305` |
| Leave accrual (monthly pro-rata, tenure tiers, leap year) | leap-year arithmetic | `PC-001` |
| Booking hold expiry, assignment deadlines, attendance window | hold must expire deterministically | `AGENTS.md` §2.9 |

`SRS` §10 states the rule: *"No test may depend on real time (`Date.now()`); inject a clock abstraction (`IClock`) everywhere date logic matters."*

The alternative — testing time-dependent logic with real time — means either `jest.useFakeTimers()` sprinkled through unrelated tests, or assertions that only pass on the day they were written. Both produce flaky suites and both make a boundary condition untestable, which is precisely the boundary that matters for a grace period.

---

## Decision

Domain and use-case code **must never** call `Date.now()` or `new Date()`. It injects `IClock`.

**This is enforced mechanically**, not by convention: an ESLint rule fails the build on `Date.now()` or `new Date()` in `domain/` or `use-cases/` (`ARC-03`).

Related conventions, all from `AGENTS.md` §8:
- **Storage:** UTC.
- **Edges:** school timezone.
- **"Now":** `IClock` — never the ambient clock.
- A school's timezone, currency, language and academic calendar are **never hard-coded**; read from school settings.

`SRS` §10 additionally requires `IClock` and base test utilities to be established as a **team-wide Day-1 item** (`SRS` §16.6), so every module inherits the same clock rather than each inventing one.

---

## Consequences

### Positive
- Boundary conditions become ordinary test cases: *"at day 14 of a 14-day grace period"* is a test, not a flake.
- Leap-year accrual is deterministic.
- Tests run in milliseconds with no fake-timer coupling to unrelated suites.
- The static check makes the rule self-enforcing — a new contributor cannot break it by accident.

### Negative / accepted costs
- Every time-dependent use-case constructor takes an extra dependency. **This is the point** — the dependency is visible in the signature instead of hidden in a global.
- `IClock` must be provided in every test that touches a use-case. Mitigated by shared factories in `ARC-03`.
- Relative-time formatting ("2 hours ago") in the UI still needs a real clock — the rule applies to domain and use-case code. UI formatting is presentation and may use the platform clock.

### Neutral
- BullMQ jobs and HTTP date handling sit in infrastructure and are not restricted.

---

## Rejected alternatives

**❌ `jest.useFakeTimers()`.** Rejected: global fake timers leak across test files, produce confusing failures when a dependency holds a timer, and are not available outside Jest — the same domain code runs in a BullMQ worker and an integration test.

**❌ A shared `moment`/`dayjs` global with an injectable-now option.** Rejected: it is a clock with a date library attached, and library-level global state is exactly what the rule exists to prevent.

**❌ Pass `now: Date` as a parameter where needed.** Rejected as the *primary* mechanism: it works, but it is invisible in the constructor signature, so a reviewer cannot tell a use-case is time-dependent. `IClock` makes the dependency explicit, and the ESLint rule catches the ones that forget.

---

## Revisit when
Never, in practice. If a feature needs more than "what time is it" — recurring schedules, academic calendar arithmetic, timezone conversion — that is a **calendar service** built *on top of* `IClock`, not a replacement for it.

---

*Indexed in `docs/adr/README.md` · Implements `ARC-03` · Spec: `AGENTS.md` §2.4, §8 · `SRS` §10, §16.6.*
