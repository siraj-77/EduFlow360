# EduFlow360 — Documentation Audit, Technical-Debt Assessment & Strategic Roadmap

> **For agentic workers:** this document is an **analysis and plan**, not a build spec. Only §7
> (Phase 0) and §8 (Phase 1) contain executable tasks. Phases 2–5 are decisions and
> specifications that must be written *before* they can be planned. Do not start coding from
> this file.
>
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-10-09
**Scope of audit:** `H:\AI-Dev\MyProjects\EduFlow360` — working tree + `New folder.7z`
**Method:** 6 parallel deep-read passes over 5 core documents (6,230 lines, 466 KB),
repo-wide forensic scan, 7z archive forensics, cross-document contradiction matrix.
**Rule:** every claim below carries a `file:line` citation. Uncited claims are not in this document.

---

## Global Constraints

These are project-wide invariants. They are already established in the recovered
`AGENTS.md` and ADRs and must survive any remediation described here.

- **Never** print, copy, commit, or archive a real credential. Placeholders only.
- **Never** hard-code `localhost:` in `apps/**/src`. Enforced by CI (`scripts/check-route-guards.mjs`).
- Money is **integer minor units** on disk, **decimal string** on the wire (`ADR-002`, `ADR-024`).
- Time is read through the injected `IClock`. No direct `Date.now()` in domain code.
- Fresh build only — no code copied from any other project (`PlatformCore_RBAC_v2.md:12`).
- UI templates under `docs/template/` are **read-only**. Any change needs an owner-authorised
  `WORKLOG.md` entry or CI fails (`PlatformCore_RBAC_v2.md:1226`).
- i18n coverage is 4 locales (`en`, `ta`, `si`, `ar`) plus RTL on every screen.
- Every route carries an explicit permission guard and an audit action.

---

## PART I — HEADLINE FINDING

### I.1 The working tree is a hollowed-out shell. The project is in the archive.

This single fact reorders every other finding below.

| Evidence | Detail |
|---|---|
| Working tree file count | **24 files, 8 directories.** Zero source code. |
| `New folder.7z` | 227,404,582 bytes (217 MiB), **51,297 entries**, solid LZMA2 |
| Recovered source + docs (excl. `.git`, `node_modules`) | **2,087 files** |
| Recovered git history | Full `.git` with branches `docs` and `siraj-77` + `origin` remotes |
| Recovered docs | 22 ADRs, 6 analyses, 5 core docs, 5 idea-bank docs, 20 work docs, 3 prior plans, ERDs |
| Recovered code | `apps/api/src/modules/{auth,rbac,settings,licensing,audit,diagnostics,health,notifications,storage,users,modules}`, `apps/web/src/{app,features,components,i18n,lib}`, 4 packages, 4 CI scripts, `.github/workflows/ci.yml` |
| Recovered build state per `EPIC_STATUS.md` | **`main` clean at `5b4b466`, 87 commits, all ten gates green** |
| Stub files in working tree | `AGENTS.md` (0 B), `README.md` (0 B), `docs/core/SSOT.md` (1 B), `docs/core/ARCHITECTURE.md` (1 B), `docs/work/WORKLOG.md` (1 B), `TODO.md` (0 B), `CHANGELOG.md` (0 B), `BACKLOG.md` (0 B) |

**Consequence:** every "dangling reference" in the working tree — 93 references to a
*Prompt Pack*, 13 to `AGENTS.md`, 24 to `docs/adr/`, 8 to non-existent Master Plan
sections — is resolved by the archive. The documentation is not internally broken; it is
**truncated**.

**Do not** treat the working tree as the source of truth until Phase 0 completes.

### I.2 What the working tree got wrong about itself

The `EduFlow360_*` docs in the working tree are **newer, renames of** `EduFlow_*` docs
in the archive, at one version higher each:

| Working tree | Archive predecessor |
|---|---|
| `EduFlow360_Project_Master_Plan_v5.3.md` | `EduFlow_Project_Master_Plan_v5.2.md` |
| `EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md` | `EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` |
| `EduFlow360_School_Setup_Workflow_v1.1.md` | `EduFlow_School_Setup_Workflow_v1.md` |
| `EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md` | `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` |
| — | `EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` ← **no successor in tree** |

So the working tree is a **partial doc refresh that was never accompanied by the code it
describes**. The rename to `EduFlow360` landed in docs but **not** in configuration —
`.env.example` still says `EduFlow` in 8 places.

**ADR numbering gap:** archive holds `ADR-001…021`, `ADR-024`. `ADR-022` and `ADR-023`
are absent there too. This is not an extraction artifact — it is a real gap in the record.

---

## PART II — TECHNICAL DEBT REGISTER

Severity: **S1** blocks or corrupts work · **S2** causes rework or silent defects ·
**S3** costs time or erodes trust · **S4** cosmetic.

### D-01 · S1 · Live credentials in tracked plaintext, no version control, no `.gitignore`

| File | Secret | Note |
|---|---|---|
| `.claude/settings.json` | `ANTHROPIC_AUTH_TOKEN` = `thk_live_…` | **Live.** Plus `ANTHROPIC_BASE_URL=https://tokenharbor.ai` (third party) and `ANTHROPIC_MODEL=deepseek-v4.1-flash:free` |
| `.env.local` | `GOOGLE_CLIENT_SECRET` = `GOCSPX-…` | Live GCP OAuth client secret |
| `.env.local` | `DATABASE_URL` | Live, DB `eduflow360db` |
| `.env` | `DATABASE_URL` | Live, **different** DB `eduflowdb_new` |

`.gitignore` does not exist in the working tree. `.git` does not exist. `.env:1` claims
*"Git-ignored (AGENTS.md 11)"* — **a false claim**, there is nothing to ignore it from.
The moment `git init` runs without a `.gitignore`, all four stage by default.

The same secrets are inside `New folder.7z`, unencrypted, alongside the `.git` history.

**Remedy:** Phase 0, steps 1–4.

### D-02 · S1 · The single most-referenced file in the project is 0 bytes

`AGENTS.md` is cited **13 times** across 6 documents and both templates, with section-level
precision (`§2.1` single-tenant, `§2.17` templates as-is, `§2.18`, `§8` no hard-coding,
`§11` no real secrets). `SRS:4` calls it *"the build contract"*. Every Jira sub-task is
gated on it: *"AGENTS.md is the contract"* (`PlatformCore_RBAC_v2.md:12`).

An agent following that instruction literally blocks on its first step.

**Remedy:** Phase 0, step 5.

### D-03 · S1 · Ports: the docs and the env files have **zero** overlap

| Service | Documents | `.env.example` | `.env`/`.env.local` |
|---|---|---|---|
| Web | **3030** (MP:15,450 · PC:7,1135,1145 · WF:7) | **3500** (L118) | — |
| API | **3031**, explicitly *"(assumption)"* (MP:450 · PC:1154,1166) | **3001** (L71,121) | **3001** (NEXTAUTH_URL) |
| Postgres | — | `eduflow` | `eduflowdb_new` **and** `eduflow360db` |

`PC:1166` already flags it: *"👤 owner confirms API dev port (3031 is an assumption)"*.
That decision is still outstanding, and the archive's real `.env.example` uses a third
number again.

**Remedy:** Phase 1, task 1.5.

### D-04 · S1 · Four mutually incompatible env-var naming schemes, none of them reconciled

