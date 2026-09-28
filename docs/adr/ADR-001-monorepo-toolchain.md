# ADR-001 — Monorepo with pnpm workspaces and Turborepo

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded*
**Affects:** `AGENTS.md` §3.1, §14 · `SRS` §15, §17 · `REPO-03`, `REPO-04`

---

## Context

EduFlow has **three** applications (`web`, `api`, `mobile`) and **four** shared packages (`shared-types`, `ui-kit`, `i18n-resources`, `config`).

`SRS` §10 states the coupling explicitly: *"critical given how many modules (Attendance, Leave, Documents) cross all three surfaces."* A student's attendance record is written by the API, rendered by the web teacher portal, and read by the mobile parent portal — and all three need the same type definition. A disagreement about that type is not a compile error in three places; it is a runtime bug in production.

`SRS` §15 also prescribes a specific tree and states *"Turborepo or Nx"* without choosing.

Additional constraint: this is a **per-school deployment** (ADR-003). A school receives a build artefact, not a development environment. Build reproducibility is a supply-chain property, not just a developer convenience.

---

## Decision

Use **pnpm workspaces** for dependency management and **Turborepo** for task orchestration.

```
pnpm-workspace.yaml   →  packages: apps/*, packages/*
turbo.json            →  tasks: build, lint, typecheck, test, test:coverage
```

**`SRS` §15's repository name `sms-platform/` is corrected to `EduFlow/`** (`AGENTS.md` §1).

Rationale for pnpm over npm/yarn: strict, non-hoisted `node_modules` by default, which makes an undeclared dependency a **runtime failure** rather than a silent success. For a codebase with hard rules about what may import what, that default is worth more than install speed.

Rationale for Turborepo over Nx: task-graph caching and remote-cache execution are the actual requirement; Nx's plugin ecosystem and generators are not, and add significant conceptual surface. If a module ever needs an Nx generator, that is a new ADR.

---

## Consequences

### Positive
- Type mismatches across the three apps become **compile errors**, not production bugs.
- One `pnpm install` and one `pnpm build` at the root; the same commands `AGENTS.md` §14 documents.
- A school deployment builds from one lockfile — reproducible, and auditable.
- Turborepo's cache makes the full `lint + typecheck + test + build` gate affordable on every save.

### Negative / accepted costs
- pnpm's strict `node_modules` makes undeclared-dependency mistakes a build failure, which will be mildly annoying until it is learned.
- One `pnpm-lock.yaml` is a high-contention file in a team; conflicts need discipline.
- `AGENTS.md` §8 prohibits adding a build tool without instruction. This ADR is that instruction, scoped to Turborepo only.

### Neutral
- `mobile` is milestone 2 (ADR-005) but the workspace glob `apps/*` already accommodates it. No change needed when it arrives.

---

## Rejected alternatives

**❌ Separate repositories per app.** Rejected: the cross-app type contract is the primary reason for the monorepo. Separate repos would require a published versioned package plus a release train for every shared-type change, to solve a problem that does not exist.

**❌ Nx.** Rejected: generators and the plugin ecosystem are not needed; the added conceptual surface costs more than it saves. Revisit if a module needs a generator.

**❌ npm or Yarn workspaces.** Rejected: pnpm's default non-hoisted layout makes undeclared dependencies fail loudly. Yarn PnP is stricter still but has a larger compatibility surface with Jest, Playwright and Prisma tooling.

**❌ Bare monorepo without a task orchestrator.** Rejected: no caching means the full quality gate takes minutes, and `AGENTS.md` §4 requires it before *every* commit.

---

## Revisit when
- Repository size makes a full checkout impractical (> ~10 min cold clone) — then consider sparse checkout or partial clones.
- Turborepo is abandoned upstream.

---

*Indexed in `docs/adr/README.md` · Implements `REPO-03` · Spec: `AGENTS.md` §3.1, §14 · `SRS` §15, §17.*
