# ARC-08 — Project ERD and Reference Architecture

**Status:** written 2026-09-30 · **Extends** ARC-01 (Platform Core), does not replace it
**Diagrams:** `ERD_PROJECT.excalidraw` · `REFERENCE_ARCHITECTURE.excalidraw`
**Source of truth for both:** `apps/api/erd/project-erd-source.mjs`
**Gate:** `apps/api/src/config/project-erd.spec.ts` (27 cases)

---

## 1. What this is, and why it is not a bigger ARC-01

`ARC-01` draws fourteen tables that exist and are generated into a Prisma schema. That is a correct ERD of a module that exists. It is not an answer to the question a reviewer opens `docs/` with: **what does the whole system look like, and what is still undesigned?**

So this adds two diagrams at the level above the schema:

| Artefact                        | Path                                              |
| ------------------------------- | ------------------------------------------------- |
| Entity/module/gap/engine data   | `apps/api/erd/project-erd-source.mjs`             |
| Diagram renderer                | `apps/api/erd/render-project-diagrams.mjs`        |
| Excalidraw writer               | `apps/api/erd/render.mjs`                         |
| Standalone geometry check       | `apps/api/erd/check-geometry.mjs`                 |
| Contract gate                   | `apps/api/src/config/project-erd.spec.ts`         |
| Project ERD                     | `docs/diagrams/ERD_PROJECT.excalidraw`            |
| Reference architecture          | `docs/diagrams/REFERENCE_ARCHITECTURE.excalidraw` |

```bash
pnpm --filter @eduflow/api generate:diagrams   # rewrite both, then check geometry
```

Same one-source discipline as `ARC-01`: `project-erd-source.mjs` drives both the picture and the gate's expectations, so the two cannot describe different systems, and a hand-edit to either file fails the build.

## 2. The design decision this diagram exists to protect

The corpus is uneven. `SRS` §6 names 35 entities; the Master Plan adds at least 120 further concrete concepts; and `AGENTS.md` §6 **withdraws** the "35 entities" figure rather than replacing it with another number, because `docs/idea-bank/` turned out to hold 16 KB of empty stubs.

The temptation when drawing a system this uneven is to fill the page — a plausible `Student`, `Vehicle`, `Book`, `Wallet`. **That is exactly what this diagram refuses to do.** `docs/idea-bank/README.md` §6 rule 5: _"A fabricated business rule is worse than a missing one … A missing rule is visible. An invented one is not."_ Seven of those fabrications have names (`PC-000`…`PC-006`); drawing them would convert documented holes into unearned certainty, and nothing downstream could tell the difference.

So every row carries an **evidence tier**, and the tier is the most important column on the diagram:

| Tier         | Means                                                 | What may be drawn             |
| ------------ | ----------------------------------------------------- | ----------------------------- |
| `SPECIFIED`  | corpus names the entity **and its fields**             | entity + fields               |
| `NAMED`      | corpus names the entity, **not** its fields            | entity; fields marked as GAP  |
| `MODULE`     | capability exists, **no entity name**                  | the module — never a table    |
| `GAP`        | a documented `PC-xxx` hole                             | the hole, with its ticket     |

## 3. What the ERD shows

**23 modules**, each with its licence gate, evidence tier, source citation and named entities:

- `SPECIFIED` (4) — Platform Core (14 generated tables), Academic (14), Finance (5), and the engines.
- `NAMED` (12) — Attendance, Workforce, Learning, Identity & Documents, Assets, Facilities & Hall, Retail & Concessions, Alumni, Leadership, Communication, Helpdesk, Mobile.
- `MODULE` (7) — Library, Transport, Hostel, Student Wallet, Events & Sports, AI Services, Integrations. **Zero entity names in the corpus for five of these.**

**7 requirement gaps, drawn as gaps**, in their own band rather than inside the modules they block — a gap drawn inside a module reads as handled; a gap drawn beside it reads as open.

**7 shared engines** (`AGENTS.md` §2.9) with both halves drawn: what each covers, and what it forbids.