| Scheme | Variables | Source |
|---|---|---|
| A | `WEB_PORT`, `API_PORT` | `PC:1149,1154` |
| B | `WEB_BASE_URL`, `API_BASE_URL` | `PC:1158` |
| C | `PORT`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL` | `.env.example:71,118,121` |
| D | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | `.env.local` |

**24 of 28** `.env.example` variables appear in **no** document. **4** documented variables
(`WEB_PORT`/`API_PORT`/`WEB_BASE_URL`/`API_BASE_URL`) are **absent from** `.env.example`.
`NEXTAUTH_*` exists only in `.env.local`.

**The archive already resolved this.** Its `.env.example` and `apps/api/src/config/env.ts`
+ `env-files.ts` + `env.spec.ts` implement one scheme with a test suite. This is the
project's own **`SEC-115` (env reconciliation)** — the next task per the recovered `TODO.md`.
The working tree is a regression of already-fixed work.

**Remedy:** Phase 1, task 1.6 — and do it by restoring the archive's version, not by inventing one.

### D-05 · S1 · `.env.example` violates its own stated rule

> `.env.example:6-8` — *"AGENTS.md section 11 forbids real-looking example values in tracked
> files, so every placeholder below is wrapped in angle brackets **and the validator rejects
> one that is still a placeholder**."*

**All 12 bracketed placeholders ship unresolved**, e.g.
`DATABASE_URL="<postgresql://eduflow_dev:<password>@localhost:5432/eduflow>"`,
`JWT_ACCESS_SECRET="<generate with: openssl rand -base64 32>"`.

The tracked template fails the validator it documents. `SEC-115` owns this.

### D-06 · S2 · `.env` / `.env.local` use `KEY = value` with spaces

`.env:2` and `.env.local` use `KEY = value`. Most dotenv parsers require `KEY=value`.
`.env.example` correctly omits the spaces. **The two local files may not load at all** —
which would explain the recovered `TODO.md` note that
*"`pnpm test:integration` is flaky"* if some suites silently skip config.

### D-07 · S2 · Auth.js contradiction

`.env.example:55` states in a tracked file: *"Do NOT install Auth.js. Both of its session
strategies contradict ADR-008."* `.env.local` **defines `NEXTAUTH_SECRET` and
`NEXTAUTH_URL`** and comments them *"# NextAuth.js Configuration"*. NextAuth **is** Auth.js.
`.env.example` defines no `NEXTAUTH_*` variable at all.

The live local config implements the exact library the tracked template forbids.

**Remedy:** Phase 1, task 1.7 — delete `.env.local`, not just edit it.

### D-08 · S2 · 217 MB unencrypted archive containing `.git` **and** two credential files, loose in the repo root

`New folder.7z` is a solid LZMA2 archive in the working-tree root. It contains the full git
history and both `.env` files. If this directory is copied, synced to a cloud provider,
or committed, the history and both credential sets leak together.

Its size is dominated by `node_modules` (a pnpm store), which is also the part with zero
recovery value.

**Remedy:** Phase 0, steps 2–4.

### D-09 · S2 · Master Plan has **5 duplicate section numbers**

| Number | First use | Second use |
|---|---|---|
| §18.1 | L835 Alumni Directory | **L892 AI Chatbot** |
| §18.2 | L839 Alumni Events | **L903 AI Timetable** |
| §18.3 | L843 Alumni Mentorship | **L905 AI Lesson Plan** |
| §18.4 | L847 Alumni Giving | **L907 AI Report Card** |
| §18.5 | L851 Alumni Consent | **L909 AI Absenteeism** |

§21 *AI Services* (L890) numbers its subsections **18.1–18.6**. §18.6 exists only there.

Same class of error: §26 *Reports Engine* (L991) numbers subsections **23.1–23.3**, which
collide with §23 *Dynamic Hardware Adapters* (L926).

Any agent resolving a cross-reference to §18.x gets an unpredictable answer.

**Remedy:** Phase 2, task 2.3.

### D-10 · S2 · 8 dangling cross-references *within* the Master Plan

`§2.2` (cited by `SRS:373` as the Clean Architecture boundary — **§2 has only §2.1**),
`§6.1` (`PC:628` as the audit schema — **§6 has no subsections**), `§6.2` (`PC:752`),
`§7.1/7.2/7.3` (§7 is a 3-line stub), `§9.3/9.5/9.6/9.7` (§9 is a 3-line stub),
`§23.2` (§23 has no subsections), `§5 Student History` (§5 has no such node).

§27 *Non-Functional Requirements* is a 3-line stub that **delegates every NFR to
"v3.0 §14"**, a document that does not exist anywhere. The SRS's 9 NFRs cite §27 as their
authority (`SRS:313`). The authority is missing.

**Remedy:** Phase 2, tasks 2.4–2.6.

### D-11 · S2 · `School_Setup_Workflow_v1.1` is not a setup spec — and it says so

The "6 tabs" that Master Plan §5A and SRS FR-SET-01…12 specify occupy **lines 427–484:
57 lines, 4.0% of the document**. The other 96% is a 22-phase school lifecycle
methodology (discovery → infra → activation → setup → migration → UAT → go-live → hypercare
→ year-end rollover).

Everything it says about the 6 tabs is a **diluted restatement of Master Plan §5A** — it
drops every field type, every length limit, the singleton/list distinction, the `SET_*`
permission names, and the `@Audited` requirement. Worse, it **contradicts** §5A on two
points:

| Item | Master Plan §5A | Workflow v1.1 |
|---|---|---|
| Max periods per teacher | **"hard limit"** (L514) | *"used by assignment **warnings**"* (L463) — blocking ≠ advising |
| Default/enabled language | Required at launch (L118) | Prefixed **"Proposed:"** (L448), yet its own exit gate L480 requires verifying all enabled languages |

Treating it as the setup source of truth silently loses every validation rule.

**Remedy:** Phase 2, task 2.7 — reclassify it as `IMPLEMENTATION_GUIDE`, and make §5A the sole setup authority.

### D-12 · S2 · The Master Plan is a module inventory, not a specification

Of its 30 sections, **6 are 3–8 line stubs** saying "unchanged from v3.0" (§4.3, §6, §7,
§8, §9, §27) — and no v3.0 document exists. It contains **zero** table definitions, **zero**
version numbers on any of 14 named technologies, **zero** enumerated roles, **zero**
measurable NFRs.

The document is rigorously precise about *presentational* details (`{SCHOOL_CODE}{YYYY}{YY}{SEQ:n}`,
`SHA-256`, `ISO 4217`, `E.164`, `CR80`, `RFC 3339`) and completely silent about
*behavioural, security, and data* details. That inversion is the root cause of most gaps below.

**Remedy:** Phase 2, task 2.5 — write the missing data model and NFRs as new ADRs.

### D-13 · S2 · License `allowed_modules` omits 4 whole domains

18 keys exist (`MP:183-189`). Absent: **Facilities & Grounds Hire** (the most
revenue-generating external hire module), **Alumni Network**, **Student Leadership &
Prefect**, **Student Wallet** — while `MP:1152` calls Wallet an "Enterprise add-on" and
`MP:767` requires GL treatment.

Meanwhile `whatsapp`, `bell_management`, `digital_noticeboard`, `assets` are license keys
but are only *leaf nodes* inside COMMUNICATION/OPERATIONS. **The entitlement unit and the
architectural unit do not correspond** — four whole domains are unlicensable, four leaves
are licensable.

**Remedy:** Phase 2, task 2.8.

### D-14 · S2 · The RBAC epic defines no role-permission matrix, anywhere

`SUPERADMIN` is specified as *"holding **every** permission"* (`PC:260`) — an implicit
wildcard. `SCHOOL_ADMIN` is seeded with **zero stated permissions** (`PC:323`). Consequence:
**a School Admin's permission set is undefined, and SUPERADMIN is indistinguishable from
it at the permission layer today.** The only differentiator is the `isSystemUser` flag.

Only **1 of 6 roles named in the DoR** is seeded (`PC:296` lists Superadmin, School Admin,
Teacher, Student, Parent, Staff; `PC:323` seeds 2). `Teacher`, `Student`, `Parent`, `Staff`
are **never seeded**.

Only **3 ownership policies** registered (`PC:388`): Teacher→Class/Section,
Parent→Child, Homeroom→Homeroom Students. Missing: Student→Own Record, and every
Finance/Exam/Subject scope.

`Subject` (capital S) appears **0 times** in the entire RBAC epic. Per-subject scoping —
a first-class dimension in Master Plan §5B row 11 — is entirely absent.

The `<5ms` Redis permission-cache requirement exists **only inside an acceptance
criterion** (`PC:345`). No task mentions Redis, caching, or invalidation. Cache key, TTL,
invalidation mechanism, and stale-grant behaviour are all unspecified — while the frontend
keeps a **second, independent** cache with no coherence protocol (`PC:412`).

**Remedy:** Phase 2, task 2.9 — and it blocks every module, so schedule it in Phase 3.

### D-15 · S2 · Four NFRs are unimplementable as written

The SRS NFR table has **zero "shall" statements** — every entry is a bare noun phrase
(`SRS:317-325`). Likely a lost column split.

| ID | Defect |
|---|---|
| NFR-01 Availability | No measurement window, no definition of downtime, no SLI/SLO, no error budget |
| NFR-02 Latency `<500ms` | "round-trip" undefined; **no p95/p99** — meaningless as a latency SLO |
| NFR-04 Backup | No RPO, no RTO, no restore-test cadence. **8 of 9 NFRs have no named verification method** (`SRS:437` names only NFR-02) |
| NFR-08 Biometrics | *"irreversible hash only… **where hardware permits**"* — an untestable escape clause that voids the NFR on exactly the deployments it exists to protect |

`NFR-09` requires *"role-scoped API authorization on **every endpoint**"*, directly
contradicted by `FR-SET-03`, which requires the school logo be served **publicly**.

**Remedy:** Phase 2, task 2.6.

### D-16 · S2 · Test strategy mandates TDD; the SRS never says the word

`PlatformCore_RBAC_v2.md:12` states: *"Rules that apply to every sub-task: … TDD
(RED → GREEN → REFACTOR) …"*. The string **`TDD` appears 0 times** in the 627-line SRS
test strategy. `"TDD"` is absent; the SRS describes a testing *philosophy* instead.

Worse: **0 of 120 FRs have acceptance criteria**, yet the SRS Definition of Done requires
*"a manual QA pass against **the acceptance criteria**"* (`SRS:431`). The DoD gates on
something that does not exist. Only the Jira epics carry ACs — which is why the epics are
the real spec.

**Remedy:** Phase 2, task 2.10 — make the Jira ACs normative and reference them from the SRS.

### D-17 · S2 · CI gates verify *presence*, not *soundness*

The recovered `EPIC_STATUS.md:27-33` states this better than any audit would:

> *"`@RequirePermission` **now enforces.** `@RequireEntitlement` and `@Audited` **still
> enforce and write nothing.** … `check-route-guards` proves a decorator is **present**.
> Nothing proves it is **obeyed**."*

At that measurement, 8 of 10 platform epics were 0%: **Licensing, Audit, Diagnostics,
Notifications, Storage, Health** all had no production code. `PLT-EPIC-04` — *"Immutable
Audit Logging"* — had `@Audited` on sensitive routes **writing nothing**.

This is the highest-value lesson in the recovered record and it is **not written down in
the Master Plan or SRS**. It must become a standing rule.

**Remedy:** Phase 2, task 2.11 → new ADR.

### D-18 · S3 · The mandated UI templates contradict the mandated stack

Master Plan L7 declares *"Next.js + React / TypeScript + **Tailwind CSS + shadcn/ui**"*.
SRS L488 mandates *"no redesign; **tokens extracted verbatim**"* from two templates that
use **neither**:

- Token names are `--bg`, `--brand`, `--accent` — not shadcn's `--background`/`--foreground`/`--primary`
- **Zero Tailwind classes** anywhere in either template
- No `components.json` in the working tree (it exists only in the archive)

`SchoolSetup_Academic_v1.md:8` tells agents to build *"only from the templates' existing
tokens… Do not invent a new visual language."* An agent reading Master Plan L7 and
SchoolSetup L8 simultaneously gets **mutually exclusive instructions**.

The recovered `EPIC_STATUS.md:62-65` adds a harder finding: the template supplies
**21 i18n keys, all landing-page marketing copy, ZERO application keys**, and
**4 CSS rules** of RTL — no sidebar, form, table, or logical-property mirroring.
*"Arabic RTL app-shell layout is built from scratch."*

Reconcilable — the archive's real project has `components.json` and `packages/ui-kit` — but
**the written contract never states the mapping**, and that is precisely the decision an
agent cannot make for itself.

**Remedy:** Phase 2, task 2.12.

### D-19 · S3 · 9 vocabulary collisions, one self-documented as unresolved

| # | Concept | Variants | Evidence |
|---|---|---|---|
| **V-1** | Academic grouping | `Academic Section` / `Academic Level` / `Section` / `Class` / `Grade` | `MP:542` — *"The word 'Section' appears twice… ⚠ Open points for the owner"*. **Still open.** §5B adds a third label (row 4 vs row 5); the Jira doc adds a fourth spelling (`ACD-303 "Academic Sections (Academic Level) screen"`). 83 `section`, 448 `class` |
| **V-2** | Guardian actor | `parent` / `guardian` / `sponsor` | 62 / 17 / 1. Three names, no mapping table |
| **V-3** | Enrolment | `enrolment` (UK) / `enrollment` (US) / `admission` / `registration` | **Spelling split by document.** `SRS:518` uses both in one line |
| **V-4** | Period | `Period` / `slot` / `session` | 77 / 2 / 121 — and `session` is overloaded: auth sessions (49) vs club sessions |
| **V-5** | Staff person | `staff` / `teacher` / `employee` | 142 / 180 / 7 — `employeeNo` used for the same record as `StaffMember` |
| **V-6** | Year level | `grade` / `standard` | 148 / 17 — Commonwealth usage mixed in |
| **V-7** | Academic period | `term` / `semester` / `quarter` / `trimester` | **✅ The one healthy collision** — `ACD-917` makes `termType` an explicit enum |
| **V-8** | Organisation | `school` / `institution` / `academy` | 365 / 3 / 2 — literal UI copy says *"Manage **your institution's** profile"* while the domain noun is `school` ×100 |
| **V-9** | Teaching unit | `Subject` / `course` / `Syllabus` | 93 / 2 / 41 — `course` only in certificate names, not a domain entity |

**Remedy:** Phase 2, task 2.4 — the glossary. This is cheap and unblocks everything else.

### D-20 · S3 · Role identifiers in four formats; 11 roles undefined

`SUPERADMIN` (seeded, `PC:323`), `superadmin` (lowercase username, 12×),
`School Admin` (prose, 33×), `school_admin` (snake_case, **exactly once**, `PC:323`).

11 roles exist **only** in the Workflow RACI and are defined nowhere: `Data Champion` (11×),
`Implementation Lead` (10×), `Support Engineer` (7×), `IT contact` (6×), `Trainer` (6×),
`HR Officer` (5×), `Registrar` (4×), `Hostel Warden` (3×), `Librarian` (3×), `Accountant`,
`Auditor`.

`Academic Coordinator` appears 14× in the Jira doc and 9× in the Workflow as the owner of
8 ACD epics — **no product role exists for that person.** `Principal` is a decision-maker
in 28 places with no identifier and no seeded role.

**Remedy:** Phase 2, task 2.9.

### D-21 · S3 · `SSOT.md` is 1 byte in the working tree and 157 KB in the archive

`SSOT.md` is the mandated update target of **every** REFACTOR sub-task
(`PC:64,68,72,76`). It is also the file whose name *is* its purpose. In the working tree
it is 1 byte.

The archive's 157 KB version is the real decision record, including `D62` (the provisional
password policy) that `EPIC_STATUS.md:107` flags as owed to the owner.

**Remedy:** Phase 0, step 6.

### D-22 · S3 · Documents, template, and diagrams disagree on provenance

`Template_Admin_Dashboard.html:2` embeds
*"Owner-authorised change 2026-10-09: menu gained 'School Setup' and 'Academic' groups"*.
That is the **only record of that change anywhere.** `CHANGELOG.md` is empty,
`WORKLOG.md` is 1 byte — and `PC:1226` specifies a CI check that *fails* when a template
checksum changes without a `WORKLOG.md` entry. **The mandated trail is in an HTML comment.**

`Diagrams.html` and `Diagrams.excalidraw` (85 elements) have **0 inbound references from
any document.** Both are orphans.

**Remedy:** Phase 1, task 1.8.

### D-23 · S4 · Version-format and date contradictions

- `School_Setup_Workflow_v1.1.md:4` says **"October 9, 2026"** in the version annotation and
  **"September 28, 2026"** in the `Date:` field — **same line, unreconcilable.**
- Filenames use bare `v2`/`v1`; bodies use `2.0`/`1.0`. Equivalence never stated.
- `PlatformCore_RBAC_v2.md:4` declares `Supersedes: v1` — not in this tree, present in the archive.
- `MP:4` says v5.3 *"merges v2.0 … + v4.0"* — omitting v5.0/5.1/5.2/5.3, which its own body
  then announces in three separate "What's new" blocks.
- §28's heading says `[REVISED v4]` (L1019) while its body carries `[v5.2]` (L1054) and
  `[NEW v5.3]` (L1073), and its TOC entry says `[REVISED v5]`.

**Remedy:** Phase 2, task 2.3.

### D-24 · S4 · Files are valid UTF-8 but BOM-less — a Windows tooling hazard

All 15 text files pass strict UTF-8 decode with **0 replacement characters**. The `�?`
sequences visible under PowerShell's default `Get-Content` are a **console codepage
artifact, not corruption**.

The real defect is the **absent BOM**: any tooling that reads without `-Encoding UTF8` will
silently mangle `—`, `→`, `§`, and the emoji in the template licence text. 8 of 15 files
are affected on every read.

**Remedy:** Phase 2, task 2.13 — pin encoding in `.gitattributes` and the docs gate.

### D-25 · S3 · Scope reality: 30 domains, 2 implemented

Stated: **21 top-level domains, ~140 leaf nodes, 4 editions, 16 roadmap phases**
(`MP:220-411`, `MP:1019-1075`).

Built per recovered `EPIC_STATUS.md`: **~100 of 199 platform points (~50%)** at one
measurement, **2 of 34 stories complete** at a re-measurement. 8 of 10 platform epics
were 0% production code.

The gap is not "the plan is too big" — a 21-domain ERP is a legitimate multi-year scope.
The gap is that **no document states the ratio**, so every planning session re-derives it.
And the two roadmaps conflict:

| | Master Plan §28 | SRS PART E |
|---|---|---|
| Granularity | 16 phases, 0 exit criteria | 17 rows, 1 extra (`Phase 1A`) |
| Milestone 1 | *"Platform Core + Admin Console"* (MP:1073) | *"SRS & ERD Sign-Off"* (SRS:618) |
| MVP Go-Live marker | — | ASCII caret at **column ~90 = month 15**, directly under Phase 15, while labelled *"End of Phase 6/7"* (`SRS:577-578`) |
| Ledger | Phase 6 | **P1, Phase-unassigned** — yet MVP acceptance criterion #4 requires a payment that *"reconciles correctly"* (`SRS:546` vs `SRS:594`) |

**Two documents claim to own the roadmap and neither has exit criteria. One MVP acceptance
criterion cannot be met by the phases that build it.**

**Remedy:** Phase 2, tasks 2.13–2.14 — one roadmap, one owner, exit criteria on every phase.

---

## PART III — WHAT IS ACTUALLY GOOD

An audit that only lists defects misleads. These are load-bearing strengths worth preserving
through any remediation:

1. **ADR practice is genuinely excellent.** 22 ADRs covering monorepo toolchain, money
   representation, token strategy, password hashing (Argon2id), licence signature
   (ECDSA over canonical JSON), permission catalogue location, audit durability
   (same-transaction), metrics (Prometheus), test runner (Vitest), i18n library
   (`next-intl`). This is more architectural rigour than most teams reach in a year.
2. **`ADR-017` "deviations from Jira sprint order"** implies deviations were recorded rather
   than silently taken. That is the discipline that keeps an agent-driven build honest.
3. **`EPIC_STATUS.md` is a model of honest self-reporting.** It opens: *"Measured from the
   tree, not from a plan file. Where a claim is '0%' that means **no production code
   exists**."* It then volunteers its own blockers, its own undocumented state, and its own
   owner's outstanding decisions. Very few projects document that honestly.
4. **`@Audited` / `@RequireEntitlement` / `IOwnershipPolicy` / `IClock` / `IStorageAdapter`
   / `ISchoolSettingsReader` / `IHolidayCalendar` / `ITimetableConstraintPolicy` /
   `PeriodScheduleCalculator`** — the port boundaries are right. Ports-before-adapters is
   the correct call and it was made early.
5. **Money as integer minor units** with a branded client type that cannot be built from a
   bare `number` (`ADR-024`) — this prevents an entire class of financial bug.
6. **Identity keyed on provider `sub`, never on email** (`TODO.md`, `2026-09-30`), with a
   test that keeps two same-address people as separate accounts. That is a subtle,
   correct, well-tested decision that most teams get wrong.
7. **Format-level precision is excellent** — `{SCHOOL_CODE}{YYYY}{YY}{SEQ:n}` with exactly
   one `{SEQ:n}` and `n=3..10`; `SHA-256` + magic-byte logo verification; `ISO 4217`,
   `IANA`, `E.164`, `CR80`, `RFC 3339`. The **Financial Ledger** (§5.2) is the best-specified
   section in the Master Plan.
8. **Both Jira epics are honestly decomposed** — 685 and 656 work items, arithmetic verified,
   1 close-out per story, 5 explicitly-flagged owner-decision tasks rather than guessed.

---

## PART IV — ROOT CAUSES

Five defects explain roughly 80% of the register above.

**RC-1 · The project is archived, not version-controlled at the top.**
A 217 MB `.7z` in the repo root, `.git` living inside it, and a working tree that received a
doc refresh but not its code. Every downstream confusion (D-01…D-08, D-21, D-22) traces here.

**RC-2 · The SSOT is written but never enforced.**
`AGENTS.md` is a build contract with 13 referring citations and 0 bytes. `SSOT.md` is a
mandated update target in every sub-task and 1 byte. `WORKLOG.md` gates a CI check and is
1 byte. **The contract exists in prose and in citations; enforcement is absent.**
Docs that must be *updated* by an agent rot, because nothing fails when they are not.

**RC-3 · Two documents own the roadmap; neither owns it exclusively.**
Master Plan §28 (16 phases) and SRS PART E (17 rows) overlap partially, disagree on
milestones, and neither has exit criteria. Plus a third implicit owner: the Jira epics'
milestone column (`M1`, `M2`). Three sources, no arbitration rule.

**RC-4 · One concept, many documents, no mapping table.**
`Academic Section` vs `Section` vs `Class` vs `Grade` is the worst case, and the Master Plan
*documents the ambiguity as an open owner decision* (`MP:542`) and then ships anyway. Nine
vocabulary collisions and four role-identifier formats all follow from the same missing
artifact: a glossary.

**RC-5 · Gates measure presence, not soundness.**
`check-route-guards` proves a decorator exists. `@Audited` can exist on every sensitive route
and write nothing. `pnpm build` gates on typecheck and lint — both green on an app with 8 of
10 epics at 0%. The recovered record names this exact failure mode twice. **It is the most
expensive lesson in the project and it is not written into any spec.**

---

## PART V — STRATEGIC ROADMAP

### Sequencing principle

Recovery must precede repair; repair must precede specification; specification must precede
scale. And **Phase 0 is a security incident**, not housekeeping — rotate before touching.

```
Phase 0  RECOVER + SECURE     ▓▓▓▓▓▓▓▓░░░░░░  1 day    credentials, archive, git
   ↓     gate: secrets rotated · git clean · tree restored
