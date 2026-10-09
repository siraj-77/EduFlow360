# EduFlow360 — Documentation Deep-Dive, Technical-Debt Assessment & Strategic Roadmap (v2)

> **For agentic workers:** this document is an **analysis and a remediation roadmap**, not a build
> spec. Only **Phase A**, **Phase B**, and **Phase C task C-1..C-4** contain executable steps.
> Phases D–G are specifications that must be written before they can be planned. Do not start
> coding feature work from this file.
>
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-10-09
**Supersedes:** `2026-10-09-docs-analysis-and-strategic-roadmap.md` (the "prior plan")
**Method:** 5 parallel full-file deep reads of the 5 core documents (6,230 lines, 466 KB),
archive forensics via 7-Zip, live git/GitHub verification, scratch extraction of 1,269
text artifacts.
**Rule:** every claim below carries a `file:line` citation or a command that reproduces it.
Uncited claims are not in this document.

---

## Global Constraints

These are project-wide invariants. They survive every phase below.

- **Never** print, copy, commit, or archive a real credential. Placeholders and prefixes only.
- Money is **integer minor units** on disk, **decimal string** on the wire (`ADR-002`, `ADR-024`).
- Time is read through the injected `IClock`. No direct `Date.now()` in domain code (`ADR-004`).
- Ports are configuration (`WEB_PORT`, `API_PORT`), never hard-coded — enforced by
  `scripts/check-route-guards.mjs`.
- UI templates under `docs/template/` are reproduced **1:1**; changes need an owner-authorised
  `WORKLOG.md` entry or CI fails (`EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md:1226`).
- i18n coverage is 4 locales (`en`, `ta`, `si`, `ar`) plus RTL on every screen.
- Every route carries an explicit permission guard **and** an audit action.
- A gate must prove **soundness**, not **presence** (`docs/work/EPIC_STATUS.md:27-33`).

---

# PART I — HEADLINE VERDICT

## I.1 There are three trees, and they disagree about what the project is

| | Tree A — Working dir | Tree B — Scratch recovery | Tree C — Archive |
|---|---|---|---|
| Path | `H:\AI-Dev\MyProjects\EduFlow360` | `%LOCALAPPDATA%\opencode\eduflow-recovered\New folder` | `H:\AI-Dev\MyProjects\EduFlow360\New folder.7z` |
| Size | 25 files, 8 dirs | 42,426 files | 227,404,582 B, 51,297 entries |
| `.git` | **absent** | present, clean, 88 commits, HEAD `ff88d3c` | present |
| Source code | **zero files** | 168 `apps/api/src/**/*.ts` (85 `.spec.ts`), 36 web, 4 packages | same |
| Docs | 5 core docs at **EduFlow360_ v5.3 / v1.3 / v1.1 / v2** + 2 diagram files + 2 templates | 5 core docs at **EduFlow_ v5.2 / v1.2 / v1 / v1** + 21 ADRs + 2 ERDs + 19 work docs + 6 idea-bank + 6 analyses + 1 design + 3 prior plans | same as B |
| Build state | n/a | `~100 of 199` platform points; **2 of 34 stories complete** (`EPIC_STATUS.md:49`) | same |
| Credentials | `.env`, `.env.local`, `.claude/settings.json` all live | — | **all three, unencrypted** |

**Reproduce:**

```powershell
Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360" -Recurse -File | Measure-Object
& "C:\Program Files\7-Zip\7z.exe" l "H:\AI-Dev\MyProjects\EduFlow360\New folder.7z" | Select-String "files,"
git -C "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder" log --oneline -1
```

## I.2 The rename landed in the docs and in GitHub, but not in config

This single fact explains most of the apparent inconsistency.

| Artefact | Says |
|---|---|
| Working-tree core docs | `EduFlow360_*` (v5.3 / v1.3 / v1.1 / v2) |
| GitHub | `siraj-77/EduFlow360` — **PRIVATE, exists** |
| Recovered repo `origin` | `https://github.com/siraj-77/EduFlow.git` — **404, renamed away** |
| `.env.example:1,11,13,23,25,76` | still says `EduFlow` / `eduflow` / `eduflow_dev` |
| `.env.example:71` | `PORT=3001`; `:117` says web runs on **3500** |
| `EduFlow360_Project_Master_Plan_v5.3.md:15,19` | claims the rename happened in **both v5.1 and v5.3** |

Verified: `gh api repos/siraj-77/EduFlow` → `404 Not Found`;
`gh repo list siraj-77` → contains `EduFlow360` but not `EduFlow`.

## I.3 CRITICAL — the project has no durable backup

This is the single highest-severity finding in this assessment and it is **not** in the prior plan.

```
$ gh api repos/siraj-77/EduFlow
{"message":"Not Found", "status":"404"}

$ gh repo view siraj-77/EduFlow360 --json diskUsage
{"diskUsage":1, "pushedAt":"2026-10-09T09:50:12Z"}

$ git clone https://github.com/siraj-77/EduFlow360.git probe
$ git -C probe rev-list --count HEAD
1
$ git -C probe ls-files
.gitignore
```

The GitHub repository that exists contains **one commit and one file**. The real 88-commit
history (`ff88d3c`) exists **only** inside a 217 MB unencrypted `.7z` sitting on the same
drive as the working copy.

| Risk | Consequence |
|---|---|
| Disk failure / accidental delete of `New folder.7z` | **88 commits, 168 source files, 21 ADRs, 2 ERDs — gone.** No remote to restore from. |
| The `.7z` contains `.env`, `.env.local`, `.claude/settings.json` | Unencrypted, so any copy of the archive is also a credential leak. |
| `.env:1` claims "Git-ignored (AGENTS.md 11)" | `AGENTS.md` is **0 bytes**, so that justification is unverifiable. |

**Therefore Phase A below is a recovery-and-anchor phase, not housekeeping.**

## I.4 The working-tree docs are a forward refresh, not a truncation

The prior plan (`§I.2`, lines 59–77) framed the working tree as *truncated*. That framing is
wrong, and acting on it would lose work. Verified by content, not filename:

| Working tree | Archive predecessor | Delta |
|---|---|---|
| `Master_Plan_v5.3` | `Master_Plan_v5.2` | adds §5A School Setup (6 tabs), §5B Academic Setup (17 rows), §5.2 Basic GL, §5.3 i18n, §5.4 Admin Console |
| `SRS_..._v1.3` | `SRS_..._v1.2` | adds §3.2A `FR-SET-01..12` and §3.2B `FR-ACD-01..16` — 28 of 120 FRs are new |
| `School_Setup_Workflow_v1.1` | `School_Setup_Workflow_v1` | 1,408 vs ~1,000 lines |
| `Jira_Epics_PlatformCore_RBAC_v2` | `..._v1` | restructures into 10 epics / 39 stories / 173 tasks / 512 sub-tasks |
| `Jira_Epics_SchoolSetup_Academic_v1` | **none** | entirely new — 16 epics / 54 stories / 169 tasks / 487 sub-tasks |
| — | `EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` | **no successor**; 93 references across the tree point at it |

The archive's own `SSOT.md` (156,704 B) and 21 ADRs are the **authority on what was decided**.
The working tree's 5 docs are **an unratified proposal for what should be decided next**.

**Consequence:** restoring the archive must not overwrite the 5 newer docs, and adopting the
5 newer docs must not overwrite `SSOT.md`. Phase C exists solely to diff and adjudicate them.

---

# PART II — WHAT IS GENUINELY GOOD

Do not lose this. A remediation plan that discards it is a net negative.

| # | Strength | Evidence |
|---|---|---|
| 1 | **ADR practice is real.** 21 ADRs + README, from monorepo toolchain to money-on-the-wire, with `ADR-017` recording deliberate deviations from the Jira sprint order. | `docs/adr/ADR-001..021, ADR-024` |
| 2 | **Both Jira docs are arithmetically perfect.** Every epic's declared points equal the sum of its stories' points (233 and 269, both verified); every `~%` agent-share reproduces exactly; every `-T<n>` sequence is contiguous with no gaps; every story has exactly one `-C` close-out. | `PlatformCore_v2.md:30-32`; `SchoolSetup_v1.md:21-37` |
| 3 | **The decomposition is already done.** 26 epics, 93 stories, 502 points, 342 tasks, **999 sub-tasks**, 192 acceptance criteria. Phase F must *execute* these, not re-plan them. | both Jira docs |
| 4 | **The port boundaries are the right abstractions.** `IOwnershipPolicy`, `IStorageAdapter`, `ISchoolSettingsReader`, `IHolidayCalendar`, `ITimetableConstraintPolicy`, `PeriodScheduleCalculator`, `IClock`. | `SchoolSetup_v1.md:380,500,700,715,1055` |
| 5 | **`EPIC_STATUS.md` is honest self-reporting.** *"Measured from the tree, not from a plan file… Where a claim is '0%' that means no production code exists."* It names its own security gaps. | `docs/work/EPIC_STATUS.md:3-5` |
| 6 | **Real engineering landed.** 88 commits, clean tree, baseline migration + `PLT-401` DB-level audit immutability proof (`9bb3e96`), CI workflow with all ten gates (`f1511d5`), build-gating fix (`53ad6b0`), flake root-cause fix (`5b4b466`). | recovered `git log` |
| 7 | **The format-precision rules are excellent** and the best-specified section in the whole corpus: `{SCHOOL_CODE}{YYYY}{YY}{SEQ:n}` n=3..10 zero-padded, `SHA-256` + magic-byte verification, `ISO 4217`, `IANA`, `E.164`, `CR80`, `RFC 3339`. | `Master_Plan_v5.3.md:415-435` |
| 8 | **Money and identity invariants are already decided**, twice each. | `ADR-002`, `ADR-024`, `ADR-007`, `ADR-008` |

---

# PART III — TECHNICAL DEBT REGISTER

Severity: **S1** = loss of data/credentials or total blockage · **S2** = blocks correct
delivery · **S3** = will cause rework or migration · **S4** = hygiene.

## S1 — Critical

### D-01 · The project has no durable backup · *new*
**Evidence:** `gh api repos/siraj-77/EduFlow` → `404`. `siraj-77/EduFlow360` has 1 commit,
1 file (`.gitignore`), `diskUsage: 1`. The 88-commit history exists only in
`New folder.7z` (227,404,582 B, unencrypted) on the same drive.
**Impact:** single-disk failure = total loss.
**Remedy:** Phase A task A-3, A-4.

### D-02 · Live credentials on disk and inside an unencrypted archive
**Evidence:** `.claude/settings.json` holds `ANTHROPIC_BASE_URL` (a third-party gateway host),
`ANTHROPIC_AUTH_TOKEN` with a `thk_live_` prefix, `ANTHROPIC_MODEL`; `.env.local` holds a
Google OAuth secret with the `GOCSPX-` prefix plus `GOOGLE_CLIENT_ID`. All three files are
inside `New folder.7z`. `.gitignore` now covers `.env`, `.env.*`, `.claude/`, `*.7z`
— but the files are still on disk, and `.gitignore` does nothing for a `.7z`.
**Impact:** credential compromise; the archive is a portable leak.
**Remedy:** Phase A tasks A-1, A-2, A-5.