## 4. Findings from the corpus analysis that the diagram records

These came out of reading the corpus, not out of designing, and each is on the diagram because it is a decision a reviewer needs to see was made:

| # | Finding                                                                                                                                                          | Consequence                                                                                |
| - | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1 | `SRS` §6 names a **`School`** entity. `ADR-003` and the shipped `ARC-01` schema have **no `School` table**.                                                    | `AGENTS.md`/`ADR-003` win. The discrepancy is **stated on the diagram**, not resolved by omission — a reader who has just read `SRS` §6 needs to see it was decided. |
| 2 | **Six §3 capabilities have no key** in the signed certificate's `allowed_modules`/`features`: facilities hire, hall rental, wallet, alumni, leadership, substitution.       | An entitlement guard **cannot be written** against a capability the licence payload cannot name. `hostel_module` is the only add-on gated by a `features` bool. |
| 3 | `LedgerEntry` (`SRS` §6), "Journal Entry" (`MP` §5.2), `journal_entries` (`AGENTS.md` §2.6) are **one concept, four names**.                                          | The balance invariant forces **entry + line**, never one table.                                                                                          |
| 4 | The default Chart of Accounts seeds `1000/4000/5000` but **omits two accounts the spec requires**: `Deposits Held` (§17.6) and the **wallet liability** (§17.10).      | A checkable inconsistency between `MP` §5.2 and `MP` §17.6/§17.10.                                                                                     |
| 5 | `operator_model` is **the only effective-dated field in the entire corpus**.                                                                                      | Everything else called "configurable" is not effective-dated. A mid-year operator switch needs a temporal record, not a mutable column.                 |
| 6 | `NotificationDelivery` has **no money column**, deliberately: a per-message SMS/WhatsApp bill is a financial transaction and posts through `ILedgerPostingRule`.    | Drawn as a prohibition, because a cost column here would be a second unbudgeted place for money.                                                       |
| 7 | Money representation, `school_id`, and time columns are **absent from the corpus entirely** — only `MP` §2.1's "fixed-precision numerics" exists.                      | These come from `ADR-002` and `AGENTS.md` §2.1, not from the corpus. Citing the corpus for them would cite a document that is silent.                    |
| 8 | Five modules (`Library`, `Transport`, `Hostel`, `Events & Sports`, `AI`) have **zero entity names** across both corpus documents.                                   | Drawn at `MODULE` tier with no table. This is the honest answer, and it is why those modules cannot be built without `PC-xxx` work first.                |

## 5. The reference architecture

Covers what a feature list cannot:

1. **Clean Architecture layer stack**, each layer stating what it **may** and **may not** import. A boundary nobody can see is a boundary nobody enforces.
2. **The four route decorators** — `@RequirePermission`, `@RequireEntitlement`, `@Audited`, `@Public` — with the rule that a route carrying neither `@RequirePermission` nor `@Public` is a defect.
3. **Nine vendor seams** with their implementations. The two **deliberately undecided** providers (`ISmsAdapter`, `IPaymentGatewayAdapter`) are drawn in red: an undecided provider is exactly where someone hard-codes one.
4. **Deployment** — one school, one deployment, one database, with the stores that are *not* stores of record marked as such.

## 6. How this was verified

| Stage          | Result                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **RED**        | Suite failed to load — `project-erd-source.mjs` did not exist. No test could pass.                  |
| **RED (real)** | `NotificationPreference is missing from the ERD` and `expected … to match /one database per school/`. Both genuine content bugs. |
| **RED (gate)** | Drift gate proven to fire: hand-editing one element colour in `ERD_PROJECT.excalidraw` failed the build with the regenerate instruction. |
| **GREEN**      | **27/27 passed**. `lint` exit 0 · `typecheck` exit 0 · geometry `PASS` on both files.               |

The anti-drift gate was verified by **breaking** it, not by trusting it: one hand-edit to a committed diagram was enough to fail the build.

### Six defects the cycle found, each now prevented by a test

