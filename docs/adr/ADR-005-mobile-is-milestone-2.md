# ADR-005 — `apps/mobile` Is Milestone 2

**Status:** ✅ **Accepted 2026-09-30 (owner) — the `SRS` §19 conflict is a recorded deviation, not a blocker**
**Date:** 2026-09-28
**Deciders:** *unrecorded* (`AGENTS.md` §7 states the decision was taken 2026-09-27, D5)
**Affects:** `AGENTS.md` §7 · `SRS` §19, §21–24 · `PLT-104`, `PLT-106`, `PLT-702` (push half)

---

## Context

The two governing documents disagree.

**`SRS` §19 (MVP scope, In):**
> Mobile: Personal Portal mode (Parent/Student), push notifications (FR-MOB-01 partial, FR-MOB-03)

**`SRS` §20 (MVP acceptance criteria), item 5:**
> A Parent can log into the mobile Personal Portal and see their child's attendance, exam results, and fee status.

**`AGENTS.md` §7 (decided 2026-09-27, D5):**
> **`apps/mobile` is milestone 2** (D5) — `PLT-104`, `PLT-106` and the push half of `PLT-702` move with it. The milestone-2 MVP is a **reduced vertical slice**: enrolment → class assignment → attendance → fee invoice → GL posting → receipt.

So `SRS` acceptance criterion 5 cannot be met in the MVP, because there is no mobile app in the MVP.

**Why a decision was needed.** The Master Plan §24 defines **five** mobile modes: Personal Portal, Bus Tracker, Attendance Kiosk, Teacher Companion, Staff Self-Service. The Attendance Kiosk in particular is on the **offline-first critical path** (`AGENTS.md` §2.12) and the credential-reuse design (Master Plan §28) makes the ID card a shared Attendance/Library/Asset token. Building a single mobile binary early means building all five modes' navigation and capability infrastructure before the web app has proven the domain.

---

## Decision

**`apps/mobile` is milestone 2.** The following move with it:

| Story | Title | Original priority |
|---|---|---|
| `PLT-104` | OTP-based login (Parent/Student self-service) | P1 |
| `PLT-106` | Jailbreak/root detection for sensitive mobile roles | P2 |
| `PLT-702` (push half) | Push channel adapter (Expo Push / FCM / APNs) | — |

**Milestone 2 is a reduced vertical slice**, not the full MVP: enrolment → class assignment → attendance → fee invoice → GL posting → receipt.

**The workspace already accommodates it.** `pnpm-workspace.yaml` globs `apps/*` (ADR-001), so no structural change is needed when it arrives.

---

## Consequences

### Positive
- Mobile is built **after** the web app has proved each domain, so a domain change does not require changing five mobile modes.
- Avoids building the five-mode capability wizard and navigation shell before there is anything to navigate to.
- Frees milestone-1 capacity for the critical path: `PLT-EPIC-01 → 02 → 03 → 04`.
- Reduces MVP surface: fewer acceptance criteria to satisfy, faster to a real school running.

### Negative / accepted costs
- **A parent-facing gap exists in the MVP.** Absence alerts and fee reminders reach parents by email and web only.
- **`SRS` §20 criterion 5 is unachievable in the MVP as written.** Either the criterion moves to milestone 2, or the mobile scope moves back. **This is the open decision below.**
- Notifications lose their cheapest high-urgency channel (push is free; SMS and WhatsApp are per-message billed — `AGENTS.md` §2.2), making email load heavier in the MVP.
- The Attendance Kiosk — an offline-first, hardware-adjacent surface — is delayed. Mitigated because kiosk offline behaviour is designed into the attendance engine itself (`AGENTS.md` §2.12), not bolted onto the mobile build.

### Neutral
- iOS-first parity was already out of scope; Android-first (`SRS` §19).
- Detox E2E testing moves to milestone 2 with the app.

---

## Open decision ⚑

**Choose one:**

| Option | Consequence |
|---|---|
| **A — Adopt D5.** `apps/mobile` is milestone 2. | Amend `SRS` §19 to move "Mobile: Personal Portal" to P1/fast-follow, and move `SRS` §20 criterion 5 to milestone 2. **Recommended** — it is the decision already taken, and the reasoning holds. |
| **B — Revert to `SRS`.** A thin Personal Portal ships in the MVP. | Unblocks `SRS` §20 criterion 5 as written. Costs milestone-1 capacity on a surface that will be reworked when the other four modes arrive. Delays the critical path. |
| **C — Split.** Parent read-only web portal in the MVP; mobile Personal Portal in milestone 2. | Satisfies the *intent* of `SRS` §20 criterion 5 without a mobile build. **Also defensible** — the criterion's substance is "a parent can see their child's attendance, results and fee status", not "on a phone". |

Tracked as `TODO.md` ⚑9 / `BACKLOG.md` BLG-051.

---

## Revisit when
- A pilot school's parents refuse web access and require a mobile app — that is a real finding, not a preference.
- The Attendance Kiosk becomes a go-live blocker for a specific school.
- Expo/React Native tooling proves unstable enough to affect the schedule.

---

*Indexed in `docs/adr/README.md` · Records `AGENTS.md` §7 (D5) · Conflicts with `SRS` §19 · Precedence per `AGENTS.md` §1: `AGENTS.md` wins, so D5 is currently binding and `SRS` §19 is the document in error.*