### D-03 · `AGENTS.md` is 0 bytes and is the single most-referenced file
**Evidence:** `AGENTS.md` = **0 bytes**. Referenced 13× across 6 documents with section-level
precision: `SRS_v1.3.md:4` "the build contract";
`PlatformCore_v2.md:12` "AGENTS.md is the contract"; `:1226` mandates a CI check against
`AGENTS.md §2.17`; `SchoolSetup_v1.md:8,13` cite `AGENTS.md §2.17`.
`CLAUDE.md` (87 bytes) says: *"Read and follow AGENTS.md at the repository root. It
overrides all other instructions."* — pointing at an empty file.
**Impact:** the build contract, the CI gate target, and the CLI's own override are all absent.
The recovered archive has the real file: **41,943 bytes**.
**Remedy:** Phase B task B-3.

### D-04 · The recovered repo's `origin` points at a URL that 404s
**Evidence:** `origin  https://github.com/siraj-77/EduFlow.git` → `Repository not found`.
The real repo is `EduFlow360`.
**Impact:** every `git push`, `git fetch`, and CI trigger silently fails. This is why the
project was never pushed after the rename.
**Remedy:** Phase A task A-3.

### D-05 · `.env` / `.env.local` use `KEY = value` — **RESOLVED 2026-10-09, this was wrong**
**Original claim:** `.env` line 2 is `DATABASE_URL = postgres…`; most dotenv parsers require
`KEY=value`, so the file "may not load at all".

**Corrected by measurement.** Node's built-in `process.loadEnvFile()` — which is what this
repo actually uses — trims surrounding whitespace. Verified directly:

```
node -e "fs.writeFileSync('.env.probe','PROBE_A = spaced-value\nPROBE_B=tight-value\n');
         process.loadEnvFile('.env.probe');
         console.log(process.env.PROBE_A, process.env.PROBE_B)"
  ->  spaced-value tight-value
```

**There is no defect.** `pnpm migration:run`, `pnpm test:integration` and `pnpm test:e2e`
all ran green against the existing root `.env`. I asserted this without testing it in the
first pass; the same discipline that caught the `it()`-vs-`test()` correction elsewhere in
this repo applies here. Remove this item.

**What *is* real, and was found only by running it:** the three env loaders disagree about
*where* `.env` lives. `vitest.integration.config.ts` resolves `../../.env` from the repo
root; the **Prisma CLI looks beside `schema.prisma`** (`apps/api/prisma/`), so
`pnpm migration:run` fails with a bare `Validation Error Count: 1` until `DATABASE_URL` is
exported by hand. That is the substantive half of D-09, and it belongs in SEC-115.

### D-06 · `.env.local` contradicts `.env.example`
**Evidence:** `.env.example:55` — *"Do NOT install Auth.js. Both of its session strategies
contradict ADR-008."* Yet `.env.local` defines `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. NextAuth
**is** Auth.js. `ADR-008` chooses JWT + refresh rotation, not session cookies.
**Impact:** invites an agent to install a session library the architecture forbids.
**Remedy:** Phase C task C-3.

### D-07 · `.env.example` ships 12 unresolved placeholders while stating a rule against them
**Evidence:** `.env.example:6-8` declares that the validator rejects an unresolved
placeholder; then `DATABASE_URL="<postgresql://…>"`, `STORAGE_ACCESS_KEY="<eduflow_dev>"`,
`JWT_ACCESS_SECRET="<generate with: openssl rand -base64 32>"` all ship bracketed and
unresolved.
**Remedy:** Phase C task C-2.

### D-08 · Ports: four mutually incompatible schemes, zero overlap with the code
**Evidence:** docs say Web **3030**, API **3031** (`Master_Plan_v5.3.md:15,450`;
`PlatformCore_v2.md:7,1135,1145`; `School_Setup_Workflow_v1.1.md:7`).
`.env.example:71` says `PORT=3001`; `:117` says the web app runs on **3500**.
`PlatformCore_v2.md:1166` is still `👤 owner confirms API dev port (3031 is an assumption)`.
The archive's `apps/api/src/config/env.ts` is the **code** and therefore the authority.
**Remedy:** Phase C task C-4.

## S2 — High

### D-09 · Four incompatible env-var naming schemes
`WEB_PORT`/`API_PORT` (`PlatformCore_v2.md:1149,1154`) vs `WEB_BASE_URL`/`API_BASE_URL`
(`:1158`) vs `PORT`/`WEB_ORIGIN`/`NEXT_PUBLIC_API_URL` (`.env.example:71,117`) vs
`NEXTAUTH_*` (`.env.local`). 24 of 28 `.env.example` vars are undocumented; 4 documented vars
are absent from it. **This is the recovered repo's own next task, `SEC-115`** — the code fix
already exists and the docs were never updated to match.
**Remedy:** Phase C task C-2.

### D-10 · The Master Plan has 5 duplicate section numbers and no §5.1
`§21`'s sub-headings are numbered **18.1–18.6** (`Master_Plan_v5.3.md:892,903,905,907,909,911`),
colliding with §18's real 18.1–18.5 (`:835-851`). `§18.1` is therefore ambiguous between
"Alumni Directory" and "AI Chatbot". `§26`'s sub-headings are numbered **23.1–23.3**
(`:993,998,1007`), colliding with §23, which has no sub-headings. `§5` jumps 5 → 5.2
(`:218` → `:415`).
**Remedy:** Phase D task D-3.

### D-11 · 8 dangling intra-document cross-references in the Master Plan
`§9.3/§9.5/§9.6/§9.7` referenced 8× (`:678,696,737,739,864,868,903,919`) — §9 has no
sub-sections. `§7.1/§7.2/§7.3` 4× (`:703,816,1002,1003`) — §7 has none. `§6.1` 2×,
`§23.2` 2×. `:118` cites "§5.3" for the Document/Print Engine, but §5.3 is i18n.
`:942` lists "§10.1 Bell Engine, §10.2 Noticeboard…" — stale v3.0 numbers that now point at
Homework and Online Classrooms.
**Remedy:** Phase D task D-3.

### D-12 · 6 of 32 Master Plan sections are 3–8 line stubs deferring to a document that does not exist
`§4.3` (`:214`), `§6` (`:548`), `§7` (`:554`), `§8` (`:560`), `§9` (`:566`), `§27` (`:1015`)
each say "unchanged from v3.0" or similar. **No v2.0, v3.0, v4.0, v5.0, v5.1, or v5.2 file
exists anywhere.** `§27` is where all NFRs live, and it delegates every one of them to the
absent "v3.0 §14".
**Impact:** §6 Audit, §7 Academic, §8 Attendance, §9 Workforce, §27 NFRs are all unbuildable
from the working tree.
**Remedy:** Phase B task B-3 restores the v5.2 predecessor; Phase D task D-4 resolves the residue.

### D-13 · The Master Plan pins **zero** technology versions
`§2.1` (`:104-118`) names 14 subsystems — Next.js, React, TypeScript, Tailwind, shadcn/ui,
NestJS, PostgreSQL, Redis, BullMQ, React Native, Expo, S3, Leaflet, Socket.IO, Puppeteer,
next-intl. **Not one carries a version string.** Also absent: ORM, migration tool, Node
version, package manager, auth library, validation library, test runner, linter, bundler,
CI/CD, observability, backup tooling, secrets manager.
**Impact:** two agents starting the same story produce two different projects.
**Remedy:** Phase D task D-2 (versions already exist in the recovered `package.json` +
the 21 ADRs — this is a transcription job, not a design job).

### D-14 · Zero of 120 functional requirements have acceptance criteria
`SRS_v1.3.md` defines 120 FRs across 25 module prefixes (`:114-295`) and **not one** carries
an AC. Yet `SRS_v1.3.md:431` (Definition of Done) requires *"a manual QA pass against **the
acceptance criteria**"* — a set that does not exist.
**Remedy:** Phase D task D-6.

### D-15 · 8 of 9 non-functional requirements have no verification method
`SRS_v1.3.md:317-325` is the entire NFR set and contains **zero "shall" statements**. NFR-01
(99.5%) has no measurement window or SLI. NFR-02 (`<500 ms`) has no p95/p99. NFR-04 has no
RPO/RTO number. NFR-08 (biometrics) is voided by its own "where hardware permits" clause.
NFR-09 says "every endpoint" — contradicted by `FR-SET-03`, which serves the school logo
publicly. **Only NFR-02 is referenced anywhere else in the document** (`:437`, `:604`).
**Remedy:** Phase D task D-5.

### D-16 · The test plan mandates coverage gates but never says "TDD"
`PlatformCore_v2.md:12` declares TDD (RED → GREEN → REFACTOR) as a global rule. The string
`TDD` appears **0 times** in the 627-line SRS test strategy (Part B, `:359-452`).
**Remedy:** Phase D task D-6.

### D-17 · Gates prove presence, not soundness — the project's most expensive lesson, written nowhere
`docs/work/EPIC_STATUS.md:27-33`: *"`@RequirePermission` **now enforces.** `@RequireEntitlement`
and `@Audited` **still enforce and write nothing.** … `check-route-guards` proves a decorator
is **present**. Nothing proves it is **obeyed**. That is the same shape as the defect where the
shipped app could not boot: nine green gates, no enforcement."*
This insight exists **only** in a status file. No ADR, no SRS clause, no AC encodes it.
**Remedy:** Phase D task D-7 (new ADR), Phase E task E-2.

### D-18 · The RBAC epic defines no permission catalogue, anywhere
`PlatformCore_v2.md` is titled "…RBAC v2" and `:296` makes *"Role catalog and initial
permission taxonomy agreed"* a Definition of Ready. What exists:
- Four permission keys named in the entire file, two of them as examples:
  `ATTENDANCE_MARK` (`:315`), `FINANCE_INVOICE_REVERSE` (`:315,416`), `GRADE_ENTER` (`:392`),
  `ADMIN_CONSOLE_ACCESS` (`:1178,1184,1201`).
- The artefact that *would* define the model is itself a to-do: `PLT-205-T1` (`:442`)
  *"Build a test matrix spreadsheet/fixture"*.
- Roles: `:296` names 6 built-in; `:323` seeds only **2** immutable ones
  (`SUPERADMIN`, `SCHOOL_ADMIN`). Teacher/Student/Parent/Staff are never seeded, yet
  `PLT-203-T3/T4` (`:388,392`) hard-code ownership policies against exactly those roles.
**Impact:** blocks every module. The recovered repo has already built a catalogue
(`EPIC_STATUS.md`, `PLT-EPIC-02 ~75%`) — so this is a **doc-lag** problem, not a design
problem.
**Remedy:** Phase D task D-1 (adopt the recovered catalogue, do not re-invent).

### D-19 · `SUPERADMIN` superset semantics are undefined, and ordering of guards is undefined
`PlatformCore_v2.md:260` says `SUPERADMIN` holds "every permission"; `:323` seeds
`SCHOOL_ADMIN` with none. Is `SCHOOL_ADMIN ⊂ SUPERADMIN`? Unstated.
Worse: `:514` says `EntitlementGuard` is *"composable with `PermissionGuard`"* but never states
the **order** — while `:526`'s acceptance criterion ("Basic-edition license blocks a Deluxe-only
route **even with valid auth/RBAC permission**") only holds if entitlement is evaluated after
permission passes.
**Remedy:** Phase D task D-1.

