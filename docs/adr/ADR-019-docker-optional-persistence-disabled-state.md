# ADR-019 — Docker Is Optional: An Explicit `persistence: 'disabled'` Boot State

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-29
**Deciders:** Owner decision (2026-09-28: "no docker installed on my windows PC, we should be able to run the project by `npm run dev`")
**Affects:** `apps/api` boot, local development, `AGENTS.md` §11
**Deviates from:** `EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §1.1 (Docker + Docker Compose listed as a developer prerequisite)

---

## Context

The Prompt Pack §1.1 lists as a Day-0 prerequisite: *"Docker + Docker Compose — Local Postgres, Redis, MinIO (S3-compatible), a local mail catcher (e.g. Mailpit)."* `REPO-01`'s original wording said the same.

**The owner has no Docker on the Windows development machine**, and asked for the project to run with `npm run dev`. That is a real constraint, not a preference, and it collides with an explicit prerequisite in the governing prompt pack.

At the same time, `AGENTS.md` §11 states two rules that pull in opposite directions at this stage of the build:

> "Start-up must fail fast naming the missing variable; **no silent defaults**."

- **"No silent defaults"** ⇒ a missing `DATABASE_URL` must never be papered over with a guessed `localhost` URL. A guessed URL is silent, and it fails much later, in a different file, with a stack trace that points at the database rather than at the missing configuration.
- **`npm run dev` must work** ⇒ at P2 there are no persistence features at all, so requiring a database blocks the scaffold and the entire test suite for no benefit.

The obvious resolutions are both wrong. Requiring the variable breaks the dev loop. Defaulting it silently violates §11 and produces exactly the class of confusing failure §11 exists to prevent.

## Decision

**Introduce a third state. Not a default, and not a failure.**

```ts
type PersistenceMode = 'enabled' | 'disabled';
```

- **`DATABASE_URL` absent** → `persistence: 'disabled'`. The API boots, prints a loud banner naming exactly what is missing and why it is acceptable *right now*, and **constructs no repository implementation at all**. There is no in-memory substitute, no mock, no SQLite.
- **`DATABASE_URL` present but invalid** (not a `postgresql://` URL, still a `<placeholder>`, unparseable) → **start-up throws**, naming every invalid variable at once.
- **Docker is optional infrastructure, not a dependency.** `infra/docker/docker-compose.yml` is one convenient way to supply `DATABASE_URL`, `REDIS_URL` and `STORAGE_ENDPOINT`. The application reads them from the environment and is identical either way.
- **From P4 this state is removed** and `DATABASE_URL` becomes required. The disabled branch is deleted, not deprecated.

### What this costs and what it does not

This is **not** a schema substitution. PostgreSQL remains the only database (`ADR-003`, and `ADR-002` needs real numerics for money). Nothing about persistence is mocked, faked or downgraded — it is simply absent, and says so.

## Consequences

### Positive
- **`npm run dev` works on a machine with no Docker**, which is the stated requirement.
- The API's own output states its configuration honestly. A developer who has not set a database is told, in the first lines of output, that persistence is off and that it will become mandatory at P4.
- No hidden default. A *missing* variable is a loud, explained state; an *invalid* variable is a hard failure. Neither is a guess.
- Nothing is mocked, so no test can pass against a fake persistence layer that production will not have.
- Docker remains available for anyone who wants it, and for CI from P3.

### Negative / accepted costs
- **An extra branch exists that production must never reach.** Mitigated by the plan to delete it at P4 and by the banner naming P4 explicitly.
- **The real requirement is deferred, not removed.** A developer without Docker must still install PostgreSQL natively before P4. `README.md` documents this, including that **Redis has no official Windows build** and is the one genuinely awkward service.
- **Three services are not single-binary on Windows.** MinIO and Mailpit are standalone binaries; PostgreSQL has an official installer; Redis is the problem. Documented rather than solved.
- The three-state logic is slightly more complex than "required or defaulted".

### Neutral
- `.env.example` and `AGENTS.md` §11 are unchanged — §11 is now *satisfied*, not relaxed.
- No ADR from the Prompt Pack's D-A…D-J set is affected.

## Rejected alternatives

**❌ Default `DATABASE_URL` to `postgresql://localhost:5432/eduflow`.** Rejected: this is precisely the silent default `AGENTS.md` §11 forbids. It converts a two-second fix ("set `DATABASE_URL`") into an afternoon of debugging a connection error in a file that has nothing to do with configuration.

**❌ Require `DATABASE_URL` and block the boot.** Rejected: blocks `pnpm dev`, the whole test suite, and the entire P2 milestone, in order to enforce a requirement for a feature that does not exist yet. The check belongs at the point the feature arrives.

**❌ Install Docker as a hard prerequisite.** Rejected by the owner's stated environment. Docker Desktop is a large install and a persistent service; making it mandatory for a solo developer on Windows, for a scaffold with no database code, is a disproportionate cost.

**❌ Use SQLite or an in-memory database for local dev.** Rejected: `AGENTS.md` §3.1 mandates PostgreSQL, and `ADR-002` depends on real numerics for money. A SQLite dev path is a *different product* that behaves differently exactly where correctness matters most — float arithmetic and type affinity. It would also mean local dev never exercises the database production uses.

**❌ Mock the persistence layer behind its port.** Rejected: a mock that silently satisfies a repository interface is a lie the test suite cannot detect. Absence is visible; a convincing fake is not.

**❌ Skip the banner and simply not connect.** Rejected: "no output" is the silent default in a different costume. The banner is what makes the third state honest.

## The tested contract

`apps/api/src/config/env.spec.ts` makes this executable, because an undocumented third state will be "simplified" away by the next engineer:

| Test | What it proves |
|---|---|
| loads with no `DATABASE_URL`, in an explicit disabled state | the third state exists |
| rejects a non-PostgreSQL URL and says *why* | single-tenant is not negotiable (`ADR-003`) |
| rejects a SQLite URL | the same, by example |
| rejects a still-`<placeholder>` value | the template cannot be booted with |
| names **every** invalid variable in one throw | not one restart per mistake |
| cites `AGENTS.md 11` in the failure | the reason is discoverable at the point of failure |
| boot banner states "PERSISTENCE DISABLED … not a fallback" | silence is not an option |
| boot banner confirms single-tenant on every boot | `ADR-003` is visible, not just documented |

## Links
- `AGENTS.md` §11 (fail fast, no silent defaults), §3.1 (PostgreSQL), §2.1 (single-tenant)
- `ADR-003` (single-tenant), `ADR-002` (money needs real numerics)
- `apps/api/src/config/env.ts` and `.spec.ts` · `README.md` § "Running without Docker"
- `EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §1.1 — **prerequisite deliberately not met**
- `docs/adr/ADR-017` (the other recorded deviations from the Prompt Pack)

## Revisit when
- **P4.** The `disabled` branch is deleted and `DATABASE_URL` becomes required. That is a scheduled change, not a contingency.
- A per-school deployment ever needs to run with persistence off. It does not: a school ERP without a database is not a degraded mode, it is a non-product.
