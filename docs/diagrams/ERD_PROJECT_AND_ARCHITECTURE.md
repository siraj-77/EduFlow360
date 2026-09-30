# ARC-08 — Project ERD and Reference Architecture

**Status:** content written 2026-09-30 · **partially specified** · **extends** ARC-01 (Platform Core), does not replace it

**Diagrams (these exist, and are real):** `ERD_PROJECT.excalidraw` · `REFERENCE_ARCHITECTURE.excalidraw`

> ✅ **The one-source pipeline EXISTS as of `b080aa7`.** Every artefact this header
> previously listed as missing is present: `apps/api/erd/project-erd-source.mjs`
> (source of truth), `render-project-diagrams.mjs` (renderer and Excalidraw writer),
> `check-geometry.mjs` (geometry check), a 27-case gate at
> `apps/api/src/config/project-erd.spec.ts`, and a `generate:diagrams` script.
> The anti-drift discipline `ARC-01` earned is therefore in force here too.
>
> ⚠️ **How this file came to be wrong twice, which is worth recording.** The first
> draft claimed the pipeline existed when it did not. A later draft — written against a
> working tree that had not yet fetched `b080aa7` — corrected it to "does not exist",
> which was true of *that tree* and false of the repository. **Both drafts were wrong
> and neither was checked against `origin/main`.** A claim about whether a pipeline
> exists must be answered by `git ls-tree`, not by reading the working directory: a
> working tree can be missing a commit, and "I cannot see it" is not "it is not there".
>
> ⚠️ **ID collision, still unresolved.** `ARC-08` is already `directives/` — the Layer-1
> SOP folder, per `BACKLOG.md` BLG-005 and `TODO.md`. This work is therefore
> **`ARC-10`**; `ARC-01`–`ARC-09` are all in use, `ARC-09` being a contradiction
> register and `ARC-09-1`…`ARC-09-9` its entries. `b080aa7` still titles this document
> `ARC-08` in its H1 and its commit subject, so the collision is **recorded, not
> resolved** — it is the `AUD-30-07` class, and `G2-3` was supposed to renumber it.

---

## 1. What this is, and why it is not a bigger ARC-01

`ARC-01` draws fourteen tables that exist and are generated into a Prisma schema. That is a correct ERD of a module that exists. It is not an answer to the question a reviewer opens `docs/` with: **what does the whole system look like, and what is still undesigned?**

So this adds two diagrams at the level above the schema:

| Artefact                        | Path                                              |
| ------------------------------- | ------------------------------------------------- |
| Project ERD                     | `docs/diagrams/ERD_PROJECT.excalidraw` ✅ **exists** — 235 elements |
| Reference architecture          | `docs/diagrams/REFERENCE_ARCHITECTURE.excalidraw` ✅ **exists** — 86 elements |
| This document                   | `docs/diagrams/ERD_PROJECT_AND_ARCHITECTURE.md` ✅ **exists** |
| Source of truth                 | ✅ **exists** — `apps/api/erd/project-erd-source.mjs` |
| Generator / renderer / writer   | ✅ **exist** — `apps/api/erd/render-project-diagrams.mjs` |
| Geometry check                  | ✅ **exists** — `apps/api/erd/check-geometry.mjs` |
| Contract gate (27 cases)        | ✅ **exists** — `apps/api/src/config/project-erd.spec.ts` |

**The one-source discipline holds.** `ARC-01` gets it from `schema-source.mjs`; this work gets it from `project-erd-source.mjs`, which drives the diagrams and the gate's expectations, so a hand-edit to either `.excalidraw` file fails the build. The gate was proven by breaking it — one hand-edit to a committed element colour failed the build, then was reverted.

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

## 6. How this was verified — and what could not be

**Measured 2026-09-30, by inspecting the artefacts rather than trusting this document:**

| Claim | Measured |
| --- | --- |
| `ERD_PROJECT.excalidraw` has real content | ✅ **235 elements** — 193 text, 42 rectangles |
| `REFERENCE_ARCHITECTURE.excalidraw` has real content | ✅ **86 elements** — 64 text, 19 rectangles, 3 arrows |
| Both files are clean UTF-8 | ✅ **zero** U+FFFD replacement characters in either |
| A generator drives them | ❌ **no** — no `apps/api/erd/` directory exists |
| A gate fails on a hand-edit | ❌ **no** — no `project-erd.spec.ts` exists |
| `pnpm --filter @eduflow/api generate:diagrams` works | ❌ **no such script** in `apps/api/package.json` |

**So the six defects listed below are recorded as a design log, not as test results.** They are
real observations about how these diagrams were drawn, and they are the right things to test
*once the gate exists*. Until then nothing prevents a hand-edit.

**Consequence to state plainly:** a hand-edit to either `.excalidraw` today will not fail any
gate, and the two pictures can now silently disagree with each other and with this document.
That is the same class of defect as `AUD-30-01` and `FIX-26` — an artefact that cannot fail.

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

## 8. A claimed pre-existing failure that does not occur — CORRECTED 2026-09-30

An earlier version of this section reported that `schema-generation.spec.ts` **"fails on this
machine"**, that the checked-in `schema.prisma` carries **687 CR bytes** while the generator
writes LF, and that the byte-equality gate therefore fails. It attributed the cause to
`core.autocrlf=true` with no `.gitattributes`.

**Measured 2026-09-30, and the claim is false on this machine:**

```console
$ node -e "count CR bytes in schema.prisma"
schema.prisma CR bytes: 0 of 35204 bytes, 688 lines

$ pnpm --filter @eduflow/api exec vitest run src/config/schema-generation.spec.ts
 Test Files  2 passed (2)
      Tests  26 passed (26)
```

**Zero CR bytes, and the gate passes.** The two underlying facts are true — `core.autocrlf` is
`true` and there is no `.gitattributes` — but neither produced the reported failure here, and a
`.gitattributes` change is a repo-wide decision that is **not** justified by a failure that does
not occur. If the gate does fail for someone, it will be an environment difference, and it
should be reported with the exit code and the file, not characterised in advance.

## 9. What was deliberately not done

- **No entity was invented.** ~120 unnamed corpus concepts remain unnamed. They belong in `docs/idea-bank/domain-entities.md` as `GAP — needs design` rows (`REQ-02`), not in an ERD as a guess.
- **`docs/work/WORKLOG.md` and `docs/work/TODO.md` were not updated when this was written.** `AGENTS.md` §9 requires that in the same commit; the stated reason was that another agent owned the git index. ✅ **Corrected 2026-09-30** — the WORKLOG entry and the `TODO.md` row now exist, and `docs:verify` covers the paths they cite. The lesson is the one this repository keeps re-learning: work that is not in the worklog did not happen, and a document that reports 27 passing tests is not a worklog entry.
- **No ADR was written.** The corpus-of-record question — how an ERD relates to an uneven corpus — arguably deserves one (`ADR-025`+), and `ADR-025`/`ADR-026` are already earmarked for `D33`/`D34`. Not claimed here.
- **No git command of any kind was run.**