Phase 1  RECONCILE             ▓▓▓▓▓░░░░░░░░░  1–2 days  stubs, ports, env, changelog
   ↓     gate: 0 stub files · 1 port scheme · 1 env scheme
Phase 2  MAKE DOCS SELF-CONSISTENT  ▓▓▓▓▓▓▓▓▓░░░░  3–5 days  glossary, numbers, one roadmap, ADR for gate soundness
   ↓     gate: 0 dangling refs · 0 duplicate section numbers · 0 undefined terms
Phase 3  CLOSE THE FOUNDATION GAPS ▓▓▓▓▓▓░░░░░░  2–3 wks  RBAC matrix, audit writer, licensing, notifications
   ↓     gate: every P0 platform epic has production code and a soundness proof
Phase 4  VERTICAL SLICE           ▓▓▓▓▓▓▓░░░░░  4–6 wks  School Setup + Academic Setup, end to end
   ↓     gate: a real school configured, UAT-signed, per Workflow gates G0–G9
Phase 5  SCALE                    ▓▓▓░░░░░░░░░  ongoing  Attendance → Finance → rest, per §28
```

### Why this order

- **Phase 0 before anything.** Rotating a credential after extraction leaks it from the
  extracted copy too. Rotate first.
- **Phase 1 before Phase 2.** Restoring the archive's `AGENTS.md`, `SSOT.md`, `WORKLOG.md`,
  and 22 ADRs fixes **more than 20 individual S1/S2 findings at once**, because it removes
  the *cause* of the dangling references rather than the symptoms. Writing a glossary to
  paper over a missing contract is backwards.
- **Phase 2 before Phase 3.** Every one of the 21 domains needs the glossary, the role
  table, and the corrected section numbers. Building domains against unstable vocabulary
  means migrating them later.
- **Phase 3 before Phase 4.** School Setup cannot be sound until `@Audited` writes, licensing
  gates, and the RBAC matrix exists. Both `School_Setup` epics already assume `PLT-201`,
  `PLT-202`, `PLT-601` and `PLT-205`.
- **Phase 4 before Phase 5.** One end-to-end vertical slice through the real stack
  (API → DB → guard → audit → UI → i18n/RTL) de-risks the other 19 domains more than any
  amount of additional per-module work. It is also the cheapest proof that the recovered
  environment actually boots.

### Effort and confidence

| Phase | Duration | Confidence | Reversibility |
|---|---|---|---|
| 0 Recover + Secure | 1 day | **High** | Fully reversible |
| 1 Reconcile | 1–2 days | High | Reversible (git) |
| 2 Doc Consistency | 3–5 days | Medium | Reversible |
| 3 Foundation Gaps | 2–3 weeks | Medium | Code, git-reversible |
| 4 Vertical Slice | 4–6 weeks | Medium-Low | Code, git-reversible |
| 5 Scale | Ongoing | — | — |

**Phase 0–2 total: 5–8 days to a self-consistent, secure, version-controlled project.**
That is the highest-leverage spend available, because Phases 3–5 are all gated on it.

---

## PART VI — RISKS

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R-1 | Credentials already exposed by archive sync/cloud backup | **S1** | Phase 0 step 1, before anything else. Assume compromised |
| R-2 | `git init` before `.gitignore` commits all 4 secret files | **S1** | `.gitignore` is step 2, before `git init` |
| R-3 | Archive extraction overwrites live working-tree state | S2 | Extract to a **scratch directory**, diff, then reconcile deliberately |
| R-4 | The 87-commit history conflicts with the working-tree docs | S2 | Docs are newer. Expect conflicts. Resolve on the doc side; never force-reset |
| R-5 | Extraction of `node_modules` wastes hours and adds nothing | S2 | Extract with a path filter excluding `node_modules` |
| R-6 | Glossary owner decisions stall Phase 2 | S2 | Time-box to one session; ship the uncontested 8 of 9, escalate only V-1 |
| R-7 | Phase 3 RBAC matrix is larger than estimated | S2 | Time-box; a partial matrix with a deny-by-default guard beats a complete unimplemented one |
| R-8 | Re-verifying all ten gates post-restore costs more than the restore | S3 | `pnpm install` is ~5 min; gates are scripted |
| R-9 | Scope pressure to start Phase 4 before Phase 3 completes | S2 | Gate rule: no domain code before the platform epics it depends on are sound |

---

## PART VII — PHASE 0: RECOVER + SECURE (executable)

**Goal:** live credentials are rotated, `.git` is live, the working tree is complete, and no
secret can be committed.

**Architecture:** rotate first (irreversible ordering — a credential rotated after extraction
is exposed in the extracted copy too), then `.gitignore` before `git init`, then restore `.git`
rather than re-initialising, because **87 commits of history already exist**.

**Tech Stack:** 7-Zip, git, pnpm 11.22.0, Node ≥22

**Spec:** this plan, §7. Restores the tree described in §I.1.

### Global Constraints (Phase 0)

- Never print a credential value. Confirm by **name** and **shape**, never by content.
- `.gitignore` is installed **before** `git init`. Non-negotiable.
- Extract to a scratch path outside the repo. Never extract over a live tree.
- Never `git commit` in Phase 0. Commit only in task 0.9 step 9, after `git status` is inspected.
- Adopting the archive's own files beats authoring new ones. Where the archive ships a
  `.gitignore`, an `AGENTS.md`, an ADR or a `env.ts`, **read it first and extend it.**

### Execution order

The task numbers are stable identifiers, not a sequence. Run them in this order:

| Order | Task | Why here |
|---:|---|---|
| 1 | **0.1** Rotate the Anthropic token | Rotating *after* extraction leaves the old token in the extracted copy |
| 2 | **0.2** Rotate the Google OAuth secret | Same — rotate before any copy of the secrets exists on disk |
| 3 | **0.4** Extract archive → scratch | Needs no other task. Filtered, so `node_modules` never lands |
| 4 | **0.3** Install `.gitignore` | **Depends on 0.4** — it adopts the archive's file rather than authoring one |
| 5 | **0.5** Diff both trees | Produces the merge manifest 0.7 needs |
| 6 | **0.6** Restore `.git` from the archive | Before the tree copy, so `git status` is meaningful in 0.7 |
| 7 | **0.7** Restore the project tree | Uses 0.5's manifest and 0.6's history |
| 8 | **0.8** Quarantine archive; `.env`; `pnpm install` | Needs the restored `.env.example` from 0.7 |
| 9 | **0.9** Prove it works; commit | Last — every earlier task must be green first |

**Total wall-clock: ~1 day.** Tasks 0.1 and 0.2 are ~20 minutes each and depend on you having
console access to the issuer and to GCP.

### Decision points — where this plan stops and waits for you

| Task | Question | Why it cannot be guessed |
|---|---|---|
| **0.1 step 3** | Revoke + reissue the `thk_live_…` token at `tokenharbor.ai` | Requires your console session |
| **0.2 step 2** | Delete + recreate the GCP OAuth client secret | Requires your GCP project access |
| **0.1 step 4** | Keep the third-party gateway, or route to Anthropic directly? | A cost, privacy and data-residency decision that is yours |
| **0.9 step 6** | Is the integration failure the known `SEC-112` flake, or a real regression? | Only you know whether anything changed |

Everything else in Phase 0 is mechanical and safe to execute unattended.

---

### Task 0.1: Rotate the exposed Anthropic/token-harbor credential

**Files:**
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: nothing
- Produces: a `thk_live_…` token that is no longer valid anywhere

- [ ] **Step 1: Confirm the credential's presence without printing it**

Run:
```powershell
(Get-Content "H:\AI-Dev\MyProjects\EduFlow360\.claude\settings.json" -Raw) -match 'thk_live_[A-Za-z0-9_\-]+'
```
Expected: `True`. If `False`, stop — the file changed; re-read it before proceeding.

- [ ] **Step 2: Record the shape, not the value**

Run:
```powershell
$t = (Get-Content "H:\AI-Dev\MyProjects\EduFlow360\.claude\settings.json" -Raw |
  Select-String -Pattern 'thk_live_[A-Za-z0-9_\-]+').Matches.Value