These are worth recording because every one was invisible in the element list and visible only on the canvas or in the bytes:

| Defect                                                                                                  | Caught by                                                          |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `...el` spread **after** `id` overwrote it with `undefined`; `JSON.stringify` drops undefined keys, so the written file looked correct while memory disagreed. | drift gate (compares objects, not text) |
| `nextId` passed instead of **called** — IDs became a function's own source text, and the canvas refused the batch with a generic error. | `has no element Excalidraw would reject` |
| `false && text(…)` spread into the element list as **seven typeless elements**.                            | same                                                                 |
| Zero-width arrows — Excalidraw rejects them.                                                              | same                                                                 |
| **Encoding corruption.** A PowerShell `latin1` round-trip during editing turned every em dash, arrow and `§` into U+FFFD. Excalidraw renders a replacement glyph rather than failing. | `is valid UTF-8 with no mojibake` |
| **Three layout collisions**: Platform Core's 14-entity list ran into its own caption; a 3-line subtitle overlapped the first band header by 3px; the architecture's two band headers were both 1400px wide and sat on top of each other. | `no overlapping text`, `keeps every label inside the card` |

Two consequences worth keeping:

- **Card and box heights are now derived from content, not constants.** A fixed height is what allowed the collisions; the card grows with its longest label.
- **The generator emits `G.*` constants** for every non-ASCII glyph rather than literals, so the corruption class cannot recur silently.

## 7. Open questions — flagged, not answered

1. **Does a user need more than one role?** Carried forward from `ARC-01` §5 Q1. `User.roleId` is single; a teacher who is also a parent cannot be expressed. `ARC-01` asks for a `UserRole` join table — a fifteenth entity — which is an owner decision before `PLT-201`.
2. **The journal entity's name and shape.** Four names for one concept (finding 3). The ERD draws `Journal Entry` + `Journal Line` because the balance invariant forces it, but the naming is not settled.
3. **Gap-GATE-1 (finding 2).** Six gated capabilities have no certificate key. Either the payload extends or the entitlement gate cannot be written. Unresolved.
4. **The default CoA omissions (finding 4).** Two accounts the spec requires are absent from the seed. Unresolved.
5. **`AttendanceRecord` has no `studentId`/`teacherId`/`staffId`** — the actor polymorphism mechanism is unspecified. `PC-000`.
6. **No migration exists.** `prisma migrate` is P4 work (`SSOT.md`). Neither diagram changes that.

## 8. A pre-existing failure found but NOT fixed here

`schema-generation.spec.ts` → "has a checked-in schema.prisma that matches the source exactly" **fails on this machine**, and it failed identically before this work began.

Root cause, verified by byte inspection: `git config core.autocrlf=true` with **no `.gitattributes`** in the repository. The checked-in `schema.prisma` carries **687 CR bytes** (CRLF on every line); the generator writes **LF** (0 CR). The two are **byte-identical in content** — 687 lines each, no case-sensitive difference on any line.

The fix belongs in a repo-wide `.gitattributes` (`* text=auto eol=lf`), which changes checkout behaviour for every file in the repository. That is a wider decision than this task, so it is **reported rather than silently patched**. On a Linux CI runner with default `autocrlf=false` the gate passes as written.

## 9. What was deliberately not done

- **No entity was invented.** ~120 unnamed corpus concepts remain unnamed. They belong in `docs/idea-bank/domain-entities.md` as `GAP — needs design` rows (`REQ-02`), not in an ERD as a guess.
- **`docs/work/WORKLOG.md` and `docs/work/TODO.md` are not updated.** `AGENTS.md` §9 requires that in the same commit, and this change is real — but another agent owns the git index in this repository, so writing those shared files risks clobbering concurrent edits. **This entry still needs to be made.**
- **No ADR was written.** The corpus-of-record question — how an ERD relates to an uneven corpus — arguably deserves one (`ADR-025`+), and `ADR-025`/`ADR-026` are already earmarked for `D33`/`D34`. Not claimed here.
- **No git command of any kind was run.**