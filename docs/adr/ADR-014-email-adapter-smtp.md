# ADR-014 — Email Delivery Behind `INotificationChannelAdapter` (SMTP, Mailpit in Dev)

**Status:** ✅ **Accepted 2026-09-30 (owner)**
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-H)
**Affects:** `PLT-105`, `PLT-702` · `AGENTS.md` §2.2
**Source:** Prompt Pack §2.1 (D-H)

---

## Context

Two Platform Core stories need to send email before the notification router exists:

- `PLT-105` (password reset) must deliver a reset mail.
- `PLT-104` (OTP) is milestone 2 but also needs a channel — deferred.

The Prompt Pack's documented deviation is to **pull the email adapter forward** into P5, behind `INotificationChannelAdapter`, and refactor it into the full router in P12.

This creates an ordering problem worth solving deliberately. A naive fix would be for `PLT-105` to call an email library directly. That is exactly what `AGENTS.md` §2.2 forbids — *never call a vendor SDK from a use-case* — and it means `P12` becomes a refactor of a direct call rather than a first-time integration.

`AGENTS.md` §2.2 also fixes the **default channel as email**, and notes that SMS and WhatsApp are per-message billed while email is comparatively cheap. Email is therefore the right default for the router, not merely the first one implemented.

## Decision

**Email goes through `INotificationChannelAdapter` from the first story that needs it.**

- `PLT-105` builds a **production-quality email adapter** during P5, behind the port. The full router (`PLT-701`) arrives in P12 and the adapter is **not rewritten** — it is reused.
- **SMTP in production**, behind the port. Configuration (host, port, credentials, TLS) comes from environment, validated at startup.
- **A local mail catcher (Mailpit) in development and tests**, so a reset mail is inspectable without sending it. `OPS-01`'s compose file includes it.
- **Email is the default channel** for notification resolution (`AGENTS.md` §2.2).
- **A temporary password, a reset token and an OTP never appear in a log** (`AGENTS.md` §2.13 redaction), and reset tokens are single-use and time-limited.

### The interim pattern

`P5` introduces a minimal in-process sender behind the port. `P12` replaces the *dispatch* with the router — preference resolution, digesting, rate limiting, BullMQ retry/backoff — and **the adapter itself is unchanged**. Tests stay green across the refactor, which is the test that the port did its job.

## Consequences

### Positive
- No story ever calls a vendor SDK from a use-case, from the first commit.
- `P12` is an integration, not a rewrite — and the interim pattern is what makes that true.
- Password reset is testable in CI: a test reads the catcher and asserts the token is single-use and expiring, with no network.
- Consistent with the default-channel decision, so the router's design is settled by the time it is written.
- Schools in regions where SMS is unreliable or expensive still get a working channel.

### Negative / accepted costs
- **An interim abstraction exists between P5 and P12.** A real cost: two dispatch paths, and a rule that the interim one must not grow features. Mitigated by keeping it minimal and by naming the refactor explicitly in `P12`.
- **Mailpit is another service** in the compose file, and another thing a developer must understand.
- **SMTP deliverability is a real operational concern** — SPF, DKIM, reverse DNS. Not solved by this ADR, but it is a school-onboarding step (School Setup Workflow §14) rather than a code change.
- `P12` must **actively refactor** P5's usage or the interim path becomes permanent. This belongs in `P12`'s acceptance criteria, and in the Prompt Pack's per-story row for `PLT-702`.

### Neutral
- Push is milestone 2 (`AGENTS.md` §7 D5). P12 leaves a documented port only.
- SMS and WhatsApp remain **vendor-agnostic ports with no implementation** — the SMS provider is deliberately undecided (`AGENTS.md` §2.2), WhatsApp targets the Vvaslution API.

## Rejected alternatives

**❌ `PLT-105` calls an email library directly, refactored later.** Rejected: violates `AGENTS.md` §2.2 from the first commit, and the refactor later touches a shipped path rather than a fresh one. The cheapest thing to get wrong.

**❌ Delay password reset until P12.** Rejected: `PLT-105` is a P0 story in Epic 01, and a school without password reset is a support problem from day one.

**❌ Use a hosted email API (SendGrid, SES, Postmark) instead of SMTP.** Rejected only because the prompt pack specifies SMTP. It is a legitimate choice and a config change if adopted. The **port is what makes it swappable** — a concrete benefit of `AGENTS.md` §2.2's SOLID-L.

**❌ Send real email in tests.** Rejected: non-deterministic, and a test suite that sends mail is a test suite that can be blocked by someone else's SMTP server.

## Links
- `AGENTS.md` §2.2 (ports and adapters, default channel), §2.13, §2.15
- `PLT-105` (P5), `PLT-701`, `PLT-702` (P12) · Prompt Pack §2.1 (D-H), §2.2, §6 P5/P12, §7
- `docs/adr/ADR-008-token-strategy-jwt-refresh-rotation.md` (reset invalidates all sessions)
- `docs/work/PLATFORM_CORE_PLAN.md` (documented pull-forward)

## Revisit when
- A school requires transactional email from a specific provider with regional routing. That is configuration behind this port.