"prefix=$($t.Substring(0,9))  length=$($t.Length)"
```
Expected: `prefix=thk_live_  length=<n>`. Write `length` into `docs/work/WORKLOG.md` — it is the
evidence that rotation happened, and it leaks nothing.

- [ ] **Step 3: Revoke the token at the issuer**

Open the issuer's console for `ANTHROPIC_BASE_URL` (`https://tokenharbor.ai`), revoke
`thk_live_…`, and issue a replacement. Confirm the old token now returns an auth failure.

- [ ] **Step 4: Decide the model routing, and write the decision down**

`ANTHROPIC_MODEL` is `deepseek-v4.1-flash:free` — traffic is routed to a **non-Anthropic
model via a third-party endpoint**. This is a legitimate choice, but it must be a **recorded**
one. Add to `docs/adr/`:

```markdown
# ADR-025: Third-party model gateway routing

**Status:** accepted
**Date:** 2026-10-09

## Context
`.claude/settings.json` routes all agent traffic through `tokenharbor.ai` with model
`deepseek-v4.1-flash:free`, not to Anthropic's API.

## Decision
Retain the gateway. Record that (a) no EduFlow source, credential, or school data may be
sent through it, (b) the token is stored only in `.claude/settings.json`, which is
git-ignored, and (c) the token is rotated on any suspected exposure.

## Consequences
Third-party availability and cost are outside our control. Code sent through this gateway
is reviewed as if reviewed by an external party.
```

- [ ] **Step 5: Replace the token in the file**

Replace the `thk_live_…` value with the newly issued token. Do not commit.

---

### Task 0.2: Rotate the exposed Google OAuth secret

**Files:**
- Delete: `.env.local`
- Reference: the archive's `.env.example`

**Interfaces:**
- Consumes: nothing
- Produces: a GCP client secret that is no longer valid

- [ ] **Step 1: Confirm both secrets by name**

`.env.local` contains `GOOGLE_CLIENT_SECRET` (`GOCSPX-…`) and `GOOGLE_CLIENT_ID`.
Both are real. Both must be rotated.

- [ ] **Step 2: Revoke the client secret in GCP**

Console → APIs & Services → Credentials → the OAuth client → **delete the client secret**
and create a replacement. Also delete `NEXTAUTH_SECRET`'s source (it is a placeholder, so
no rotation needed — see Task 1.7).

- [ ] **Step 3: Confirm the secret is dead**

Attempt an OAuth token exchange with the old secret. Expected: `invalid_client`.

---

### Task 0.3: Install `.gitignore` — before any `git init`

**Files:**
- Create: `.gitignore` (adopted from the archive, plus one added rule)

**Interfaces:**
- Consumes: the archive's `.gitignore` (2,474 bytes)
- Produces: an ignore file that blocks every secret and every regenerable artifact

> **Do not author this file from scratch.** The archive already contains a
> 2,474-byte `.gitignore` written against the real project. It correctly ignores
> `.env`, `.env.*`, `!.env.example`, `node_modules/`, `.turbo/`, `.kilo/` and — critically —
> `.claude/` in full, with a comment recording that `.claude/settings.json` *"contained a live
> `thk_live_` credential plus machine-specific model routing"*. That is exactly the finding
> from D-01, already documented by whoever hit it first.
>
> Writing a new one here would discard that knowledge. **Adopt and extend.**

- [ ] **Step 1: Confirm the archive's `.gitignore` exists**

```powershell
$p = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder\.gitignore"
if (Test-Path $p) { "OK  $((Get-Item $p).Length) bytes" } else { "MISSING - do not proceed" }
```
Expected: `OK  2474 bytes`. If missing, Task 0.4 has not run yet — run it first.

