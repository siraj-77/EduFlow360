# `edge-cases-and-risks.md` — Edge Cases, Risks & Failure Modes

> 🔴 **NOT YET EXTRACTED.**
> Required by `AGENTS.md` §6. Tracked as **`REQ-05`** in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6.
> **A read against this file returning nothing is the expected result today, not a bug.**
> See `docs/idea-bank/README.md` for the extraction spec and the citation rules.

**Status:** Placeholder. Zero entries.
**Purpose:** every boundary condition, failure mode and known gap, **each mapped to a test**.

---

## Sections this file will carry

| Section | Content |
|---|---|
| Boundary conditions | The edges where a rule engine changes behaviour. `AGENTS.md` §4.1 requires these explicitly, not just the happy path |
| Failure modes | What happens when each dependency fails, and whether the system degrades or breaks |
| Known gaps | The `PC-000`…`PC-006` set, with blocking impact |
| Test standards | What "tested" means per layer — `SRS` §10, §12 |
| Risk register | Master Plan §30, the School Setup Workflow Appendix J, and engineering risks found during the build |

## Boundary conditions Platform Core must prove

Recorded here so the extraction cannot omit them. Each is a **test**, not a paragraph.

| Boundary | Story | Test shape |
|---|---|---|
| Lockout: 4 fails (allowed) / 5th (locked, 429) / cooldown expiry | `PLT-101` | Table-driven, `FakeClock` |
| Refresh-token reuse after rotation ⇒ **entire family revoked** | `PLT-102` | Includes the concurrent-refresh race |
| Session revoked ⇒ invalid on the **next request**, not the next refresh | `PLT-103` | — |
| Password reset success ⇒ **all** sessions invalidated | `PLT-105` | No account enumeration on the request endpoint |
| Ownership: teacher A ≠ teacher B, both holding `GRADE_ENTER` | `PLT-203` | Role-denial vs ownership-denial distinguishable in **logs**, not in client responses |
| Licence: valid / bit-flipped / **expired ≠ invalid** / wrong key | `PLT-301` | Canonical-JSON reordering must **not** break a valid signature |
| Grace period: day 13 / **day 14** / day 15 ⇒ lock | `PLT-305` | `FakeClock`; never real time |
| Audit `UPDATE`/`DELETE` | `PLT-401` | Must **fail at the database level** as the application role, not merely "no code calls it" |
| `reason` missing on a `reasonRequired` action ⇒ 400 | `PLT-402` | — |
| Redaction of `password`, `Authorization`, card-shaped strings, secrets, biometric templates | `PLT-502` | Table-driven; a CI scan asserts none ever reach raw output |
| Log rotation: cap 25 MB, 3 historical, oldest purged | `PLT-503` | Writes past the cap; `ERROR`/`CRITICAL` still queryable in the DB afterwards |
| `PLT-205` matrix: every permission key has a row | `PLT-205` | Direct-API negative tests, bypassing the UI |

## Known gaps — must appear here

`PC-000` attendance (no design) · `PC-001` leave/workforce (no design) · `PC-002` grading & moderation (zero rules) · `PC-003` tax & currency (never mentioned, despite invoicing) · `PC-004` admission (in the MVP list, no FR) · `PC-005` retail/hall · `PC-006` wallet.

**These domains cannot be built until designed.** `REQ-07` requires each to be either designed, or formally deferred with a **named owner and a target milestone** — an unticketed deferral is how `PC-005`/`PC-006` already happened.

## Risks already on record

- **Master Plan §30** — kiosk offline handling, teacher-attendance/payroll discrepancy, leave-approval delegate cycles, biometric privacy, licence grace period, plus the v4/v5.0/v5.2 entries (video-conferencing cost, chatbot hallucination, hostel scope creep, **shared QR/RFID credential blast radius**, report-card layout diversity, external-hire identity, alumni adult-privacy, merit-points perception, third-party vendor data access, canteen allergy liability, **stored-value regulation**, commission disputes, hall double-booking, mid-year operator-model switch).
- **School Setup Workflow Appendix J** — setup-specific risk register.
- **Engineering risks** — surfaced during the build and recorded in `docs/work/BACKLOG.md` and the worklog.

---

*Companion: `docs/idea-bank/README.md` · `business-rules.md` · `SRS` §10, §12 · Master Plan §30*
