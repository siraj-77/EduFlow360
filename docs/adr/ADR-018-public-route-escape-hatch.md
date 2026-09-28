# ADR-018 — `@Public('<reason>')` Is the Only Route Exemption, and It Is Allowlisted

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (gap identified by Prompt Pack §P3.2, §P4.7)
**Affects:** every controller route · `AGENTS.md` §2.3
**Source:** Prompt Pack §P3.2(3), §P4.7 · `AGENTS.md` §2.3 (corrected)

---

## Context

`AGENTS.md` §2.3 requires three guards on every route and states that **a route with no `@RequirePermission` is a defect**, enforced by a CI static check. That is a good default, and it is fail-closed.

But a small number of routes genuinely cannot require a permission, because they must work **before** any user is authenticated, or with no user at all:

| Route | Why it must be public |
|---|---|
| `/health/liveness` | A load balancer and container orchestration must poll it. No credentials exist. |
| `/health/readiness` | Same, plus it reports whether the DB, Redis and licence are usable. |
| `POST /license/activate` | Activation is how a school *obtains* a licence. Requiring a permission would make activation impossible. |
| `POST /auth/login` | Authentication itself. |
| `POST /auth/otp/request`, `/auth/password-reset/request` | Unauthenticated by necessity — a locked-out user has no session. |

So the fail-closed rule needs an escape hatch. The question is what shape that hatch takes, because the failure modes are asymmetric:

- **Too permissive** (`@Public()` with no reason, or a blanket "skip guards" flag) — exemptions accumulate invisibly until a real route is accidentally public. Nobody can review what they cannot see.
- **Too strict** (no hatch at all) — the escape gets built anyway, as a fake permission key, a commented-out guard, or a `skipAuth` boolean. **All three are worse than a documented `@Public`**, because each is invisible to the static check.

That last point is the reason this exists. A missing escape hatch does not prevent exemptions; it makes them **undetectable**.

## Decision

**`@Public('<reason>')` is the only exemption from `@RequirePermission`. The reason is mandatory and non-empty.**

- A route with **neither** `@RequirePermission(...)` **nor** `@Public('<reason>')` fails the CI static check. The check accepts either one and rejects everything else.
- **Every `@Public` use is listed in a checked-in allowlist file with its justification** — route, reason, and who agreed to it. Exemptions are therefore **reviewable rather than invisible**, which is the entire point.
- The allowlist is **checked in CI**: adding a `@Public` to a route without adding an allowlist entry fails the build, and the reverse also fails, so the file cannot drift from the code.
- `@Public` is a **global** exemption in its effect — it disables the permission guard for the route. It therefore **must not be combined with `@RequireEntitlement`** on a feature-gated route, because a route that skips permission resolution has no resolved entitlement to enforce. The static check rejects that combination too.
- Every use is **audited** (`@Audited`), including the login and activation routes, because "someone tried to log in" and "someone tried to activate" are exactly the events a school needs to see.

## Consequences

### Positive
- The five legitimate cases above have a first-class, documented mechanism.
- The static check stays **fail-closed**: no decorator means failure, not a pass.
- **Exemptions are enumerable.** Reading one file tells you every public route in the system and why. That is a genuine security property, not a documentation nicety.
- A future engineer cannot add a public route without writing down a justification, which is a natural moment to reconsider.
- The "no hatch" failure mode — fake permissions, commented-out guards, `skipAuth` booleans — is designed out rather than left to discipline.

### Negative / accepted costs
- **A checked-in allowlist is a file that must be maintained.** Two-way CI enforcement makes drift a build failure rather than a subtle security gap, which is the right trade but is real work.
- **A blanket `@Public()` on a controller class would expose every route in it.** The allowlist review is what catches that; a lint rule should also reject class-level `@Public` except on a small, reviewed set (health only).
- `AGENTS.md` §2.3's original wording had no escape hatch, so this **corrects the contract**. Anyone who memorised the old rule will find the check now accepts one extra form — deliberately, and the allowlist is where the reasoning lives.

### Neutral
- Ownership policies (`IOwnershipPolicy`) are meaningless on a public route, since there is no actor. The static check should also reject `@Public` on a route that declares entity-scoped ownership.
- Login and activation remain unauthenticated; their protection is rate limiting, generic error messages, lockout (`PLT-101`) and audit — not authorisation.

## Rejected alternatives

**❌ No escape hatch — every route must carry `@RequirePermission`.** Rejected: the exemption gets built anyway, disguised as a fake permission key like `HEALTH_CHECK` or `PUBLIC_LOGIN`. A fake key is a real key in the database, it appears in the permission catalogue, and it can be granted to a role. **Worse than a documented `@Public` in every respect.**

**❌ A global `skipGuards: true` route option.** Rejected: invisible at the decorator site, trivially copied, and not enumerable. It is the status quo the contract is trying to avoid.

**❌ `@Public()` with an optional reason.** Rejected: an optional reason is absent in practice. Mandatory is the only version that produces an allowlist.

**❌ Allow public routes via an environment flag.** Rejected: a route that is public in staging and guarded in production is the worst outcome — a security control whose behaviour depends on configuration, untestable in CI.

**❌ Review public routes at PR time only, with no allowlist file.** Rejected: a review can only catch what the reviewer notices, and cannot answer "which routes are public?" months later. The allowlist makes it answerable.

## Links
- `AGENTS.md` §2.3 (corrected), §2.15 · Prompt Pack §P3.2(3), §P4.7, §4.3 (reviewer checklist)
- `PLT-101`, `PLT-105`, `PLT-202`, `PLT-301`, `PLT-303`, `PLT-901`, `PLT-902`
- `docs/adr/ADR-016-metrics-prometheus.md` (a legitimate `@Public` use — metrics scraping)
- `docs/core/ARCHITECTURE.md` §4, §17 · `docs/work/PLATFORM_CORE_PLAN.md` §4

## Revisit when
The exempt set changes. That is an allowlist edit, reviewed like any other security-relevant change — not a redesign.