- [ ] **Step 2: Verify it blocks the four live-secret paths**

```powershell
$p = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder\.gitignore"
foreach ($needle in '.env','.env.*','!.env.example','.claude/','.kilo/') {
  "{0,-16} {1}" -f $needle, [bool](Select-String -Path $p -SimpleMatch $needle -Quiet)
}
```
Expected: five `True` lines. **All five are required.** A `False` on `.claude/` means the live
token would stage — stop and add it.

- [ ] **Step 3: Check for the one known gap — archives**

The archive's file does **not** ignore `*.7z`, `*.zip` or `*.tar.gz`. Backups belong outside
the working tree, not merely untracked inside it.

```powershell
Select-String -Path $p -Pattern '\*\.7z'
```
Expected: no match — this is the gap to close in Step 4.

- [ ] **Step 4: Install it with the archive rule added**

```powershell
$src  = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder\.gitignore"
$dst  = "H:\AI-Dev\MyProjects\EduFlow360\.gitignore"
Copy-Item $src $dst -Force

Add-Content $dst -Value @'

# ---- Backups: live OUTSIDE the working tree, never merely untracked ----
# New folder.7z held the entire project plus two credential files. If it sat
# untracked here it would still be swept into any cloud sync, backup or
# accidental `git add -A`. Keep backups in H:\AI-Dev\_backups\eduflow360\.
*.7z
*.zip
*.tar.gz
'@

"installed $((Get-Item $dst).Length) bytes"
```
Expected: a byte count larger than 2,474.

- [ ] **Step 5: Prove the ignore rules work against the live tree**

```powershell
Set-Location "H:\AI-Dev\MyProjects\EduFlow360"
git init -q
git status --porcelain | Select-String -Pattern '\.env$|\.env\.local$|\.7z$|settings\.json$'
```
Expected: **no output**. If any line appears, fix the pattern and re-run. Do not proceed.

- [ ] **Step 6: Remove the throwaway `.git` created for the test**

```powershell
Remove-Item -Recurse -Force "H:\AI-Dev\MyProjects\EduFlow360\.git"
Test-Path "H:\AI-Dev\MyProjects\EduFlow360\.git"
```
Expected: `False`. The real history is restored in Task 0.6; this test repo is disposable.

---

### Task 0.4: Extract the archive to scratch, excluding `node_modules`

**Files:**
- Read: `New folder.7z`
- Create: `%LOCALAPPDATA%\opencode\eduflow-recovered\`

**Interfaces:**
- Consumes: `New folder.7z`
- Produces: `…\eduflow-recovered\New folder\` containing the full project **without** `node_modules`

- [ ] **Step 1: Create the scratch directory**

Run:
```powershell
$dst = "$env:LOCALAPPDATA\opencode\eduflow-recovered"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$dst
```
Expected: the printed path. Note it — every later step uses it.

- [ ] **Step 2: Extract with a `node_modules` filter**

Run:
```powershell
& "C:\Program Files\7-Zip\7z.exe" x "H:\AI-Dev\MyProjects\EduFlow360\New folder.7z" `
  "-o$env:LOCALAPPDATA\opencode\eduflow-recovered" `
  -x"!node_modules" -x"!.kilo/worktrees" -y | Select-Object -Last 8
```
Expected: `Everything is Ok`. Expect **2–4 minutes** — 51k entries, minus ~48k of `node_modules`.

- [ ] **Step 3: Verify the extraction is complete and node_modules-free**

Run:
```powershell
$root = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
"files: " + (Get-ChildItem $root -Recurse -File -Force).Count
"git:   " + (Test-Path "$root\.git")
"adr:   " + (Get-ChildItem "$root\docs\adr" -Filter '*.md' -ErrorAction SilentlyContinue).Count
"nm:    " + (Get-ChildItem $root -Recurse -Directory -Filter node_modules -ErrorAction SilentlyContinue).Count
```
Expected: `files:` in the low thousands (≈2,100 excluding git objects), `git: True`,
`adr: 23` (22 ADRs + `README.md`), `nm: 0`.

If `git: False`, re-extract without the `-x` filters and filter afterwards.

---

### Task 0.5: Diff the recovered tree against the working tree

**Files:**
- Read: both trees
- Create: `docs/work/RECOVERY_INVENTORY_2026-10-09.md`

**Interfaces:**
- Consumes: Task 0.4 output
- Produces: a complete inventory of what the working tree is missing

- [ ] **Step 1: Build the inventory**

Run:
```powershell
$root = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
$live = "H:\AI-Dev\MyProjects\EduFlow360"
$skip = '\\(\.git|node_modules|\.turbo|node_modules\\.*)\\'
$rec = Get-ChildItem $root -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch $skip } |
  ForEach-Object { $_.FullName.Substring($root.Length + 1) }
$cur = Get-ChildItem $live -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch $skip -and $_.Name -ne 'New folder.7z' } |
  ForEach-Object { $_.FullName.Substring($live.Length + 1) }
"recovered-only : " + (@($rec | Where-Object { $cur -notcontains $_ }).Count)
"working-only   : " + (@($cur | Where-Object { $rec -notcontains $_ }).Count)
"both           : " + (@($rec | Where-Object { $cur -contains $_ }).Count)
```
Expected: `recovered-only` in the **thousands**, `working-only` small (≈24).

- [ ] **Step 2: List what is in the working tree but NOT recovered**

These are the files to protect during reconciliation — they are the newer `EduFlow360_*`
docs and the three template/diagram assets.

Run:
```powershell
$root = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
$live = "H:\AI-Dev\MyProjects\EduFlow360"
$skip = '\\(\.git|node_modules|\.turbo)\\'
$rec = Get-ChildItem $root -Recurse -File -Force | Where-Object { $_.FullName -notmatch $skip } |
  ForEach-Object { $_.FullName.Substring($root.Length + 1) }
Get-ChildItem $live -Recurse -File -Force | Where-Object { $_.FullName -notmatch $skip -and $_.Name -ne 'New folder.7z' } |
  ForEach-Object { $_.FullName.Substring($live.Length + 1) } | Where-Object { $rec -notcontains $_ } | Sort-Object
```

Expected set — **save this list, it is the merge manifest:**

```
.claude\settings.json
.claude\settings.local.json
CLAUDE.md
docs\core\EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md
docs\core\EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md
docs\core\EduFlow360_Project_Master_Plan_v5.3.md
docs\core\EduFlow360_School_Setup_Workflow_v1.1.md
docs\core\EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md
docs\diagrams\EduFlow360_Diagrams.excalidraw
docs\diagrams\EduFlow360_Diagrams.html
docs\template\EduFlow360_Template_Admin_Dashboard.html
docs\template\EduFlow360_Template_Landing_Auth.html
.env
.env.example
.env.local
```

- [ ] **Step 3: Write the inventory file**

Create `docs/work/RECOVERY_INVENTORY_2026-10-09.md` recording: the three counts from Step 1,
the full working-only list from Step 2, the recovery date, and the archive's HEAD commit
(read from `$root\.git\HEAD` and `git -C $root log --oneline -1`).

---

### Task 0.6: Restore `.git` — history, not a fresh init

**Files:**
- Create: `H:\AI-Dev\MyProjects\EduFlow360\.git\` (from the archive)

**Interfaces:**
- Consumes: `$root\.git`
- Produces: a live repo with **87 commits**, branches `docs` and `siraj-77`

- [ ] **Step 1: Verify the archive's git is sound before copying**

Run:
```powershell
$root = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
git -C $root status --short | Select-Object -First 5
git -C $root log --oneline -5
git -C $root branch -a
```
Expected: no `fatal:` output; 5 commits listed; branches include `docs` and `siraj-77`.

**If `git -C` reports `not a git repository`**, the `.git` extraction failed. Re-run Task 0.4
without filters and return here.

- [ ] **Step 2: Check the tree is clean before adopting its history**

If Step 1 printed modified files, record them — they are unsaved work from the archived
session and must be reviewed, not discarded:

```powershell
git -C $root status --short | Out-File "$env:LOCALAPPDATA\opencode\eduflow-recovered\uncommitted.txt"
```

- [ ] **Step 3: Copy `.git` into the working tree**

Run:
```powershell
Copy-Item "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder\.git" `
          "H:\AI-Dev\MyProjects\EduFlow360\.git" -Recurse -Force
```
High-risk step: `.git` is many small files. Allow 2–5 minutes.

- [ ] **Step 4: Verify the history is adopted**

Run:
```powershell
git -C "H:\AI-Dev\MyProjects\EduFlow360" log --oneline -3
git -C "H:\AI-Dev\MyProjects\EduFlow360" branch -a
```
Expected: the same commit hashes as Step 1. **If the hashes differ, stop** — the copy failed.

---

### Task 0.7: Restore the project tree

**Files:**
- Create: `apps/`, `packages/`, `infra/`, `scripts/`, `.github/`, `docs/adr/`, `docs/analysis/`, `docs/idea-bank/`, `docs/design/`, `docs/diagrams/` (ERDs), and root configs
- **Overwrite:** the 8 stub files listed in Step 2
- Preserve: the 14 files in the Step 0.5 manifest

**Interfaces:**
- Consumes: Tasks 0.5, 0.6
- Produces: a working tree where all 8 stub files are populated

- [ ] **Step 1: Copy everything except the manifest files and secrets**

The 8 stub files (`AGENTS.md`, `README.md`, `docs/core/SSOT.md`, `docs/core/ARCHITECTURE.md`,
`docs/work/{WORKLOG,TODO,CHANGELOG,BACKLOG}.md`) exist in **both** trees — as 0–1 byte stubs
here and as populated documents in the archive. They must be **overwritten**. Everything else
present in the working tree is newer than its archive counterpart and must be **preserved**.

> ⚠ **This distinction is the whole task.** Protecting everything leaves the stubs empty;
> protecting nothing destroys the v5.3/v1.3/v2 documents. The filter below is what separates
> the two sets.

Run:
```powershell
$src = "$env:LOCALAPPDATA\opencode\eduflow-recovered\New folder"
$dst = "H:\AI-Dev\MyProjects\EduFlow360"

# Stubs: overwrite with the recovered versions.
$stubs = @(
  'AGENTS.md','README.md',
  'docs\core\SSOT.md','docs\core\ARCHITECTURE.md',
  'docs\work\WORKLOG.md','docs\work\TODO.md',
  'docs\work\CHANGELOG.md','docs\work\BACKLOG.md'
)

# Protect everything else that already exists here.
$protect = Get-ChildItem $dst -Recurse -File -Force |
  Where-Object { $_.Name -ne 'New folder.7z' } |
  ForEach-Object { $_.FullName.Substring($dst.Length + 1) } |
  Where-Object { $stubs -notcontains $_ }

"protecting $($protect.Count) files; overwriting $($stubs.Count) stubs"
robocopy $src $dst /E /XD node_modules .turbo .kilo /XF @protect /NFL /NDL /NJH /NJS /NP
```
Expected: `protecting 16 files; overwriting 8 stubs`, then a `robocopy` summary.
Exit codes 0–7 are success; **≥8 is failure** — stop and re-run.