### D-20 · i18n and RTL are required by three documents and built by zero stories
Required at launch by `Master_Plan_v5.3.md:118` (`next-intl`) and `:438-441` (4 locales + RTL
+ "no hard-coded UI strings"). Required by `SRS_v1.3.md:322` (NFR-06). Scoped P0 as
`FR-SET-12` at `SRS_v1.3.md:158` — but tagged `*(proposed)*`. Gated by
`School_Setup_Workflow_v1.1.md:480` ("sample screens verified in all enabled languages")
while `:448` marks the language fields *"Proposed:"*.
**And**: `PlatformCore_v2.md:6` declares source range `FR-PLT-01 → FR-PLT-15`, but the ten
`Maps to:` lines cover only 01–08 and 14–15. **`FR-PLT-09` (runtime language switch) and
`FR-PLT-10` (RTL) have zero stories**, and neither appears in the deferred list (`:1346`).
Meanwhile `EPIC_STATUS.md` records the template supplies **21 i18n keys, all marketing copy,
zero application keys** and **4 CSS rules of RTL** — so the RTL app shell is built from scratch.
**Remedy:** Phase D task D-2, Phase E task E-4.

### D-21 · The license certificate omits four whole domains that have entitlements
`Master_Plan_v5.3.md:183-189` enumerates **18** `allowed_modules`. The edition matrix
(`:122-152`) grants entitlements for Facilities & Grounds Hire (`:144`), School Hall Rental Pack
(`:145`), Third-Party Concession Settlement (`:147`), Student Wallet (`:148`), Alumni Network
(`:149`), Student Leadership/Prefect (`:150`), Online Classrooms (`:152`) — **none has a module
id**. Conversely `whatsapp`, `bell_management`, `digital_noticeboard`, `assets` are licensable
leaf nodes with no edition binding. **No rule states which key space is authoritative**, and
`:767` requires a Wallet GL treatment that the certificate cannot express.
**Remedy:** Phase D task D-8.

### D-22 · Six `PC-` decision packs gate the critical path and are unowned, undated, and unkeyed
`School_Setup_Workflow_v1.1.md:10` declares them. There is **no project key `PC-`** — the repo
declares `PLT`, `SET`, `HRM`, `ACD` (`PlatformCore_v2.md:5`, `SchoolSetup_v1.md:6`). Each is a
two-word noun phrase in one sentence, with no title, body, acceptance criteria, status, owner,
date, or dependency.

| ID | Subject | State | Gates | Occurrences outside the Workflow doc |
|---|---|---|---|---|
| `PC-000` | Attendance | "being designed" | Phase 3; `FR-SET` attendance-type lock (`SchoolSetup_v1.md:431`) | MP `:488,1073`; `SchoolSetup_v1.md:431,438,439` |
| `PC-001` | Leave/Workforce | "being designed" | Phase 4 | **none — orphan** |
| `PC-002` | Grading & Moderation | "being designed" | `FR-ACD-15`; `ACD-EPIC-08` (31 pts); year-end UAT scenario 7 (`:1068`) | MP `:538,1073`; SRS `:177`; `SchoolSetup_v1.md:1548,1567,1568,1581` |
| `PC-003` | Tax & currency | "no design yet" | the entire GL (`Workflow :735`) | MP `:1073` (inside a range string only) |
| `PC-004` | Admission | "no design yet" | MVP AC "admissions through report cards" (`SRS :503,518`) | **none — orphan** |
| `PC-005` | BookShop/Canteen/Hall | "proposed" | Phase 10 | **none — orphan** |
| `PC-006` | Student Wallet | "proposed" | Phase 10 | **none — orphan** |

Only one containment rule exists for any of them: `Workflow :635` — *"Until `PC-004` is designed,
load existing students via import and use a minimal manual registration path."*
**Remedy:** Phase D task D-9.

### D-23 · The MVP definition contradicts itself six ways
`SRS_v1.3.md:509` defines MVP = P0 only. Then:

| Contradiction | Line |
|---|---|
| Phase 1 exit requires `FR-PLT-01–08, 11–15` → includes `FR-PLT-02/06/08`, all **P1** | `:588` |
| Phase 1A exit requires `FR-SET-01–12` → includes `FR-SET-08/09/10/11`, all **P1** | `:589` |
| Phase 2 exit requires `FR-ACA-01–08` → includes `FR-ACA-05`, **P2**, which `:530` defers to Phase 11 | `:590` |
| `FR-SET-12` is **P0** at `:158` but is missing from the "In MVP (P0)" list | `:158` vs `:517` |
| Library is listed under "Fast-Follow (**P1**)" but `FR-LIB-01` is **P2** | `:526` vs `:243` |
| MVP AC5 requires a mobile Personal Portal; `FR-MOB-01/03` are gated only at **Phase 14** | `:516,547` vs `:603` |
| MVP AC4 requires a payment that "reconciles correctly", but the double-entry GL (`FR-FIN-03/06`) is **P1 and assigned to no phase** | `:546,414` vs `:225,228` |

Also: `Admission`, `Student Management`, and `Admin & User Management` are declared MVP scope
at `:518` but have **zero FRs** anywhere in Part A.
**Remedy:** Phase D task D-6.

### D-24 · Milestone namespace has three owners and three meanings
| Source | M1 | M2 |
|---|---|---|
| `Master_Plan_v5.3.md:1073` | Platform Core + Admin Console | School Setup + Academic Setup |
| `SRS_v1.3.md:618-623` | SRS & ERD Sign-Off (end Phase 0) | Foundation Complete (end Phase 1) |
| `PlatformCore_v2.md` | **36 of 39 stories tagged `M1`** | not used |
| `SchoolSetup_v1.md:4` | not used | **54 of 54 stories tagged `M2`** |
| `School_Setup_Workflow_v1.1.md:10` | — | "Mobile app setup is **milestone 2**" |
| `ADR-005` | — | `mobile-is-milestone-2` |

Under SRS §24, tagging 269 points of School+Academic Setup as "M2" places them **before**
M3 = MVP Go-Live. Importing SRS §24 into Jira would relabel ~90 stories incorrectly.
**Remedy:** Phase D task D-4.

### D-25 · The Document/Print Engine is required by Phase 5 and built by no phase
`Master_Plan_v5.3.md:1025` — Phase 1 includes *"Document/Print Engine skeleton"*.
`SRS_v1.3.md:588` — Phase 1 drops it. Phase 5 is *"Identity & Document Generator"*, exit
*"Report Card A4/A5 generation E2E green — **MVP-critical path**"* (`:593`).
`School_Setup_Workflow_v1.1.md:939` depends on template versioning. **No phase in either
roadmap builds the engine.**
**Remedy:** Phase D task D-6.

### D-26 · 18 acceptance criteria say "matches the specification" without naming it
`SchoolSetup_v1.md` — 18 ACs are unfalsifiable without also holding Master Plan §5A/§5B:
`:62, 232, 521, 587, 645, 736, 890, 944, 1002, 1033, 1091, 1133, 1193, 1235, 1298, 1365,
1385, 1419, 1442, 1474, 1475, 1524`.
**Remedy:** Phase D task D-6.

## S3 — Medium

### D-27 · `PeriodScheduleCalculator` has no stated expected output
`SchoolSetup_v1.md:1055-1074`. AC1 (`:1065`) supplies an input (start 08:00, 8×40 min,
15-min break after P2, 30-min lunch after P5) and asserts *"the grid is correct to the minute"*
— **without stating what correct is.** Its 6 test cases (`:1073`) include "over-fit day", but
`ACD-301-T2` (`:1042`) says over-fit is *rejected at validation* — so what the calculator
returns on invalid input (throw / clamp / overflow) is a genuine contract ambiguity between two
stories. No input type, no return type, no `scheduleEnd` in the example.
**Remedy:** Phase D task D-10.

### D-28 · `ITimetableConstraintPolicy` cannot be implemented as scoped
`SchoolSetup_v1.md:700-724`. `checkWeeklyLoad` must validate that hours and periods "must not
contradict each other **given period duration**" (`:685`) — but `periodDurationMin` lives on
`AcademicLevel` in `ACD-EPIC-03` (`:1038`), and **no dependency edge exists from `SET-602` to
`ACD-301`**. Return type undefined. "Consecutive blocks across breaks" (`:719`) does not say
whether lunch resets the counter — which alone determines the whole feature. Whether the limit
blocks or warns is deferred: MP `:514` "hard limit", SRS `:156` "enforce", Workflow `:463`
"used by assignment **warnings**", `SchoolSetup_v1.md:1450` "warn, do not block, **unless the
owner decides otherwise**".
**Remedy:** Phase D task D-10.

### D-29 · `IApprovalWorkflow` is required by a 13-point story and defined nowhere
`SchoolSetup_v1.md:1585,1594` require `ACD-802` (13 pts) to route overrides through
`IApprovalWorkflow`. That interface appears only as a concept in the Master Plan (`:696,737,
764,864,919`) and is owned by no story in either Jira doc.
**Remedy:** Phase D task D-10.

### D-30 · `ACCEPTANCE: ACD-802` depends on two non-resolvable issue keys
`SchoolSetup_v1.md:1581` — *"Depends on: ACD-801, ACD-601, **Student Management**, **grading
(PC-002)**"*. Two of four dependencies are prose nouns, not issue keys.
**Remedy:** Phase D task D-9.

### D-31 · `FR-ACD-16` is a P0 MVP requirement with no story
"System shall never hard-delete setup records that are referenced" (`SRS_v1.3.md:178`, listed
in MVP scope at `:517`). **Zero occurrences in either Jira doc.** It is implemented as
incidental prose in 8 separate tasks (`SchoolSetup_v1.md:477,567,626,984,1046,1174,1277,1346`)
with no consolidating story and no test.
**Remedy:** Phase D task D-11.

