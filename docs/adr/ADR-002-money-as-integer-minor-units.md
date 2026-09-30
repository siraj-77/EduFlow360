# ADR-002 — Money as Integer Minor Units, Scale per School

**Status:** ✅ **Accepted 2026-09-30 (owner)**
**Date:** 2026-09-28
**Deciders:** *unrecorded*
**Affects:** `AGENTS.md` §2.5, §2.6, §8 · `ARC-06` · every finance, retail and hall-rental module

---

## Context

EduFlow moves money from fees, payroll, facility and hall hire, library fines, BookShop and Canteen sales, third-party concession settlements, hall damage deposits and Student Wallet balances. Every one of those posts through the general ledger.

Two facts make representation a decision rather than a default:

1. **Every transaction must balance** — total debits equal total credits, enforced in the domain layer before the database (`AGENTS.md` §2.5). A representation that loses precision makes "balance" an unreliable invariant.
2. **A school configures its own currency and scale.** `AGENTS.md` §8 forbids hard-coding a school's currency. This is not theoretical: the product is sold into multiple jurisdictions, and the Master Plan's examples use both `$` and `ر.ع.`-style currencies.

---

## Decision

**All monetary amounts are fixed-precision integer minor units with an explicit currency code.**

```ts
// Illustrative shape — the real value object is ARC-06's deliverable.
type Money = { amount_minor: bigint; currency: string };
```

- **Never** `float` or `number` for money. No implicit rounding.
- **Rounding mode and minor-unit scale are a per-school setting**, read from school configuration — never hard-coded.
- A journal entry whose debits and credits do not sum equal is **rejected in the domain layer, before it reaches the database**. This invariant has a dedicated unit test and **must never be weakened**.
- Tax and currency rules are **not hard-coded in a use-case, entity or DTO**. Provider selection lives in `infrastructure/adapters/`; rates and currency come from school settings.

**Liabilities, per `AGENTS.md` §2.6:** hall damage deposits post to a *Deposits Held* liability; Student Wallet balances are a liability; `SCHOOL_RUN` outlets post gross sales + cost of goods, `THIRD_PARTY` outlets post only rent/commission.

---

## Consequences

### Positive
- `debits === credits` is an **exact** invariant, not an approximate one. A ledger that balances is provably correct.
- Adding a currency with different scale (e.g. 3-decimal accounting) is a settings change, not a code change.
- No floating-point drift in invoices, receipts or settlement statements — the artefacts a school shows to parents.
- Honours `AGENTS.md` §2.5 and the money-precision validation rules on the legacy reuse whitelist.

### Negative / accepted costs
- `bigint` does not serialise to JSON. Requires an explicit boundary conversion (string or minor-unit integer) at the API edge. **This must be designed in `ARC-06`, not discovered later.**
- Developers must remember `bigint` — arithmetic with a plain `number` literal throws at runtime rather than failing to compile in some cases. Mitigated by wrapping money in a value object so arithmetic is impossible to perform by accident.
- Currency conversion (if ever needed) requires a rate provider and an FX gain/loss account. **Out of scope for MVP**; a school sets one currency and transacts in it.

### Neutral
- Postgres `numeric` remains the storage type; the domain uses integer minor units and the mapping is explicit.

---

## Rejected alternatives

**❌ IEEE-754 `float` / `number`.** Rejected: `0.1 + 0.2 !== 0.3`. In a double-entry ledger this produces entries that appear balanced but are not, and the defect surfaces as an unreproducible reconciliation failure months later. This is not a style preference.

**❌ Store as `decimal`/`numeric` strings and do arithmetic in the database.** Rejected: it moves business logic into SQL, violating the Clean Architecture boundary (`AGENTS.md` §2.2), makes rule engines untestable without a database — which `SRS` §9 explicitly forbids — and puts rounding behaviour in the database engine rather than in one auditable place.

**❌ Hard-code 2 decimal places.** Rejected: `AGENTS.md` §8 forbids hard-coding a school's currency, and some jurisdictions use 0 or 3.

**❌ One currency for the whole product.** Rejected: each school sets its own. A single global currency is a hard-coded school value.

---

## Open sub-question

**Tax and currency is `PC-003` — a known blocking gap** (`AGENTS.md` §6.1). The corpus "never mentions" tax, despite specifying invoicing. This ADR decides the *representation*; it does not decide the *tax model*. `PC-003` must still be designed before fees, payroll or procurement are built. Tracked in `docs/core/SSOT.md` §5.2.

---

## Revisit when
- A school requires multi-currency invoicing (then FX gain/loss accounts enter scope — a new ADR).
- A jurisdiction mandates a specific rounding mode that cannot be expressed by a per-school setting.

---

*Indexed in `docs/adr/README.md` · Implements `ARC-06` · Spec: `AGENTS.md` §2.5, §2.6, §8 · Related: `PC-003` in `docs/core/SSOT.md` §5.2.*