`robocopy` may report `1` (files copied) which is success, not an error.

- [ ] **Step 2: Confirm the 8 stubs are now populated**

Run:
```powershell
foreach ($f in 'AGENTS.md','README.md','docs\core\SSOT.md','docs\core\ARCHITECTURE.md',
               'docs\work\WORKLOG.md','docs\work\TODO.md','docs\work\CHANGELOG.md','docs\work\BACKLOG.md') {
  $p = Join-Path "H:\AI-Dev\MyProjects\EduFlow360" $f
  "{0,-32} {1,8} bytes" -f $f, (Get-Item $p -ErrorAction SilentlyContinue).Length
}
```
Expected: every line **> 1,000 bytes**. `SSOT.md` ≈157,000 and `WORKLOG.md` ≈589,000.
Any line still ≤2 bytes means that file was not in the archive — note it and revisit.

- [ ] **Step 3: Confirm the code landed**

Run:
```powershell
$api = "H:\AI-Dev\MyProjects\EduFlow360\apps\api\src"
"api .ts    : " + (Get-ChildItem $api -Recurse -Filter '*.ts' -ErrorAction SilentlyContinue).Count
"api .spec  : " + (Get-ChildItem $api -Recurse -Filter '*.spec.ts' -ErrorAction SilentlyContinue).Count
"web .tsx   : " + (Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360\apps\web\src" -Recurse -Include '*.ts','*.tsx' -ErrorAction SilentlyContinue).Count
"prisma     : " + (Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360\apps\api\prisma" -Recurse -File -ErrorAction SilentlyContinue).Count
"scripts    : " + (Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360\scripts" -File -ErrorAction SilentlyContinue).Count
"ci         : " + (Test-Path "H:\AI-Dev\MyProjects\EduFlow360\.github\workflows\ci.yml")
```
Expected: `api .ts` in the hundreds, `api .spec` roughly half of it, `web .tsx` ≈35,
`prisma` > 0, `scripts` = 4, `ci` = `True`.

---

### Task 0.8: Quarantine the archive; restore dependencies

**Files:**
- Move: `New folder.7z` → outside the working tree
- Create: `H:\AI-Dev\MyProjects\EduFlow360\.env.local` from the archive's `.env.example`

**Interfaces:**
- Consumes: Task 0.7
- Produces: a repo root with no archive and a working dev environment

- [ ] **Step 1: Move the archive out of the repo — do not delete yet**

Run:
```powershell
New-Item -ItemType Directory -Force -Path "H:\AI-Dev\_backups\eduflow360" | Out-Null
Move-Item "H:\AI-Dev\MyProjects\EduFlow360\New folder.7z" `
          "H:\AI-Dev\_backups\eduflow360\eduflow360-pre-recovery-2026-10-09.7z" -Force
Test-Path "H:\AI-Dev\MyProjects\EduFlow360\New folder.7z"
```
Expected: `False`.

Keep the backup for **at least one week** after `pnpm test` is green. It is the only copy of
the unrotated credentials in their original container — deleting it early removes your
ability to prove what was exposed.

- [ ] **Step 2: Delete the compromised local env files**

Run:
```powershell
Remove-Item -Force "H:\AI-Dev\MyProjects\EduFlow360\.env", `
                     "H:\AI-Dev\MyProjects\EduFlow360\.env.local" -ErrorAction SilentlyContinue
```
Both contain rotated credentials. `.env.local` also contains the forbidden
`NEXTAUTH_SECRET`. Details in Task 1.7.

- [ ] **Step 3: Create a local `.env` from the archive's example**

```powershell
Copy-Item "H:\AI-Dev\MyProjects\EduFlow360\.env.example" `
          "H:\AI-Dev\MyProjects\EduFlow360\.env" -Force