### D-32 · `HRM-EPIC-01` spends 16 points with no requirement behind it
`SchoolSetup_v1.md:755` maps to *"Master Plan §5B items 11 and 13 — no SRS FR at all"*. The SRS
mentions a teacher directory only as a dependency of `FR-ACD-12` (`:174`). It is a **hard
blocker** (`ACD-EPIC-07`'s Definition of Ready, `:1405`) yet is `P1`.
**Remedy:** Phase D task D-11.

### D-33 · Two storage strategies, unreconciled
`Master_Plan_v5.3.md:472` puts the school logo **in the database as `bytea`**.
`:111` sends ID photos, homework attachments, certificate PDFs to S3-compatible object storage.
`:236` lists a third path, a `Storage & File Manager` platform module. **No rationale is given
for co-locating the one asset the unauthenticated login page needs with transactional data.**
**Remedy:** Phase D task D-8.

### D-34 · Six structural defects in the Jira epic documents
| # | Defect | Evidence |
|---|---|---|
| a | `C-S3` is skipped in **50 of 54** close-outs (S2 → S4). Never documented as reserved. A Jira importer will read it as 54 numbering bugs. | `SchoolSetup_v1.md` all `-C` tasks |
| b | 5 owner-decision tasks have a sub-task that is a **verbatim copy** of the parent. | `SchoolSetup_v1.md:438-439, 689-690, 1281-1282, 1344-1345, 1567-1568` |
| c | 7 pure test-writing tasks are sequenced **after** their implementation task, inverting the mandated RED→GREEN order they themselves assert. | `SchoolSetup_v1.md:214,328,383,504,719,1073,1602` |
| d | Duplicate label: `architecture` appears twice on `PLT-203`. | `PlatformCore_v2.md:371` |
| e | Task-template mismatches: backend negative tests use the UI template; UI screens use the backend RED/GREEN template. | `PlatformCore_v2.md:451`; `SchoolSetup_v1.md:241,405-413,530,739,809` |
| f | `PLT-303` AC is self-cancelling: *"without app restart **(or with a clearly communicated restart requirement)**"*. | `PlatformCore_v2.md:541` |
| **g** | **Sprint arithmetic is not credible.** Sprint 2 = **60 points**, Sprint 3 = **77 points**, both 2-week sprints, against Sprint 0's 8 points. Sprint 2 contains `PLT-1005`, whose declared dependency `PLT-601` is in Sprint 3. The stated critical path (`EPIC-01 → 02 → 03 → 04`) contradicts the sprint table, which schedules Audit (Sprint 2) before Licensing (Sprint 3). | `PlatformCore_v2.md:1336-1346` |

### D-35 · 9 vocabulary collisions, one self-documented as unresolved
`Section`/`Level`/`Class`/`Grade` (MP `:542` flags this as an open owner decision and ships
anyway) · parent/guardian/sponsor · enrolment/enrollment/admission/registration (split by
document; `SRS:518` uses two spellings in one line) · period/slot/session ·
staff/teacher/employee · grade/standard · school/institution/academy · Subject/course/Syllabus.
**Remedy:** Phase D task D-12.

### D-36 · 11 roles have no identifier and no product definition
`Principal` is the decision authority in 28 places with no role id. `Academic Coordinator`
owns 8 ACD epics with no product role. The Workflow RACI adds Data Champion, Implementation
Lead, Support Engineer, IT contact, Trainer, HR Officer, Registrar, Hostel Warden, Librarian,
Accountant, Auditor — none in the SRS's 11 user classes (`SRS:84-96`).
**Remedy:** Phase D task D-1.

### D-37 · The mandated UI template contradicts the mandated stack, and supplies almost nothing
`Master_Plan_v5.3.md:7` declares Tailwind + shadcn/ui. The templates use `--bg`/`--brand`/
`--accent` tokens, carry **zero Tailwind classes**, and `components.json` is absent from the
working tree. `EPIC_STATUS.md` records: **21 i18n keys, all marketing copy, zero application
keys**; **4 CSS rules of RTL**, mirroring a landing page; `prefers-reduced-motion` absent;
marketing claims "Trusted by 200+ schools" / "1.2M Students Managed" that are **false** and
must not be carried over.
**Remedy:** Phase D task D-2, Phase E task E-4.

## S4 — Hygiene

### D-38 · Version and date contradictions
`School_Setup_Workflow_v1.1.md:4` carries **two dates on one line** ("October 9, 2026" and
"September 28, 2026"); its footer says **v1.0** (`:1408`) against filename `v1.1`;
`PlatformCore_v2.md:4` says `Supersedes: v1` — absent from the tree. `Master_Plan_v5.3.md:4`
declares the consolidated edition merges v2.0 + v3.0 + v4.0 + v5.0 but the body contains v5.1,
v5.2 and v5.3 content. TOC says `[REVISED v5]` (`:54`), heading says `[REVISED v4]` (`:1019`).
`School_Setup_Workflow_v1.1.md:4` has no author, no status, no approver — and it is used as a
sign-off instrument at `:1086`, `:1135`.
### D-39 · `docs/work/*` is empty but every close-out task writes to it
`BACKLOG.md`, `CHANGELOG.md`, `TODO.md` = 0 bytes; `WORKLOG.md` = 1 byte. Yet all 93
`-C-S1` close-out sub-tasks across both Jira docs require *"update `WORKLOG.md` and `TODO.md`"*,
and `PlatformCore_v2.md:1226` mandates a CI check that **fails** without a `WORKLOG.md` entry.
### D-40 · `docs/diagrams/` has zero inbound references
`EduFlow360_Diagrams.html` (604 lines) and `.excalidraw` (85 elements) are referenced by
nothing except each other — while Phase 0 requires "Architecture … Sign-Off"
(`Master_Plan_v5.3.md:1022`).
### D-41 · `ADR-022` and `ADR-023` are missing
The archive holds `ADR-001…021` + `ADR-024`. This is a real gap in the record, not an
extraction artifact — verified in both the listing and the extraction.
### D-42 · Encoding is UTF-8 without BOM
All core docs decode as strict UTF-8. `—`, `→`, `§` mangle on any read without
`-Encoding UTF8`. The recovered `.gitattributes` + `scripts/docs-verify.mjs` already solve this.

---

# PART IV — CROSS-DOCUMENT CONTRADICTION MATRIX

Ten rows. Each is a place where two authoritative documents cannot both be right. **These are
the reconciliation backlog** — Phase D exists to close them, in this order.

| # | Contradiction | Doc A | Doc B | Severity | Phase D task |
|---|---|---|---|---|---|
| **X-1** | **Milestone namespace** | MP `:1073` M1/M2 = features | SRS `:618` M1/M2 = phases | S1 | D-4 |
| **X-2** | **Roadmap authority** — 16 phases vs 17 rows vs Jira milestone column vs 22 setup phases | MP §28 `:1019` | SRS §22 `:585` | S1 | D-4 |
| **X-3** | **Document/Print Engine** — required Phase 1, dropped, needed Phase 5 | MP `:1025` | SRS `:588`, `:593` | S1 | D-6 |
| **X-4** | **General Ledger** — MP Phase 6; SRS P1 and unassigned; MVP AC4 requires a reconciling payment | MP `:1041` | SRS `:225,228,546,594` | S1 | D-6 |
| **X-5** | **i18n/RTL** — required at launch ×3 docs; `FR-PLT-09/10` have zero stories | MP `:118,438`; SRS `:322` | `PlatformCore_v2.md:6,1346` | S1 | D-2, E-4 |
| **X-6** | **Scheduler limits: hard limit vs warning** | MP `:514` "hard limit"; SRS `:156` "enforce" | Workflow `:463` "warnings"; `SchoolSetup_v1.md:1450` "warn, do not block" | S2 | D-10 |
| **X-7** | **License `allowed_modules` vs edition matrix** — 4 domains have entitlements but no module id | MP `:183-189` | MP `:144-152`, `:767` | S2 | D-8 |
| **X-8** | **Rooms entity** — gated as if existing, proposed upstream | Workflow `:595,1236` | MP `:542(b)`, `:533` | S2 | D-10 |
| **X-9** | **Template vs stack** — Tailwind/shadcn declared; templates have zero Tailwind classes and 21 marketing-only i18n keys | MP `:7` | `EPIC_STATUS.md`, `SchoolSetup_v1.md:8` | S3 | D-2 |
| **X-10** | **Project identity** — `EduFlow` vs `EduFlow360` | `.env.example:1,11,13,23,25,76`; recovered `origin` | all working-tree core docs | S1 | A-3, C-1 |

---

# PART V — ARCHITECTURAL GAPS

Things that are absent, not merely wrong. Each is a prerequisite for Phase F.

| # | Gap | Why it blocks | Source of truth to adopt |
|---|---|---|---|
| **G-1** | **Permission catalogue** | Every route needs a permission key; `@RequirePermission` has nothing to check | **Recovered** — `PLT-201` built the catalogue + 5 system roles + seed (`EPIC_STATUS.md`, `PLT-EPIC-02 ~75%`). Transcribe, do not design. |
| **G-2** | **ERD** | Phase 0's exit gate is "SRS + ERD sign-off"; 2 DoRs name ERD artefacts that don't exist in the working tree | **Recovered** — `docs/diagrams/ERD_PLATFORM_CORE.md`, `ERD_PROJECT_AND_ARCHITECTURE.md`, plus `ADR-013` |
| **G-3** | **Version floor** | Zero versions in 6,230 lines of docs | **Recovered** — `package.json` + `.nvmrc` + 21 ADRs |
| **G-4** | **Technology decisions for unnamed subsystems** | ORM, migration tool, test runner, linter, bundler, observability, secrets manager, backup tooling | **Partly recovered** — `ADR-020` (Vitest), `ADR-021` (next-intl), `ADR-015` (MinIO/S3), `ADR-016` (Prometheus), `ADR-014` (SMTP). Missing: ORM + migration tool must be confirmed. |
| **G-5** | **Ownership-policy registry** | `IOwnershipPolicy` has no list of registered entity types, and **no stated default** for an unregistered type — allow or deny is undefined | **Recovered** — `PLT-203` shipped the engine. The *registry* is still needed. |
| **G-6** | **`IApprovalWorkflow` definition** | Blocks `ACD-802` (13 pts) and every approval chain in 6 modules | Must be authored (Phase D-10) |
| **G-7** | **`PeriodScheduleCalculator` contract** | Blocks `ACD-302`, and transitively Timetable + Bell | Must be authored (Phase D-10) |
| **G-8** | **`IApprovalWorkflow`/`ITimetableConstraintPolicy` cross-epic edges** | `SET-602 → ACD-301` edge is undeclared; a clean DAG that is wrong | Phase D-10 |
| **G-9** | **i18n key inventory** | 21 keys exist, all marketing; every application string must be authored ×4 locales | Must be generated from the 5 docs (Phase E-4) |
| **G-10** | **Data retention schedule** | NFR-07 says "configurable per module"; no module has a value | Must be authored (Phase D-5) |
| **G-11** | **DR/backup plan** | NFR-04 has no RPO/RTO; the Workflow requires a restore test but records no target | Must be authored (Phase D-5) |
| **G-12** | **Glossary** | 9 collisions, 11 undefined roles | Phase D-12 |

---

# PART VI — ROOT CAUSES

Five causes explain all 42 debt items. Fixing symptoms without fixing these reproduces them.

| ID | Root cause | Traces to |
|---|---|---|
| **RC-1** | **The project was archived, never version-controlled, then the remote was renamed away.** Git was a zip file, not a server. When the repo was renamed `EduFlow → EduFlow360`, every clone's `origin` 404'd and nobody noticed because the 7z still worked. | D-01, D-04, and the doc-split (I.4) |
| **RC-2** | **The doc refresh ran ahead of the code, and nothing gated it.** Five documents advanced one version in one session, adding 28 FRs, 2 new Jira plans, 3,048 work items and 2 roadmap phases — against 2 of 34 stories complete. | D-14, D-20, D-23, D-25, D-26, I.4 |
| **RC-3** | **Three roadmap owners, none designated.** MP §28, SRS §22, and the Jira milestone column each claim authority; the Workflow adds a fourth timeline in setup phases. | D-24, X-1, X-2 |
| **RC-4** | **Gates measure presence, not soundness.** Nine green gates once shipped an app that could not boot. `@RequireEntitlement` and `@Audited` enforce and write nothing. The lesson lives only in a status file. | D-17, and the 8 of 10 platform epics at 0% |
| **RC-5** | **One concept, many documents, no mapping table.** Every doc restates the same entities with slightly different names, and no artefact says which doc wins for which concept. | D-11, D-12, D-35, D-36, G-* |

---

# PART VII — STRATEGIC ROADMAP

## Sequencing principle

> **Anchor before repair. Repair before specification. Specification before scale.**
> Phase A is a **data-loss incident response**, not housekeeping: 88 commits currently have
> exactly one copy, on one disk, inside an unencrypted archive.

```
        ┌─────────────────────────────────────────────┐
        │ A · ANCHOR          ~2 h   ── incident      │  88 commits have 1 copy
        │   remote + rotate + push                   │  gate: history on a real remote
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │ B · RESTORE         ~2 h                    │  working tree has code + history
        │   adopt .git, code, ADRs, ERDs             │  gate: 0 stubs, 0 byte files
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │ C · ADJUDICATE      1 day                   │  5 newer docs vs SSOT+21 ADRs
        │   diff the doc split; unify env & ports    │  gate: every delta ruled on
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │ D · SPECIFY         3–5 days                 │  10 contradictions closed
        │   close X-1..X-10; ship G-1..G-12          │  gate: permission catalogue + ERD + NFRs
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │ E · CLOSE FOUNDATION 2–3 weeks               │  every P0 epic has code+proof
        │   SEC-115, RBAC, audit, entitlement         │  gate: gates prove soundness
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │ F · ONE VERTICAL SLICE 4–6 weeks            │  54 stories already decomposed
        │   execute SET + ACD end to end             │  gate: school configured, UAT G0–G9
        └──────────────────┬──────────────────────────┘
                           ▼
        ┌─────────────────────────────────────────────┐
        │ G · SCALE           ongoing                  │
        │   Attendance → Finance → the other 19 domains│
        └─────────────────────────────────────────────┘
```

## Why this order

1. **A before everything.** The 7z is the sole copy of 88 commits. Any other work that
   damages it is unrecoverable. Rotating credentials is also cheapest now, while the working
   tree is still 25 files.
2. **A before B.** Rotate at the provider while the exposure surface is small, and push the
   history before touching the recovered tree.
3. **B before C.** Restoring `AGENTS.md` (41,943 B), `SSOT.md` (156,704 B), `WORKLOG.md`
   (589,400 B), `ARCHITECTURE.md` (26,993 B) and 21 ADRs fixes **more than 20 individual debt
   items at once** — D-03, D-12, D-18, D-20, D-39, G-1, G-2, G-3 all collapse.
4. **C before D.** Writing a glossary or a permission matrix on top of an unreconciled
   two-generation doc set means writing it twice.
5. **D before E.** `PLT-3xx` entitlement enforcement needs the license key-space decision
   (X-7); `PLT-2xx` needs the role semantics decision (D-19).
6. **E before F.** School Setup's 54 stories assume `PLT-201`, `PLT-202`, `PLT-601`,
   `PLT-205`, `PLT-801` — 5 platform stories that are not done.

## Corrections to the prior plan

| Prior task | Status | Action |
|---|---|---|
| 0.3 — install `.gitignore` | **DONE.** `.gitignore` = 2,795 B, covers `.env`, `.env.*`, `.claude/`, `*.7z` | skip |
| 0.4 — extract the archive | **DONE**, but without the `-x"!node_modules"` filter: 42,426 files, 36,309 of them `node_modules` | keep; delete `node_modules` in place, do not re-extract |
| 0.5–0.9 — diff, adopt `.git`, restore, quarantine, prove | not done | → Phase B |
| 1.5 — port contract | not done; **new evidence**: the recovered `env.ts` is the authority | → Phase C-4 |
| 1.6 — env reconciliation | not done; **this is the recovered repo's own next ticket, `SEC-115`** | → Phase C-2 |
| 1.9 — fill `ARCHITECTURE.md` | **NO-OP.** The recovered file is 26,993 B | skip |
| — | **not in the prior plan** | Phase A: dead remote + no backup |
| — | **not in the prior plan** | Phase C: the doc split is a *forward refresh*, not a truncation — it needs adjudication, not restoration |

---

# PART VIII — PHASE A: ANCHOR *(executable)*

**Goal:** 88 commits have a durable home; live credentials are rotated; the archive is no
longer a credential leak.
**Gate:** `git ls-remote` returns `ff88d3c`; the two provider consoles show the old
credentials revoked; no unencrypted archive contains a credential.

> **Two tasks require you.** A-1 and A-2 need a console session at `tokenharbor.ai` and in
> Google Cloud Console that this agent does not have. Everything else is mechanical.

### Task A-1: Revoke and reissue the third-party gateway token

**Files:**
- Modify: `H:\AI-Dev\MyProjects\EduFlow360\.claude\settings.json`
- Create: `docs/work/INCIDENT_2026-10-09_gateway-token.md`

- [ ] **Step 1: Record the exposure without recording the value**

Create `docs/work/INCIDENT_2026-10-09_gateway-token.md` with exactly this content:

```markdown
# Incident — third-party model gateway token (2026-10-09)

| Field | Value |
|---|---|
| Where exposed | `.claude/settings.json` -> `env.ANTHROPIC_AUTH_TOKEN` |
| Token prefix | `thk_live_` (never record the full value) |
| Value length | 37 characters |
| Gateway host | third-party; recorded as `ANTHROPIC_BASE_URL`, value withheld |
| Also present in | `New folder.7z` (unencrypted) |
| Exposed since | at least 2026-10-09 16:59 (file mtime) |
| Action | revoked at provider, reissued, stored in the secrets manager |
```

- [ ] **Step 2: Revoke at the provider**

Sign in to the gateway console as the account owner. Revoke the existing token. Create a new
one. Do **not** paste either value into any file in this repository.

- [ ] **Step 3: Confirm revocation**

Run a request with the old token. Expected: `401` or `403`, not `200`.

- [ ] **Step 4: Replace the local setting**

Set `ANTHROPIC_AUTH_TOKEN` in `.claude/settings.json` to the new value.
Confirm `.gitignore` still lists `.claude/`.

- [ ] **Step 5: Decide the routing, and write it down**

Owner decision: keep the third-party gateway, or route to Anthropic directly? A cost,
privacy and data-residency question. If kept, write `docs/adr/ADR-025-third-party-model-gateway.md`:

```markdown
# ADR-025 — Third-party model gateway routing

- Status: Accepted
- Date: 2026-10-09
- Context: EduFlow360 development sessions route LLM traffic through a third-party gateway.
- Decision: [retained | replaced by direct Anthropic API].
- Constraints: no EduFlow source code, no credentials, and no school data transit the
  gateway. Development traffic only.
- Consequences: [record cost ceiling and rotation cadence].
```

- [ ] **Step 6: Commit**

```bash
git add docs/work/INCIDENT_2026-10-09_gateway-token.md docs/adr/ADR-025-third-party-model-gateway.md
git commit -m "docs(security): revoke exposed gateway token, record ADR-025"
```

> Do not run this commit until Phase B has adopted `.git`. Until then the tree is not a repo.

### Task A-2: Rotate the Google OAuth client secret

**Files:**
- Modify: `H:\AI-Dev\MyProjects\EduFlow360\.env.local` (regenerate locally only)
- Append to: `docs/work/INCIDENT_2026-10-09_gateway-token.md`

- [ ] **Step 1: Delete and recreate the client secret**

Google Cloud Console → the OAuth client used for EduFlow → *Delete client secret* → create a
new one. The old secret carries the `GOCSPX-` prefix and is inside `New folder.7z`.

- [ ] **Step 2: Confirm the old secret is dead**

Call the token endpoint with the old secret. Expected: `invalid_client`.

- [ ] **Step 3: Update `.env.local` with the new value**

- [ ] **Step 4: Append the record**

Add a second table row block to the incident file recording exposure, prefix `GOCSPX-`,
length, and confirmation of `invalid_client`. **Do not** record the new value.

### Task A-3: Re-point the remote and push the 88 commits

**Files:**
- Modify: `<recovered>\.git\config` (via `git remote set-url`)
- No file edits.

> The GitHub repo `siraj-77/EduFlow360` currently holds **1 commit and 1 file**. Pushing
> `main` onto it is safe and is the whole point of this task.

- [ ] **Step 1: Confirm the recovered tree is clean before touching it**

```powershell
$rf = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
git -C $rf status --short
git -C $rf rev-parse HEAD
```

Expected: no output from the first, `ff88d3c58b1f9b1a9c18830d738dc0ef037222d7` from the second.
**If `status` is not empty, stop and report — do not push a dirty tree.**

- [ ] **Step 2: Re-point the remote**

```powershell
git -C $rf remote set-url origin https://github.com/siraj-77/EduFlow360.git
git -C $rf remote -v
```

Expected: both fetch and push show `EduFlow360.git`.

- [ ] **Step 3: Fetch and inspect what the remote already has**

```powershell
git -C $rf fetch origin
git -C $rf log --oneline origin/main -3
```

Expected: `97c803f Initial commit`. This is an **unrelated root commit** with no common
ancestor with `ff88d3c`. Do not merge it.

- [ ] **Step 4: Push the real history as `main`**

```powershell
git -C $rf push -u origin main --force-with-lease
```

`--force-with-lease` is required: the remote's `97c803f` is unrelated, and without the lease
this would refuse.

- [ ] **Step 5: Verify**

```powershell
git -C $rf ls-remote origin refs/heads/main
gh repo view siraj-77/EduFlow360 --json diskUsage
```

Expected: `ff88d3c58b1f9b1a9c18830d738dc0ef037222d7`, and `diskUsage` rising from `1` to a
real number.

- [ ] **Step 6: Push the other two branches**

```powershell
git -C $rf push origin docs/reconcile-with-agentic-prompt-pack
git -C $rf push origin siraj-77/ERD
```

- [ ] **Step 7: Prove a fresh clone reproduces the tree**

```powershell
$probe = "$env:LOCALAPPDATA\opencode\eduflow360-verify"
Remove-Item -Recurse -Force $probe -ErrorAction SilentlyContinue
git clone --quiet https://github.com/siraj-77/EduFlow360.git $probe
git -C $probe rev-parse HEAD
git -C $probe rev-list --count HEAD
(Get-ChildItem "$probe\apps\api\src" -Recurse -Filter *.ts).Count
```

Expected: `ff88d3c…`, `88`, `168`. **This is the gate for the entire phase.**

### Task A-4: Replicate the archive — do not move it

**Files:**
- Create: `H:\AI-Dev\_backups\eduflow360\`
- Move (after A-5): `H:\AI-Dev\MyProjects\EduFlow360\New folder.7z`

> The prior plan (task 0.8) says *move*. **Copy, first, and keep it.** Until A-3 step 7
> passes, the 7z is the only copy of the history.

- [ ] **Step 1: Copy, do not move**

```powershell
$src = "H:\AI-Dev\MyProjects\EduFlow360\New folder.7z"
$dst = "H:\AI-Dev\_backups\eduflow360\New folder.2026-10-09.7z"
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
Copy-Item -LiteralPath $src -Destination $dst
(Get-FileHash -Algorithm SHA256 $src).Hash
(Get-FileHash -Algorithm SHA256 $dst).Hash
```

Both hashes must match. Record the hash in `docs/work/INCIDENT_2026-10-09_gateway-token.md`.

- [ ] **Step 2: Verify the copy opens**

```powershell
& "C:\Program Files\7-Zip\7z.exe" t $dst
```

Expected: `Everything is Ok`.

### Task A-5: Re-create the archive without credentials

**Files:**
- Create: `H:\AI-Dev\_backups\eduflow360\New folder.redacted.7z`
- Delete (after A-3 passes): `H:\AI-Dev\MyProjects\EduFlow360\New folder.7z`

- [ ] **Step 1: Build the credential-free copy from the recovered tree**

```powershell
$rf  = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
$out = "H:\AI-Dev\_backups\eduflow360\New folder.redacted.7z"
& "C:\Program Files\7-Zip\7z.exe" a $out "$rf\*" `
  -x"!node_modules" -x"!.env" -x"!.env.local" -x"!.claude" -x"!.kilo" -x"!.turbo"
```

- [ ] **Step 2: Prove no credential file is inside**

```powershell
& "C:\Program Files\7-Zip\7z.exe" l $out | Select-String -Pattern '\.env|settings\.json'
```

Expected: no match, or only `.env.example` and `.gitignore` rule comments.

- [ ] **Step 3: Re-encrypt the original, or move it off this machine**

The original `New folder.7z` still contains three credential files. Either:

```powershell
# Option A — delete it, now that A-3 step 7 has proven the history is on the remote
Remove-Item -LiteralPath "H:\AI-Dev\MyProjects\EduFlow360\New folder.7z"
```

or move it to encrypted offline storage. **Do not keep an unencrypted credential-bearing
archive next to the project once a remote copy of the history exists.**

- [ ] **Step 4: Record closure**

Append to the incident file: remote verified, archive replicated and redacted, original
dispositioned, date.

### Task A-6: Phase gate

- [ ] [ ] `git ls-remote` returns `ff88d3c` for `refs/heads/main`
- [ ] [ ] A fresh clone contains 168 `apps/api/src/**/*.ts` and 88 commits
- [ ] [ ] The gateway console shows the old token revoked; a request with it returns 401/403
- [ ] [ ] The OAuth console shows the old client secret deleted; a token call returns `invalid_client`
- [ ] [ ] No unencrypted archive on this machine contains `.env`, `.env.local`, or `.claude/settings.json`
- [ ] [ ] `ADR-025` exists and names a decision

---

# PART IX — PHASE B: RESTORE *(executable)*

**Goal:** the working directory holds the real project — code, history, ADRs, ERDs, and a
non-empty contract — while keeping the 5 newer core docs.
**Gate:** `git status` clean, 0 zero-byte files, `pnpm install` succeeds, `pnpm build` green.

### Task B-1: Adopt the recovered `.git`

**Files:**
- Create: `H:\AI-Dev\MyProjects\EduFlow360\.git` (copy)

- [ ] **Step 1: Confirm the working tree holds nothing unique**

```powershell
Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360" -Recurse -File -Force |
  Where-Object { $_.Name -notlike '*.7z' } |
  Select-Object FullName, Length
```

Everything except the 5 `EduFlow360_*` core docs and the new plan file must already exist in
the recovered tree. **If anything appears that is not in the recovered tree, stop and
report it — do not overwrite.**

- [ ] **Step 2: Copy `.git`**

```powershell
Copy-Item -Recurse -Force "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder\.git" "H:\AI-Dev\MyProjects\EduFlow360\.git"
git -C "H:\AI-Dev\MyProjects\EduFlow360" log --oneline -1
git -C "H:\AI-Dev\MyProjects\EduFlow360" status --short
```

Expected: `ff88d3c`, then a short list containing the 8 stub files and the newer docs.

- [ ] **Step 3: Record that list — it is the Phase C worklist**

```powershell
git -C "H:\AI-Dev\MyProjects\EduFlow360" status --short |
  Out-File -Encoding UTF8 "H:\AI-Dev\MyProjects\EduFlow360\docs\work\RESTORE_DELTA.md"
```

### Task B-2: Restore the project tree, protecting the 5 newer docs

**Files:**
- Create: everything under `apps/`, `packages/`, `infra/`, `scripts/`, `.github/`
- Modify: `AGENTS.md`, `README.md`, `CLAUDE.md`, `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `components.json`, `.prettierrc.json`, `.editorconfig`, `.npmrc`, `.nvmrc`, `route-permissions.json`, `route-guards.allowlist.json`, `.gitattributes`

> Do **not** use `robocopy /MIR`. The 5 `EduFlow360_*` docs and this plan file are
> working-tree-only and would be deleted.

- [ ] **Step 1: Copy the code and config, excluding the doc sets**

```powershell
$src = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
$dst = "H:\AI-Dev\MyProjects\EduFlow360"
foreach ($item in @('apps','packages','infra','scripts','.github','.kilo')) {
  $p = Join-Path $src $item
  if (Test-Path $p) { Copy-Item -Recurse -Force $p (Join-Path $dst $item) }
}
foreach ($f in @('package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json',
                 'components.json','.prettierrc.json','.editorconfig','.npmrc','.nvmrc',
                 '.gitattributes','route-permissions.json','route-guards.allowlist.json')) {
  $p = Join-Path $src $f
  if (Test-Path $p) { Copy-Item -Force $p (Join-Path $dst $f) }
}
```

- [ ] **Step 2: Copy `AGENTS.md` and `README.md` over the 0-byte stubs**

```powershell
Copy-Item -Force "$src\AGENTS.md"  "$dst\AGENTS.md"
Copy-Item -Force "$src\README.md"  "$dst\README.md"
```

- [ ] **Step 3: Merge `.gitignore` rather than replacing it**

The working-tree `.gitignore` (2,795 B) = the archive's (2,474 B) + remediation comment
blocks. Keep the working-tree version; confirm it still contains `.env`, `.env.*`,
`!.env.example`, `.claude/`, `node_modules/`, `.turbo/`, `*.7z`.

- [ ] **Step 4: Copy the recovered `docs/` subtrees, except `docs/core`**

```powershell
foreach ($item in @('docs\adr','docs\analysis','docs\design','docs\idea-bank','docs\work','docs\superpowers')) {
  $p = Join-Path $src $item
  if (Test-Path $p) { Copy-Item -Recurse -Force $p (Join-Path $dst $item) }
}
Copy-Item -Force "$src\docs\core\SSOT.md"          "$dst\docs\core\SSOT.md"
Copy-Item -Force "$src\docs\core\ARCHITECTURE.md"  "$dst\docs\core\ARCHITECTURE.md"
```

`docs\core\SSOT.md` and `ARCHITECTURE.md` are copied explicitly and **not** the whole
`EduFlow_*` set, so the 5 `EduFlow360_*` docs survive untouched.

- [ ] **Step 5: Copy the recovered ERDs into `docs/diagrams/`**

```powershell
Copy-Item -Force "$src\docs\diagrams\*" "$dst\docs\diagrams\"
```

- [ ] **Step 6: Prove no stub remains**

```powershell
Get-ChildItem $dst -Recurse -File -Force |
  Where-Object { $_.Length -eq 0 } |
  Select-Object FullName
```

Expected: empty. If anything is listed, it is a genuine empty file — confirm each is
intentional before proceeding.

### Task B-3: Remove `node_modules` from the recovery copy

**Files:**
- Delete: `%LOCALAPPDATA%\opencode\eduflow-recovered\New folder\node_modules` (36,309 files)

- [ ] **Step 1: Confirm the working tree has its own**

```powershell
Test-Path "H:\AI-Dev\MyProjects\EduFlow360\node_modules"
```

- [ ] **Step 2: Delete the recovery copy's `node_modules`**

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder\node_modules"
```

Do this only after B-2 step 6 passes. It is a large deletion in a temp directory, never in
the working tree.

### Task B-4: Install and prove the build

**Files:** none edited.

- [ ] **Step 1: Confirm the toolchain**

```powershell
node --version
pnpm --version
```

Expected: Node ≥ 22 (per `.nvmrc`), pnpm 11.22.0.

- [ ] **Step 2: Install**

```powershell
pnpm install
```

- [ ] **Step 3: Run the gates, in order**

```powershell
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm docs:verify
pnpm check:route-guards
pnpm check:coverage-tiers
pnpm build
```

Expected per `docs/work/EPIC_STATUS.md`: all ten `AGENTS.md §4` gates green at `ff88d3c`.

- [ ] **Step 4: Do not run `pnpm test:integration` yet**

`SEC-112` (integration schema isolation) is open and is the likely owner of a cold-cache
setup-token flake (`RESUME_2026-10-09.md`). A failure there is a **known** issue, not a
regression. Record it; do not chase it.

- [ ] **Step 5: Stage the restoration and commit**

```bash
git add -A
git commit -m "chore(restore): recover working tree from archive at ff88d3c

Adopt the archived .git (88 commits) and restore apps/, packages/, infra/,
scripts/, .github/, 21 ADRs, 2 ERDs, SSOT.md, ARCHITECTURE.md, AGENTS.md and
the work/ idea-bank/ design/ doc sets.

The five EduFlow360_* core docs are working-tree-only and are preserved
unmodified; they are adjudicated in the next phase."
```

### Task B-5: Phase gate

- [ ] [ ] `git log --oneline -1` shows the restore commit
- [ ] [ ] zero 0-byte files under the project root
- [ ] [ ] `pnpm build` exits 0
- [ ] [ ] `docs/core/AGENTS.md` ≥ 41,943 bytes; `SSOT.md` ≥ 156,704 bytes
- [ ] [ ] the 5 `EduFlow360_*` core docs are byte-identical to their pre-restore state

---

# PART X — PHASE C: ADJUDICATE *(C-1..C-4 executable)*

**Goal:** rule on every difference between the 5 newer core docs and the recovered
`SSOT.md` + 21 ADRs + 2 ERDs, and unify the environment contract.
**Gate:** `docs/work/DOC_DELTA_2026-10-09.md` exists with one verdict per row; one port
scheme; one env scheme.

> **The critical insight.** The archive is *not* newer than the working tree — it is
> *different*. Restoring is right (Phase B); **overwriting the 5 docs with the archive's
> `EduFlow_*` versions is wrong** and would discard 28 new FRs, 3,048 new work items, and
> §5A/§5B. Every delta needs a verdict: **adopt / amend / reject**.

### Task C-1: Build the doc-delta register

**Files:**
- Create: `docs/work/DOC_DELTA_2026-10-09.md`

- [ ] **Step 1: Enumerate every delta**

Compare, by hand, in this order:

| Comparison | Newer source | Older source | Verdict column |
|---|---|---|---|
| Master Plan §5A (School Setup, 6 tabs) + §5B (Academic Setup, 17 rows) | `EduFlow360_*_v5.3.md:457-545` | absent from `EduFlow_Project_Master_Plan_v5.2.md` | |
| SRS §3.2A `FR-SET-01..12` + §3.2B `FR-ACD-01..16` | `EduFlow360_SRS_..._v1.3.md:144-178` | absent from v1.2 | |
| `Jira_Epics_SchoolSetup_Academic_v1.md` (16 epics, 54 stories) | working tree | absent from archive | |
| `PlatformCore_RBAC_v2` 10-epic restructure | working tree | `..._v1` (stories only) | |
| `Agentic_Prompt_Pack_PlatformCore_v1.md` | **archive only** | no successor | → restore into `docs/core/` (Phase D-12) |
| §5.2 Basic GL, §5.3 i18n, §5.4 Admin Console | working tree | absent | |

- [ ] **Step 2: For each row, record a verdict and a one-line reason**

```
| Delta | Source | Verdict | Reason | Blocks |
|---|---|---|---|---|
| FR-SET-01..12 | SRS v1.3 | adopt | ADRs silent; no contradiction found | — |
| FR-ACD-15 | SRS v1.3 | amend | blocked on PC-002, which has no owner | D-9 |
| Master Plan §28 phase list | MP v5.3 | reject | SRS §22 has exit criteria; MP has none | X-2 |
| Master Plan M1/M2 milestones | MP v5.3 | reject | collides with SRS §24 and 93 Jira tags | X-1 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/work/DOC_DELTA_2026-10-09.md
git commit -m "docs(delta): adjudicate the EduFlow -> EduFlow360 doc split"
```

### Task C-2: Unify the environment contract (`SEC-115`)

> This is the recovered repository's own next P0 ticket
> (`docs/work/RESUME_2026-10-09.md`, "What is next → 1. `SEC-115`"). Code wins over docs.

**Files:**
- Read: `apps/api/src/config/env.ts`, `apps/api/src/config/env-files.ts`, `apps/api/src/config/env.spec.ts`
- Modify: `.env.example`, `.env` (recreate), delete `.env.local`
- Test: `apps/api/src/config/env.spec.ts`

- [ ] **Step 1: Read the code, not the docs**

```powershell
Select-String -Path "apps\api\src\config\env.ts" -Pattern "PORT|SECRET|DATABASE_URL" |
  ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }
```

`env.ts` is the authority for the var **names**. `env-files.ts` is the authority for the
**precedence**.

- [ ] **Step 2: Record the conflict table**

| Var | Code (`env.ts`) | `.env.example` | Verdict |
|---|---|---|---|
| web port | `WEB_PORT` | `PORT=3001` (`:71`) | code |
| api port | `API_PORT` | absent | code |
| web origin | `WEB_ORIGIN` | `WEB_ORIGIN` (`:117`, value 3500) | code value |
| db | `DATABASE_URL` | `DATABASE_URL` (`:13`, placeholder) | code |

- [ ] **Step 3: Rewrite `.env.example` to match `env.ts`, and resolve all 12 placeholders**

Every placeholder must become a **greppable, local-development-only** value. The archive
convention is the `localdev` marker; keep it:

```
DATABASE_URL=postgresql://eduflow_dev:localdev@localhost:5432/eduflow_dev
JWT_ACCESS_SECRET=localdev-only-not-a-real-secret-0000000000000000
JWT_REFRESH_SECRET=localdev-only-not-a-real-secret-1111111111111111
```

Also rename `EduFlow` → `EduFlow360` in the comment header (`:1,11,76`) and
`eduflow`/`eduflow_dev` → `eduflow360`/`eduflow360_dev` in identifiers (`:13,23,25`).

- [ ] **Step 4: Delete `.env.local` and recreate `.env` in `KEY=value` form**

```powershell
Remove-Item -Force ".env.local"
```

`.env.local` carried the leaked Google secret and the forbidden `NEXTAUTH_*` pair. Both
issues die with the file. Recreate `.env` from the rewritten `.env.example` with
**no spaces around `=`**.

- [ ] **Step 5: Add two RED-first tests**

In `apps/api/src/config/env.spec.ts`:

```ts
it('rejects a placeholder value in any environment', () => {
  process.env.DATABASE_URL = '<postgresql://eduflow_dev:<password>@localhost:5432/eduflow>';
  expect(() => loadEnv({ nodeEnv: 'development' })).toThrow(/unresolved placeholder/i);
});

it('rejects a missing required variable by naming it', () => {
  delete process.env.SEED_SUPERADMIN_PASSWORD;
  expect(() => loadEnv({ nodeEnv: 'production' })).toThrow(/SEED_SUPERADMIN_PASSWORD/);
});
```

Run first — expect failure. Then implement.

- [ ] **Step 6: Run the gates**

```powershell
pnpm --filter @eduflow/api test
pnpm typecheck
pnpm lint
```

### Task C-3: Remove the Auth.js contradiction

**Files:**
- Read: `docs/adr/ADR-008-token-strategy-jwt-refresh-rotation.md`

- [ ] **Step 1: Prove no Auth.js is present**

```powershell
Select-String -Path "package.json","apps\*\package.json","packages\*\package.json" `
  -Pattern "next-auth|@auth/core|NEXTAUTH"
```

Expected: no matches.

- [ ] **Step 2: Prove `ADR-008` is a real decision, not a stub**

Read it. Confirm it selects JWT + refresh rotation and rejects session cookies.

- [ ] **Step 3: Leave `.env.example:55` as-is**

It is the correct instruction. The contradiction was `.env.local`, which C-2 deleted.

### Task C-4: Fix the port contract

**Files:**
- Modify: `.env.example`, `docs/core/EduFlow360_Project_Master_Plan_v5.3.md:450`,
  `docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md:1166`

- [ ] **Step 1: Read the code's ports**

```powershell
Select-String -Path "apps\api\src\config\env.ts","apps\web\web-port.ts" -Pattern "PORT"
```

- [ ] **Step 2: If the code is not on 3030/3031, stop and ask the owner**

Do not invent a port. `PlatformCore_v2.md:1166` is still `👤 owner confirms API dev port
(3031 is an assumption)` and the owner has not answered in 4 documents. This is a genuine
open decision (see the register below), not something to paper over.

- [ ] **Step 3: Align `.env.example` and the docs to the code**

- [ ] **Step 4: Prove no hard-coded port survives in source**

```powershell
Select-String -Path "apps\*\*\src\*.ts","apps\*\*\src\*.tsx" -Pattern "localhost:\d+"
```

Expected: no matches. `scripts/check-route-guards.mjs` enforces this in CI.

### Task C-5: Phase gate

- [ ] [ ] `DOC_DELTA_2026-10-09.md` exists with a verdict on every row
- [ ] [ ] `Select-String -Path ".env*" -Pattern "NEXTAUTH"` returns nothing
- [ ] [ ] `Select-String -Path "apps\**\src\*" -Pattern "localhost:\d+"` returns nothing
- [ ] [ ] `.env.example` contains zero bracketed placeholders
- [ ] [ ] the port decision is recorded either way

---

# PART XI — PHASE D: SPECIFY *(3–5 days, specification work)*

> These are **specifications to be written**, not tasks to execute. Writing pseudo-tasks for
> them would repeat the failure the Master Plan already exhibits in six stub sections.

| Task | Deliverable | Closes | Est. |
|---|---|---|---|
| **D-1** | **Role & permission matrix.** Adopt the recovered catalogue (5 system roles + seed) rather than re-inventing it. Decide and record: is `SCHOOL_ADMIN ⊂ SUPERADMIN`? Define `Principal` and `Academic Coordinator` as product roles or document them as out-of-system. Register all 11 Workflow RACI roles. State the guard execution order — permission, then entitlement, then ownership. Write the default-deny rule for an entity type with no registered `IOwnershipPolicy`. | D-18, D-19, D-36, G-1, G-5 | 2 d |
| **D-2** | **Version floor document.** Transcribe every version from `package.json`, `.nvmrc`, `pnpm-lock.yaml` and the 21 ADRs into `docs/core/ARCHITECTURE.md`. Add the 8 undeclared subsystems (ORM, migration tool, linter, bundler, observability, secrets manager, backup tooling, feature flags) with an explicit decision each. Record `ADR-020` (Vitest), `ADR-021` (next-intl), `ADR-015` (MinIO/S3), `ADR-016` (Prometheus), `ADR-014` (SMTP). | D-13, D-20, G-3, G-4 | 1 d |
| **D-3** | **Renumber and de-dangle the Master Plan.** §21 subs → 21.1–21.6; §26 subs → 26.1–26.3; add §5.1 or renumber §5.2–§5.4; fix all 8 dangling intra-doc refs (§9.x, §7.x, §6.1, §23.2, §5.3-mis-cite, §10.x-stale); align the TOC with the headings (`:54` vs `:1019`). | D-10, D-11 | 2 h |
| **D-4** | **One roadmap, one milestone namespace.** Designate MP §28 **or** SRS §22 as the roadmap of record — recommendation: **SRS §22**, because it is the only one with exit criteria and durations. Define one milestone set `M0…M6`. Rewrite the 90 Jira story tags. Record the 3 abandoned Phase-0 designs (`PC-004`..`PC-006`) as deferred, not pending. | D-24, X-1, X-2 | 1 d |
| **D-5** | **NFR rewrite.** Convert all 9 NFRs to "shall" form. Add a verification method column. Give NFR-01 an SLI and a window; NFR-02 a percentile; NFR-04 an RPO and RTO; NFR-08 a hardware inventory. Carve public routes out of NFR-09 (contradicts `FR-SET-03`). Add the missing NFRs: data retention schedule per module, DR restore drill, accessibility verification. | D-15, G-10, G-11 | 1 d |
| **D-6** | **Close the MVP contradictions.** Decide: does MVP include P1 FRs? (Current: Phase 1 requires `FR-PLT-02/06/08`.) Is AI Timetable Phase 2 or Phase 11? Is `FR-SET-12` P0 and unproposed, or P1? Is Library P1 or P2? Does MVP include a mobile portal? Does the GL belong in Phase 6? **Add the Document/Print Engine to a phase** — nothing currently builds it. Add FRs for Admission, Student Management, and Admin & User Management, or remove them from MVP scope. | D-23, D-25, X-3, X-4 | 1 d |
| **D-7** | **New ADR: a gate must prove soundness, not presence.** Promote `EPIC_STATUS.md:27-33` into `docs/adr/ADR-026-gates-prove-soundness.md`. Include the worked example: nine green gates, an app that could not boot, `@Audited` that writes nothing. | D-17 | 2 h |
| **D-8** | **License key space.** Either add module ids for Facilities, Alumni, Leadership, Wallet, and map `whatsapp`/`bell_management`/`digital_noticeboard`/`assets` to editions, **or** declare that `features` booleans are authoritative for leaf features and `allowed_modules` only for domains. State which is which. Resolve the three-way storage split (DB blob vs S3 vs the Storage module). | D-21, D-33, X-7 | 2 h |
| **D-9** | **Decision-pack programme.** Give `PC-000`…`PC-006` a real Jira project key, an owner, a target date, a body, and acceptance criteria. Split `ACD-802`'s dependencies into resolvable issue keys. Promote them out of prose into tracked items. | D-22, D-30, X-7 | 2 h + owner time |
| **D-10** | **Interface contracts.** Author, as reviewable docs with types and worked examples: `PeriodScheduleCalculator` (input type, return type, the expected output grid for the AC1 input, and the over-fit behaviour agreed between `ACD-301` and `ACD-302`); `ITimetableConstraintPolicy` (return type, the hours-vs-periods signature, whether a break resets the consecutive counter, and the **block-or-warn** ruling); `IApprovalWorkflow` (owner: currently none). Add the undeclared `SET-602 → ACD-301` dependency edge. | D-27, D-28, D-29, G-6, G-7, G-8, X-6, X-8 | 1 d |
| **D-11** | **Orphan requirements.** Add a story for `FR-ACD-16` (never hard-delete referenced setup records) — it is P0 MVP scope with zero coverage. Give `HRM-EPIC-01` a real FR or merge it into a parent epic's scope and raise it off `P1`, since it blocks `ACD-EPIC-07`. | D-31, D-32 | 2 h |
| **D-12** | **Glossary.** `docs/core/GLOSSARY.md`. Resolve `Section`/`AcademicLevel`/`Class`/`Grade` and `parent`/`guardian` by decision; ship the other 7 collisions unilaterally. Restore `EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` into `docs/core/` — 93 references across the tree point at it and it has no successor. Add the i18n key inventory to `docs/design/`. | D-35, G-9, G-12 | 3 h + decision |
| **D-13** | **Repair the two Jira documents.** Fill all 18 "matches the specification" ACs with the actual expectation. Document or renumber the `C-S3` skip. Delete the 5 verbatim-duplicate sub-tasks. Re-sequence the 7 test tasks ahead of their implementations. Fix the `PLT-203` duplicate label. Re-template the 6 mismatched tasks. Rewrite the `PLT-303` self-cancelling AC. **Rebuild the sprint table** — 60 and 77 points in 2-week sprints is not credible, `PLT-1005` is scheduled before its own dependency `PLT-601`, and the stated critical path contradicts the sprint order. Replace the spreadsheet-based permission matrix task with a reference to the D-1 artefact. | D-26, D-34 | 1 d |
| **D-14** | **Restore the ERD to `ARCHITECTURE.md` as an index.** The recovered file is 26,993 B; make it point at `docs/diagrams/ERD_PLATFORM_CORE.md` and `ERD_PROJECT_AND_ARCHITECTURE.md` rather than duplicating them. Wire `docs/diagrams/EduFlow360_Diagrams.html` into the doc index — it currently has zero inbound references. Author `ADR-022` and `ADR-023`, or record why the numbers were skipped. | G-2, D-40, D-41 | 2 h |

**Phase D gate:** every row of the Part IV matrix is closed; `G-1` through `G-12` each have
a named artefact; `ADR-026` exists.

---

# PART XII — PHASE E: CLOSE THE FOUNDATION GAPS *(2–3 weeks)*

Execute in this order. Each item names the debt it retires.

| # | Work | Points | Retires | Notes |
|---|---|---|---|---|
| **E-1** | **`SEC-115` env reconciliation** | P0 | D-05, D-07, D-09 | Already scoped in Phase C-2. **This is the recovered repo's own next ticket.** |
| **E-2** | **RBAC soundness: `PLT-205` T4–T6, `SEC-113`** | 42 | D-17, D-18 | Turn `@RequirePermission` from vocabulary into control. The largest single block and the biggest soundness gap. Requires D-1 first. |
| **E-3** | **Audit writer `PLT-402`** | 8 | D-17 | `@Audited` is on sensitive routes and writes **nothing**. Wire `audit-immutability.sql`. |
| **E-4** | **`i18n` + RTL shell** | — | D-20, D-37, G-9 | Author every application string × 4 locales; build the RTL app shell from scratch (the template gives 4 CSS rules and 0 app keys). Requires D-12. |
| **E-5** | **Entitlement enforcement `PLT-301`/`PLT-302`** | 16 | D-21 | `@RequireEntitlement` enforces and writes nothing. Requires D-8 (license key space). |
| **E-6** | **Email adapter `PLT-701`** | 8 | — | **Owner call, not build order.** Blocks `PLT-105` and therefore forgot/reset password. |
| **E-7** | **`PLT-105` reset flow** | 5 | — | After E-6. |
| **E-8** | **`PLT-8xx` storage, `PLT-9xx` health, `PLT-5xx` diagnostics** | 44 | — | Three epics at 0%. |
| **E-9** | **`OPS-106` git hooks, `OPS-105` gitleaks** | P1 | D-02 | Prevents recurrence of D-02. |
| **E-10** | **`SEC-112` integration schema isolation** | P1 | — | Owns the known cold-cache flake. |

**Phase E gate (this is the gate that matters):** every `P0` platform epic has production
code **and** an adversarial test proving the control is *obeyed*, not merely *present*. Per
`ADR-026`, "green" is not evidence.

---

# PART XIII — PHASE F: ONE VERTICAL SLICE *(4–6 weeks)*

> **Execute the existing decomposition. Do not re-plan it.**

`EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md` already contains **16 epics, 54 stories,
269 points, 169 tasks, 487 sub-tasks** — arithmetically verified. Its dependency graph is a
clean DAG with one external in-edge (`PLT-1005`).

Order: `SET-EPIC-00 → 01 → 02 → 03 → 04 → 05 → 06 → HRM-EPIC-01 → ACD-EPIC-01…08`.

**Prerequisite:** Phase E-2, because the six tab screens and every API route depend on
`PLT-201`/`PLT-202`/`PLT-601`/`PLT-205`.

**Slice definition:** `apps/web` → API → PostgreSQL → permission guard → audit row →
i18n (4 locales) → RTL → light/dark → visual regression, for one school.

**Gate:** a real school configured end-to-end and UAT-signed against
`EduFlow360_School_Setup_Workflow_v1.1.md` gates **G0**–**G9**, with `AGENTS.md`-style
evidence per gate.

---

# PART XIV — PHASE G: SCALE

Attendance → Finance → the remaining 19 domains, per the roadmap of record chosen in D-4.

**Sequencing note carried forward:** the General Ledger is `P1` and assigned to no phase in
the SRS, yet MVP acceptance criterion 4 requires a payment that "reconciles correctly".
`FR-FIN-03/06` must land with Phase 6, not after it. Resolve in D-6.

---

# PART XV — OWNER DECISION REGISTER

Seven decisions that no amount of analysis can settle. Each blocks named work.

| # | Decision | Blocks | Default if unanswered | Source |
|---|---|---|---|---|
| **O-1** | **Third-party model gateway: retain or drop?** | `ADR-025`, every future session | retain, but record the no-source/no-school-data constraint | Phase A-1 step 5 |
| **O-2** | **API dev port: 3031 or something else?** | `.env.example`, `Master_Plan:450`, `PlatformCore_v2:1166` | **none — do not invent one** | Phase C-4 step 2 |
| **O-3** | **`SUPERADMIN` ⊇ `SCHOOL_ADMIN`?** And are Teacher/Student/Parent/Staff seeded roles or school-created ones? | `PLT-2xx`, every route | none — the models are contradictory today | D-1 |
| **O-4** | **Scheduler limits: block or warn?** | `SET-601`, `SET-602`, `ACD-702` | none — MP says hard limit, the workflow says warning | D-10, X-6 |
| **O-5** | **Roadmap of record: MP §28 or SRS §22?** | 90 Jira milestone tags, all planning | **SRS §22** (only one with exit criteria) | D-4 |
| **O-6** | **Pull the `PLT-701` email adapter forward?** | `PLT-105`, forgot/reset password | none — this is a cost call, flagged as owner-only in `EPIC_STATUS.md` | E-6 |
| **O-7** | **Repo public, or GitHub Pro for required status checks?** | CI enforceability; currently `CI` runs on every push but is **not** a required check (branch protection needs Pro on private repos) | none — `OPS-113` T3 stays open | `RESUME_2026-10-09.md` |

Two more already recorded and still owed, from the recovered repo:

| # | Decision | Source |
|---|---|---|
| **O-8** | **Password policy is invented** — length bounds only, `SSOT.md` `D62`, `provisional: true`. `AGENTS.md §6` forbids inventing a threshold, but `PLT-107`'s ACs demand one. | `EPIC_STATUS.md:107` |
| **O-9** | **There is no unlink route**, so a user who links the wrong Google account is stuck. And `SetupTokenService.consume` may be dead code while `FakeSetupTokenRepository.consume` invents a state the real adapter cannot produce. | `EPIC_STATUS.md`, closing section |

---

# PART XVI — SELF-REVIEW

**1. Coverage.** Every claim in this document carries a citation or a reproducing command.
The 42 debt items map to the 12 root causes in Part VI; the 10 contradictions in Part IV map
to Phase D tasks; the 12 architectural gaps in Part V map to Phase D tasks.

**2. Prior-plan reconciliation.** Every one of the prior plan's Phase 0 and Phase 1 tasks is
either marked DONE (0.3, 0.4, 1.9), carried forward with new evidence (1.5, 1.6), or
superseded (0.8 — *copy* the archive, do not move it). Two additions the prior plan does not
contain: **Phase A** (dead remote, no backup) and **Phase C** (the doc split is a forward
refresh, not a truncation).

**3. Corrections to the prior plan's numbers**, verified against the live filesystem:
| Prior claim | Verified |
|---|---|
| "2,087 recovered files excl. `.git`/`node_modules`" | **4,904** per the archive listing; the extraction actually lands 42,426 including `node_modules` |
| "87 commits, clean at `5b4b466`" | **88 commits**, HEAD `ff88d3c`; `5b4b466` is HEAD~1 |
| "branches `docs` and `siraj-77`" | `main`, `docs/reconcile-with-agentic-prompt-pack`, `siraj-77/ERD` |
| "`.gitignore` does not exist" | it exists, 2,795 B |
| "`.env` and `.env.local` to be deleted" | still present, unchanged |
| "archive moved to `_backups`" | not done |
| "5 idea-bank docs" | 6 |
| "20 work docs" | 19 |
| "§7 §4.3 / ADR-022, ADR-023 absent" | **correct** |
| "`SSOT.md` ≈157 KB, `WORKLOG.md` ≈589 KB" | **correct** |
| "`ARCHITECTURE.md` populated → skip task 1.9" | **correct** (26,993 B) |
| "`api .ts` in the hundreds" | **168** (85 `.spec.ts`) |

**4. No placeholders.** Every step in Phases A, B and C-1..C-4 contains the actual command or
file content. Phases D–G are declared specifications, which is deliberate: writing pseudo-tasks
for them would reproduce the exact defect this document identifies in
`Master_Plan_v5.3.md:214-217, 548-570, 1015`.

**5. Known gaps in this assessment.** All five core docs were read; the recovered
`SSOT.md` (156 KB), `WORKLOG.md` (589 KB) and `docs/adr/` (21 files) were **inventoried but
not deep-read**, because the question was scoped to `.docs`. Phase C-1 should read `SSOT.md`
in full before any delta is ruled on — if `SSOT.md` already contains a ruling, the delta is
already settled and the working-tree doc is merely stale. **That is the single most likely
outcome and the cheapest thing to check.**