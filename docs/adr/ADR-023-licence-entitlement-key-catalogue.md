# ADR-023 — Licence Entitlement Key Catalogue: the six missing keys, named

**Status:** ✅ **Accepted 2026-10-11 (owner)**
**Date:** 2026-10-11
**Deciders:** owner (closes `ARC-09-6` / the entitlement half of `⚑D-c`; supplies `PLT-301`/`PLT-302` their catalogue)
**Affects:** `PLT-EPIC-03` (Licensing & Entitlement Enforcement) · `AGENTS.md` §2.3
**Source:** `ARC-09-6` (`docs/work/TODO.md`), Master Plan §3 (edition matrix), §4.2 (certificate payload)

---

## Context

`ARC-09-6` / GAP-GATE-1: six capabilities are **gated in the Master Plan §3
edition matrix** but have **no key** in the signed certificate payload
(`allowed_modules` / `features`), so `@RequireEntitlement('<KEY>')` cannot be
written for them — the decorator exists, the vocabulary does not. The payload
example in Master Plan §4.2 predates the v5 additions that created the gap:

| Matrix row (MP §3) | Key space | State before this ADR |
|---|---|---|
| Substitution Auto-Assignment | `features` | `substitution_auto_assignment` exists in the example — the only one of the six |
| Facilities & Sports-Ground Booking | `allowed_modules` | **missing** |
| School Hall Rental Pack | `features` | **missing** |
| Student Wallet | `features` | **missing** |
| Student Alumni Network | `allowed_modules` | **missing** |
| Student Leadership & Prefect System | `allowed_modules` | **missing** |

`AGENTS.md` §2.3: *"`@RequireEntitlement` is required on any feature-gated
capability so a Basic-edition school cannot reach Deluxe functionality by
calling the API directly."* A gate with no key is a gate nothing can hold.

## Decision

**The catalogue is extended with six keys, following the payload's existing
conventions** — `allowed_modules` takes module keys (snake_case), `features`
takes capability keys (snake_case), and nothing else changes shape:

| New key | Space | Implements (MP §3 row) | Notes |
|---|---|---|---|
| `facilities` | `allowed_modules` | Facilities & Sports-Ground Booking | Internal-only at Standard, internal + external hire at Advanced; the **hire** flavour is a separate key below |
| `hall_rental_pack` | `features` | School Hall Rental Pack (deposit, inspection, add-ons) | A feature ON `facilities`: the pack adds deposit/inspection/add-ons to a hall booking |
| `student_wallet` | `features` | Student Wallet (prepaid, parental limits) | Enterprise add-on; **also requires the stored-value legal review (`PC-006`)** — the key existing is not permission to ship |
| `alumni_network` | `allowed_modules` | Student Alumni Network | Directory + Events at Advanced, Full (incl. Giving) at Enterprise |
| `student_leadership` | `allowed_modules` | Student Leadership & Prefect System | Basic at Standard, full above |
| `substitution_auto_assignment` | `features` | Substitution Auto-Assignment | **Already existed** — confirmed, not added. The row is listed because the audit named it as missing; it is the one of the six that was present |

**Two rules the catalogue is written under:**

1. **Module keys gate a module registry row; feature keys gate a capability
   inside or above one.** `PLT-602`'s registry and `PLT-403`'s viewer read the
   same key, so a school's certificate is the single source of what is on.
2. **Edition names never appear in a key or a guard.** `ADR-009`'s schema
   comment says it and this catalogue keeps it true: gating is by key, so a
   fifth edition is a certificate payload change, not a code change.

## Consequences

### Positive

- `@RequireEntitlement('<KEY>')` can now be written for every capability the
  edition matrix gates — the decorator stops being vocabulary.
- `PLT-301` (validator) and `PLT-302` (enforcement) have a fixed catalogue to
  validate against; a certificate naming an unknown key is a schema error,
  not a silently-granted feature.
- The certificate payload example in Master Plan §4.2 is now out of date in a
  way that is *recorded* rather than discovered mid-implementation.

### Negative / accepted costs — recorded, not hidden

- **The payload example (§4.2) should be amended** to carry the six keys. It
  is a corpus document; amending it is a documentation follow-up, and the
  amendment must not invalidate the ADR-009 canonicalisation (the example is
  illustrative, the schema is the contract).
- **`student_wallet`'s key precedes its legal clearance.** `PC-006`'s
  jurisdictional review (`AGENTS.md` §2.10) gates SHIPPING, not naming; the
  key exists so the gate can be written, and the module stays dark until the
  review lands.
- **`facilities` vs `hall_rental_pack` is a judgement.** If the corpus later
  decides a hall hire can exist without general facilities booking, the
  feature key becomes the module key. Recorded here so the split is visible
  when that decision is made.

## Rejected alternatives

**❌ One `experimental_features` bucket.** Rejected: an unbounded bucket is a
gate nobody can enumerate, and `PLT-403`'s viewer cannot show a school what a
bucket holds.

**❌ Name keys after editions (`deluxe_hall_hire`).** Rejected: violates
`ADR-009`'s no-edition-in-code rule and makes a mid-term upgrade a migration.

**❌ Wait for `PLT-EPIC-03` to settle the catalogue.** Rejected: the story
writes the validator against this list. Deciding it afterwards guarantees a
second pass.

## Links

- `ARC-09-6` (`docs/work/TODO.md`) · GAP-GATE-1
- Master Plan §3 (edition matrix rows), §4.2 (certificate payload)
- `ADR-009` (signature/canonicalisation), `ADR-006` (licensing in milestone 1)
- `PLT-301`/`PLT-302`/`PLT-403` · `PC-006` (wallet legal review)

## Revisit when

- Master Plan §4.2 is amended (payload example) — keep the schema and the ADR in step.
- A capability appears in §3 with no key here — that is the guard this ADR installs: add it here first.