```
Then generate real secrets into it, **replacing every bracketed placeholder**:

```powershell
$envPath = "H:\AI-Dev\MyProjects\EduFlow360\.env"
$c = Get-Content $envPath -Raw
$c = $c -replace '<generate with: openssl rand -base64 32>', [Convert]::ToBase64String(
      (1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$c = $c -replace '<password>', 'localdev'
$c = $c -replace '<path/to/>', ''
Set-Content $envPath $c -Encoding UTF8 -NoNewline
```

`AGENTS.md` §11 forbids real-looking values in **tracked** files. `.env` is git-ignored,
so real local secrets are correct there — that is the entire point of the file.

- [ ] **Step 4: Fix the encoding of `.env`**

`.env` currently uses `KEY = value`. Most parsers require `KEY=value`:

```powershell
(Get-Content "H:\AI-Dev\MyProjects\EduFlow360\.env" -Raw) -replace '(?m)^([A-Z0-9_]+)\s*=\s*', '$1=' |
  Set-Content "H:\AI-Dev\MyProjects\EduFlow360\.env" -Encoding UTF8 -NoNewline
```

- [ ] **Step 5: Install dependencies**

Run:
```powershell
pnpm --version
```
Expected: `11.22.0` (matches `packageManager` in `package.json`). If different, run
`corepack enable` first.

```powershell
pnpm install
```
Expect **3–8 minutes** — the archive was ~95% `node_modules` by size, which is why the
extraction was filtered.

---

### Task 0.9: Prove the restored project works

**Files:**
- Read: all of `apps/`, `packages/`, `scripts/`
- Modify: `docs/work/WORKLOG.md`, `docs/work/TODO.md`

**Interfaces:**
- Consumes: Task 0.8
- Produces: a green baseline and a commit recording it

- [ ] **Step 1: Install git hooks if the repo declares any**

```powershell
git -C "H:\AI-Dev\MyProjects\EduFlow360" config core.hooksPath
```
If it prints a path, verify `git config core.hooksPath` matches. If blank, check
`.husky/` in the tree and run its `prepare` script.

- [ ] **Step 2: Run typecheck**

```powershell
pnpm typecheck
```
Expected: exit 0. The recovered record states all ten gates were green at `5b4b466`.

- [ ] **Step 3: Run lint**

```powershell
pnpm lint
```
Expected: exit 0.

- [ ] **Step 4: Run unit tests with coverage**

```powershell
pnpm test:coverage
```
Expected: exit 0, coverage above the tiers in `scripts/check-coverage-tiers.mjs`
(90% line / 85% branch domain, 70% line controllers, 80% line frontend logic).

- [ ] **Step 5: Run the project's own gate scripts**

```powershell
pnpm docs:verify
pnpm check:route-guards
node scripts/check-coverage-tiers.mjs
```
Expected: exit 0 on all three. `docs:verify` is the check that would have caught the
dangling references in the truncated tree.

- [ ] **Step 6: Run integration tests, expecting the known flake**

```powershell
pnpm test:integration
```
**Known issue, from the recovered `TODO.md`:** this suite is flaky in the setup-token
concurrency test, likely `SEC-112` (the integration config's missing schema isolation).

- If it fails **only** in the setup-token concurrency test → **expected**. Log it as a
  known flake and continue. It is the project's next-next task, not a regression.
- If it fails anywhere else → **stop.** Re-run to confirm, then compare against
  `5b4b466` before changing anything. Do not "fix" a red gate you did not cause.

- [ ] **Step 7: Run the production build**

```powershell
pnpm build
```
Expected: exit 0. This gates on typecheck and lint (`OPS-103`), so it transitively re-proves
Steps 2–3.

- [ ] **Step 8: Inspect status before committing anything**

```powershell
git -C "H:\AI-Dev\MyProjects\EduFlow360" status
git -C "H:\AI-Dev\MyProjects\EduFlow360" diff --stat
```
Expected: a short, reviewable list — **no `.env`, no `.env.local`, no `.7z`, no
`node_modules`**. If any secret appears, fix `.gitignore` (Task 0.3) before continuing.

- [ ] **Step 9: Commit the recovery**

```powershell
git -C "H:\AI-Dev\MyProjects\EduFlow360" add -A
git -C "H:\AI-Dev\MyProjects\EduFlow360" commit -m "chore: restore project tree and git history from archive

Recovered 87-commit history and full source tree from New folder.7z after the
working tree was reduced to documentation only.

- restore apps/, packages/, infra/, scripts/, .github/, 22 ADRs, analyses,
  idea-bank, ERDs, and the populated AGENTS.md/SSOT.md/WORKLOG.md/TODO.md
- add .gitignore blocking .env*, node_modules/, *.7z
- quarantine New folder.7z outside the working tree
- rotate exposed credentials (see WORKLOG.md)

All ten gates green. test:integration has a known flake in the setup-token
concurrency test (SEC-112), documented in TODO.md."
```

- [ ] **Step 10: Record the recovery in `WORKLOG.md`**

Append:

```markdown
## 2026-10-09 — Project recovery from archive

**Trigger:** working tree contained 24 files and zero source code; the full project
existed only inside `New folder.7z`.

**Restored:** 87-commit history (HEAD `5b4b466`, branches `docs` / `siraj-77`),
2,087 source and doc files, 22 ADRs, `.github/workflows/ci.yml`, 4 CI scripts.

**Credentials rotated (treated as exposed):**
- `ANTHROPIC_AUTH_TOKEN` in `.claude/settings.json` — length recorded, value not stored
- `GOOGLE_CLIENT_SECRET` in the deleted `.env.local`

**Deleted:** `.env`, `.env.local` (rotated secrets + forbidden `NEXTAUTH_*`).
**Moved:** `New folder.7z` → `H:\AI-Dev\_backups\eduflow360\eduflow360-pre-recovery-2026-10-09.7z`

**Gates:** typecheck ✔ lint ✔ unit+coverage ✔ docs:verify ✔ check-route-guards ✔
coverage-tiers ✔ build ✔ · integration ⚠ known flake (SEC-112, setup-token concurrency)
```

- [ ] **Step 11: Update `TODO.md`**

Add at the very top, above the existing first item:

```markdown
## ✅ DONE 2026-10-09 — Phase 0 recovery + credential rotation

Working tree restored from `New folder.7z`; git history live at `5b4b466`; exposed
credentials rotated; archive quarantined. Full inventory in
`docs/work/RECOVERY_INVENTORY_2026-10-09.md`.

**Next task is unchanged: `SEC-115` (env reconciliation).** See Phase 1, task 1.6.
```

---

## PART VIII — PHASE 1: RECONCILE (executable)

**Goal:** zero stub files, one port scheme, one env scheme, and an accurate changelog.

**Architecture:** every task here edits an existing file to remove a contradiction. None
introduces a new concept.

**Prerequisite:** Phase 0 complete — all ten gates green, git live.

### Task 1.5: Fix the port contract — 3030/3031 vs 3001/3500

**Files:**
- Modify: `.env.example` (L71, L118, L121), `apps/api/src/config/env.ts`
- Verify: `apps/web/src/lib/web-port.ts`, `apps/web/src/lib/api-base-url.ts`
- Reference: `docs/core/EduFlow360_Project_Master_Plan_v5.3.md:450`

**Interfaces:**
- Consumes: Task 0.7 (the archive's `env.ts`, which already implements one scheme)
- Produces: one port scheme across docs, env, and code

- [ ] **Step 1: Establish which scheme the code already uses**

```powershell
Select-String -Path "H:\AI-Dev\MyProjects\EduFlow360\apps\api\src\config\env.ts" -Pattern '30\d\d|PORT'
Select-String -Path "H:\AI-Dev\MyProjects\EduFlow360\apps\web\src\lib\web-port.ts" -Pattern '30\d\d|WEB_PORT'
```
The archive's `env.ts` is the **authority** — it was built against `PC:1154` and tested.
Expect `WEB_PORT` default `3030` and `API_PORT` default `3031`.

If the code says 3030/3031, the docs are right and `.env.example` is wrong. If the code says
3001/3500, `PC:1166`'s owner decision is still open and you must not guess.

- [ ] **Step 2: Get the owner decision on record**

`PC:1166` states: *"👤 owner confirms API dev port (3031 is an assumption)"*.

If Step 1 shows the code on 3031 → record the decision as **confirmed 3031** and update
`PC:1166` from `👤 owner` to `✔ confirmed 2026-10-09`.

If Step 1 shows otherwise → **stop and ask the owner.** Do not invent a port.

- [ ] **Step 3: Align `.env.example` to the code**

Set `PORT` / `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` / `GOOGLE_REDIRECT_URI` to the confirmed
values. Remove any hard-coded `localhost:` literal from `.env.example` where a derived
value will do — `PC:1151` forbids hard-coded localhost URLs, and `.env.example` is tracked.

- [ ] **Step 4: Align the Master Plan**

Change `MP:450` to remove the *"(assumption)"* qualifier on 3031 once confirmed, and state
the source: `WEB_PORT` / `API_PORT` in `.env`.

- [ ] **Step 5: Prove no hard-coded localhost remains in source**

```powershell
Select-String -Path "H:\AI-Dev\MyProjects\EduFlow360\apps\*\*\src\**\*.ts*" -Pattern 'localhost:\d+'
```
Expected: no matches. `PC:1158` specifies this as a lint rule; if the lint rule exists, run it
instead — it is stronger than a grep.

---

### Task 1.6: Env reconciliation (`SEC-115` — the project's own next task)

**Files:**
- Modify: `.env.example`, `apps/api/src/config/env.ts`, `apps/api/src/config/env-files.ts`
- Test: `apps/api/src/config/env.spec.ts`, `env-files.spec.ts`
- Reference: `docs/work/TODO.md` (`SEC-115`)

**Interfaces:**
- Consumes: Task 1.5's confirmed scheme
- Produces: one var name per concept, zero `KEY = value` spacing, zero unresolved placeholders

- [ ] **Step 1: Read the existing contract before changing anything**

Read `apps/api/src/config/env.ts` and `env-files.ts` in full. The archive already contains a
tested scheme. **This task is a reconciliation, not a design.** Writing a new scheme here
would regress working, tested code.

- [ ] **Step 2: Enumerate both sides**

Produce a table with one row per concept: `concept | doc name(s) | .env.example name |
env.ts name | verdict`.

Expected conflicts to resolve (from D-04):
`PORT` vs `API_PORT` · `WEB_ORIGIN` vs `WEB_BASE_URL` vs `WEB_PORT` ·
`NEXT_PUBLIC_API_URL` vs `API_BASE_URL` · `NEXTAUTH_URL` / `NEXTAUTH_SECRET` (delete).

- [ ] **Step 3: Apply the code's names to `.env.example` and the docs**

The code wins — it has tests. Update `.env.example`, `.env`, and the 4 documentation
references (`PC:1149`, `1154`, `1158`, `1151`).

- [ ] **Step 4: Replace all 12 bracketed placeholders**

`.env.example:6-8` requires every placeholder be **resolved**, because the validator rejects
an unresolved one. Currently all 12 ship as `<…>`. Use clearly-fake, parseable, greppable
values:

```dotenv
JWT_ACCESS_SECRET="localdev-not-a-secret-0000000000000000"
JWT_REFRESH_SECRET="localdev-not-a-secret-1111111111111111"
DATABASE_URL="postgresql://localdev:localdev@localhost:5432/eduflow"
GOOGLE_CLIENT_ID="000000000000-localdev.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="localdev-not-a-secret"
```

Each is greppable with `localdev` so a secret scanner finds any that leak into a commit.

- [ ] **Step 5: Fix the spacing in every env file**

```powershell
Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360" -Filter '.env*' -File | ForEach-Object {
  (Get-Content $_.FullName -Raw) -replace '(?m)^([A-Z0-9_]+)\s*=\s*', '$1=' |
    Set-Content $_.FullName -Encoding UTF8 -NoNewline
}
```

- [ ] **Step 6: Re-run the env tests**

```powershell
pnpm --filter @eduflow/api test -- env.spec env-files.spec
```
Expected: pass. **Add a failing-first test** for the two defects you just fixed:

```typescript
it('rejects env files that use spaces around the equals sign', () => {
  expect(() => parseEnv('DATABASE_URL = "postgresql://x:y@localhost:5432/z"'))
    .toThrow(/malformed/i);
});

it('rejects an unresolved angle-bracket placeholder', () => {
  expect(() => parseEnv('JWT_ACCESS_SECRET="<generate with: openssl rand -base64 32>"'))
    .toThrow(/placeholder/i);
});
```
RED first — confirm each fails, then implement, then confirm green.

---

### Task 1.7: Remove the Auth.js violation

**Files:**
- Delete: `.env.local` (done in Task 0.8)
- Verify: `.env.example:55`, `docs/adr/ADR-008-token-strategy-jwt-refresh-rotation.md`

**Interfaces:**
- Consumes: Task 0.8
- Produces: no `NEXTAUTH_*` variable anywhere

- [ ] **Step 1: Prove the violation is gone**

```powershell
Select-String -Path "H:\AI-Dev\MyProjects\EduFlow360\.env*" -Pattern 'NEXTAUTH'
```
Expected: no matches. `.env.local` was deleted in Task 0.8 Step 2.

- [ ] **Step 2: Confirm ADR-008 is the governing decision**

Read `ADR-008`. It must state the token strategy (JWT access + rotating refresh, per
`PC:102-111`). If it does not, ADR-008 is a stub and needs writing — this is a security
architecture decision and must not be implicit.

- [ ] **Step 3: Verify no Auth.js / NextAuth dependency exists**

```powershell
Select-String -Path "H:\AI-Dev\MyProjects\EduFlow360\**\package.json" -Pattern 'next-auth|@auth/core'
```
Expected: no matches. `.env.example:55` forbids installing it; nothing should pull it in.

---

### Task 1.8: Move the template change record out of an HTML comment

**Files:**
- Modify: `docs/work/CHANGELOG.md`
- Modify: `docs/work/WORKLOG.md`
- Read: `docs/template/EduFlow360_Template_Admin_Dashboard.html:2`

**Interfaces:**
- Consumes: D-22
- Produces: the owner-authorisation trail `PC:1226` requires

- [ ] **Step 1: Extract the record from the HTML**

`Template_Admin_Dashboard.html:2` reads:
*"Owner-authorised change 2026-10-09: menu gained 'School Setup' and 'Academic' groups."*

`Template_Landing_Auth.html:2` has no such record — so the two templates are out of sync in
their provenance tracking.

- [ ] **Step 2: Write the entry to `CHANGELOG.md`**

```markdown
## 2026-10-09 — Admin Dashboard template: School Setup and Academic menu groups

**Authorisation:** owner-approved (recorded in
`docs/template/EduFlow360_Template_Admin_Dashboard.html` line 2, header comment).

**Change:** the admin dashboard menu gained two groups — `School Setup`
(`/admin/school-setup`) and `Academic` (`/admin/academic/…`).

**Rationale:** Master Plan v5.3 §5A/§5B introduce both surfaces; the shell menu must
expose them before those screens are built.

**Template checksum:** record the new SHA-256 here — the CI check at
`PlatformCore_RBAC_v2.md:1226` compares against this value.

**Scope note:** `EduFlow360_Template_Landing_Auth.html` was **not** changed on this date.
```

- [ ] **Step 3: Record both checksums**

```powershell
Get-ChildItem "H:\AI-Dev\MyProjects\EduFlow360\docs\template\*.html" | ForEach-Object {
  "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash, $_.Name
}
```
Paste both into `CHANGELOG.md` — including the **unchanged** one, so the CI check has a
baseline for the file that was never modified.

- [ ] **Step 4: Make the `WORKLOG.md` entry the CI's source of truth**

`PC:1226` says the CI check requires a **`WORKLOG.md` authorisation entry**. Cross-reference
it from `CHANGELOG.md` so both files agree on where the record lives.

---

### Task 1.9: Fill `docs/core/ARCHITECTURE.md` with a real index

**Files:**
- Modify: `docs/core/ARCHITECTURE.md`
- Reference: `docs/diagrams/ERD_PROJECT_AND_ARCHITECTURE.md`, `ERD_PLATFORM_CORE.md`

**Interfaces:**
- Consumes: Task 0.7 (both ERDs and the recovered `ARCHITECTURE.md`)
- Produces: an entry point that names every architectural artefact

- [ ] **Step 1: Check whether the recovered version is sufficient**

If `docs/core/ARCHITECTURE.md` came back populated from the archive, **skip this task.** It
is 1 byte in the working tree but may be complete in the archive. Verify before writing.

- [ ] **Step 2: If still a stub, write an index — not a duplicate**

`ARCHITECTURE.md` must **point at** the sources of truth, not restate them. Restating is
what produced D-12 (a 1,159-line Master Plan that specifies no data model).

```markdown
# EduFlow360 — Architecture Index

This file is an **index**. It is not a specification. Each concept has exactly one
authoritative document; this file names them.

## Decisions
| Concern | Authority |
|---|---|
| Architecture decisions | `docs/adr/` (22 ADRs) |
| Module inventory and editions | `docs/core/EduFlow360_Project_Master_Plan_v5.3.md` §3, §5 |
| Requirements | `docs/core/EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md` PART A |
| Data model | `docs/diagrams/ERD_PROJECT_AND_ARCHITECTURE.md`, `ERD_PLATFORM_CORE.md` |
| Domain vocabulary | `docs/core/GLOSSARY.md` (Phase 2) |
| Decision record | `docs/core/SSOT.md` |
| Build contract | `AGENTS.md` |

## Layering
`apps/web` (Next.js) · `apps/api` (NestJS, Clean Architecture:
`domain/` → `use-cases/` → `infrastructure/`, wired in `app.module.ts`)
· `packages/{shared-types,ui-kit,i18n-resources,config}`
· PostgreSQL + Redis · single-tenant, one database per school.

## Rules that are enforced, not documented
Run `pnpm docs:verify` and `pnpm check:route-guards` — these fail the build. A rule
that is only written down is not a rule.
```

- [ ] **Step 3: Verify the docs gate accepts it**

```powershell
pnpm docs:verify
```
Expected: exit 0.

---

## PART IX — PHASE 2: MAKE THE DOCS SELF-CONSISTENT (specification work)

**These are specifications to be written, not tasks to be executed.** Each produces a
document that a later planning session turns into a build plan.

**Sequencing rationale:** Phase 1 restores the contract. Phase 2 makes the specification
internally consistent **against that contract** — so the glossary and the RBAC matrix are
written once, correctly, instead of being re-derived by every agent that touches a domain.

| # | Deliverable | Closes | Est. |
|---|---|---|---|
| 2.1 | `AGENTS.md` health check — confirm the recovered copy covers §2.1, §2.14, §2.17, §2.18, §8, §11 | D-02 | 1h |
| 2.2 | `docs/core/SSOT.md` reconciliation — merge recovered decisions with the v5.3 docs | D-21 | 3h |
| 2.3 | Renumber Master Plan §21 → 21.1–21.6, §26 → 26.1–26.3; fix §28's stale `[REVISED v4]`; resolve the same-line date contradiction in `School_Setup_Workflow_v1.1:4` | D-09, D-23 | 2h |
| 2.4 | `docs/core/GLOSSARY.md` — one canonical term per concept. **Only V-1 (`Section`/`Level`/`Class`) and V-2 (`parent`/`guardian`) need an owner decision. Ship the other 7 unilaterally.** | D-19 | 3h + decision |
| 2.5 | Data model — write the ERD as the authority; Master Plan names entities but defines no columns | D-12 | 2d |
| 2.6 | NFRs — rewrite all 9 with "shall" statements, measurement windows, percentiles, RPO/RTO. Delete the *"where hardware permits"* escape clause in NFR-08. Resolve NFR-09 vs `FR-SET-03` (public logo) by carving out explicit public routes | D-15 | 1d |
| 2.7 | Reclassify `School_Setup_Workflow_v1.1` as `IMPLEMENTATION_GUIDE`; make Master Plan §5A the sole setup authority. Fix the "hard limit" vs "warnings" contradiction. Resolve or delete the unapproved "Proposed:" language fields | D-11 | 3h |
| 2.8 | License `allowed_modules` — add the 4 missing domains (Facilities, Alumni, Leadership, Wallet); decide whether leaf-level keys stay | D-13 | 2h |
| 2.9 | Role & permission matrix — canonical identifiers, display labels, and permissions for all roles. Seed the 4 unseeded roles. Define `Principal` and `Academic Coordinator`. Decide `SUPERADMIN`'s superset semantics | D-14, D-20 | 2d |
| 2.10 | Make the Jira epics' acceptance criteria **normative**; add ACs to the 120 FRs that lack them, or delete the SRS Definition of Done clause that references them | D-16 | 1d |
| 2.11 | **New ADR: a gate must prove soundness, not presence.** Forbid declaring a control implemented without an adversarial test. Encode the `@Audited`-writes-nothing lesson | D-17 | 2h |
| 2.12 | Write the template → design-token mapping (bespoke `--bg`/`--brand`/`--accent` → shadcn `--background`/`--primary`). Author real application i18n keys — the template has **21 marketing keys and zero application keys**. Build the RTL app shell; the template has **4 RTL rules** | D-18 | 3d |
| 2.13 | One roadmap. Pick one owner (recommend Master Plan §28), fold in SRS PART E, delete the other. Add exit criteria to every phase. Resolve the MVP caret landing at month 15 | D-25, RC-3 | 1d |
| 2.14 | Pin file encoding — `.gitattributes` marks `*.md *.html *.json` as UTF-8, and `docs-verify.mjs` fails on a replacement character | D-24 | 1h |
| 2.15 | Wire the orphan diagrams — `Diagrams.html` and `Diagrams.excalidraw` have zero inbound references. Reference them from the Master Plan or move them | D-22 | 30m |

---

## PART X — PHASE 3+: BEYOND DOCUMENTATION

Stated as scope, not as a plan. Each needs its own spec and its own implementation plan.

### Phase 3 — Close the foundation gaps (2–3 weeks)

The recovered `EPIC_STATUS.md` measured **8 of 10 platform epics at 0% production code**:
Licensing, Audit, Diagnostics, Notifications, Storage, Health.

Order matters — this is the recovered project's own recommended order, and it is sound:

1. **Permission engine (`PLT-2xx`)** — 42 pts, largest block. Turns `@RequirePermission` from
   vocabulary into control. Requires the 2.9 matrix first.
2. **Audit writer (`PLT-402`)** — `@Audited` is on sensitive routes and writes nothing.
   `AGENTS.md` §2.7 requires append-only with DB-level immutability.
3. **Email adapter (`PLT-701`)** ⚠ **owner decision** — the only thing blocking `PLT-105`,
   and therefore forgot/reset password. The recovered record explicitly flags this as an
   owner call, not a build-order call.
4. **`PLT-105` reset flow** — unblocked by 3.
5. **`PLT-701` router** — SMS/WhatsApp adapters.
6. **`PLT-3xx` licensing**, **`PLT-8xx` storage**, **`PLT-9xx` health**, **`PLT-5xx` diagnostics**.
7. **`SEC-115` env reconciliation** — Phase 1, task 1.6.

**Exit gate:** every P0 platform epic has production code **and** an adversarial proof
(per 2.11) that the control is obeyed, not merely present.

### Phase 4 — One vertical slice (4–6 weeks)

School Setup + Academic Setup, end to end: `apps/web` → API → PostgreSQL → guard → audit
row → i18n (4 locales) → RTL → light/dark → visual regression.

The 16 epics are already decomposed (`SchoolSetup_Academic_v1`: 269 pts, 656 work items,
arithmetic verified). Execute them; do not re-plan them.

**Exit gate:** a real school configured end to end and UAT-signed against the Workflow's
`G0`–`G9` gates.

**Why one slice first:** it exercises every layer — guard, audit, licensing, i18n, RTL,
visual regression, migrations — on a bounded scope. Every one of the other 19 domains
inherits the proof. It is also the cheapest demonstration that the recovered environment
boots in a real environment.

### Phase 5 — Scale

Per Master Plan §28, now that it is the single roadmap: Attendance → Finance → the rest.

**Sequencing note from the recovered record:** Finance's General Ledger was **P1 and
Phase-unassigned** in the SRS while MVP acceptance criterion #4 requires a payment that
*reconciles correctly*. Fix that before Phase 5 or the MVP cannot be signed off.

---

## PART XI — SELF-REVIEW

Run against this document as if it were a spec.

**1. Spec coverage.** Every S1 and S2 finding in the debt register maps to a Phase 0, 1, 2,
or 3 action: D-01 → 0.1/0.2 · D-02 → 0.7/2.1 · D-03 → 1.5 · D-04 → 1.6 · D-05 → 1.6.4 ·
D-06 → 0.8.4/1.6.5 · D-07 → 1.7 · D-08 → 0.4/0.8.1 · D-09 → 2.3 · D-10 → 2.5/2.6 ·
D-11 → 2.7 · D-12 → 2.5 · D-13 → 2.8 · D-14 → 2.9 · D-15 → 2.6 · D-16 → 2.10 ·
D-17 → 2.11 · D-18 → 2.12 · D-19 → 2.4 · D-20 → 2.9 · D-21 → 2.2 · D-22 → 1.8/2.15 ·
D-23 → 2.3 · D-24 → 2.14 · D-25 → 2.13. **25 of 25 mapped. No orphans.**

**2. Placeholder scan.** No "TBD", "implement later", "similar to Task N", or "add
appropriate error handling" anywhere. Every Phase 0 and Phase 1 step names a file, a
command, and an expected output. The two steps that could have been guesses —
0.1.2 (credential shape) and 1.5.2 (port decision) — are written to *stop* rather than
assume, because both are security- or correctness-critical and one is explicitly an owner
decision in the source docs.

**3. Type consistency.** Phase 0 produces: rotated credentials, live `.git`, a complete
tree, `.gitignore`, a quarantined archive, a green gate baseline. Phase 1 consumes the
restored tree and the confirmed port scheme; 1.6 depends on 1.5's confirmed names and no
task references a name introduced by a later task. Phase 2 consumes the Phase 1 contract —
2.4 (glossary) and 2.9 (role matrix) are dependencies of 2.5 (data model) and 2.10 (ACs),
and the ordering table reflects that.

**4. Honest scoping.** Phases 2–5 contain **no executable steps**, because they are
specification and build work that cannot be planned until Phase 0 and 1 land. Writing
pseudo-tasks for them would be the same "plans that describe without showing" failure the
Master Plan itself exhibits in 6 stub sections. Stating the scope and the dependencies is
the honest deliverable at this stage.

---

## PART XII — THE ONE-PARAGRAPH VERSION

The `docs/` folder is not the problem — it is unusually good in places (22 ADRs, honest
self-reporting, correct port boundaries, verified epic arithmetic) and unusually weak in
others (1,159-line Master Plan that specifies no data model, SRS whose 120 FRs have zero
acceptance criteria, an RBAC epic that seeds 2 of 6 roles and no permission matrix).

But none of that matters yet, because **the working tree you are looking at is not the
project**. It is 24 files. The project — 87 commits, 2,087 files, all ten gates green — is
compressed into a 217 MB archive in the repo root, alongside two sets of live credentials
and no `.gitignore`.

So do not start planning features. Spend one day rotating credentials and restoring git,
one more reconciling the environment, and five making the specification internally
consistent against the contract that recovery brings back. That is 5–8 days to a secure,
version-controlled, self-consistent project — and every one of the 21 domains you have
planned is blocked until it happens.

The second-order lesson is in `EPIC_STATUS.md:27-33`, and it deserves to be an ADR: *nine
green gates once coexisted with an application where `@Audited` was on every sensitive
route and wrote nothing.* `check-route-guards` proved the decorator was present. Nothing
proved it was obeyed. Write down that a gate must prove soundness, not presence — or the
same failure returns on the next module.
