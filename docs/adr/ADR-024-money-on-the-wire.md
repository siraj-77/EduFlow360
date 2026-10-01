# ADR-024 — Money on the wire: decimal string plus a branded client type

**Status:** 🟢 **Accepted 2026-09-30 (owner)**
**Date:** 2026-09-30
**Deciders:** _owner_
**Affects:** `AGENTS.md` §2.5, §8 · `ADR-002` (amended) · `ARC-06` · `PLT-301` `PLT-302` · every endpoint that returns or accepts money
**Amends:** `ADR-002` — which decides the _representation_ and explicitly left the _boundary_ open.

> ⚠️ **How this was decided, stated plainly.** The owner approved option (C) after the agent
> recommended it, in one conversation. `SSOT.md` §4 already flags that pattern for earlier
> decisions and requires it to be recorded rather than presented as an independently weighed
> choice. It is repeated here so this ADR cannot be read as more considered than it was. The
> alternative that was rejected — `number` on the wire — is the one most likely to look
> attractive in a future review, because it is simpler and works until 2^53. **Revisit this
> ADR if `PLT-301`'s browser `BigInt` work turns out to be expensive**, because that is the one
> cost this decision accepts.

---

## Context

`packages/shared-types` **already ships** `Money`:

```ts
/** A money amount. Integer minor units + explicit currency. Never a float (ADR-002). */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: string;
}
```

`ADR-002` exists precisely to forbid float money. So the type is right — and
unusable. `bigint` does not survive JSON:

```console
$ node -e 'console.log(JSON.stringify({ amountMinor: 100n }))'
TypeError: Do not know how to serialize a BigInt
```

`JSON.stringify` throws rather than degrading. So **the first endpoint that
returns a `Money` — an invoice, a fee, a payment, a licence charge — has NestJS's
serialiser throw and the request 500s.** This is not hypothetical: `PLT-301` and
`PLT-302` are scheduled, and `PLT-302` is licence pricing, which is P3.

The failure is also _silent in review_. `Money` type-checks, its unit tests pass,
and `tsc` is happy. Nothing fails until a request is served, which is why the
defect survived every text-based gate in this repository — and it is worth
recording that `prisma-schema.spec.ts` has, separately, already failed to catch a
schema Prisma would not apply. **A type that parses is not a type that
serialises.**

Three constraints make the choice harder than "use a string":

1. **Currency is a per-school setting** (`AGENTS.md` §2.14), so minor-unit scale
   cannot be assumed. LKR is 2dp; KWD, BHD and JOD are 3dp.
2. `Number.MAX_SAFE_INTEGER` is 2^53−1. As a `number`, that caps a 2dp currency at
   roughly **90 trillion** and a 3dp one at roughly **9 billion**, and it loses
   minor units **silently** — no overflow, no error, just a wrong amount.
3. `ADR-002` forbids float money. A `number` on the wire reintroduces exactly
   that, one layer up, where the lint cannot see it.

## Decision

**Money crosses the wire as a decimal string. Clients read it through a branded
type that cannot be constructed from a bare `number`.**

```ts
/**
 * The wire form of an amount. A STRING, always - see ADR-024.
 *
 * Branded so that `1234 as unknown as MoneyMinor` is not a route to a wrong
 * amount: the only way to obtain one is `MoneyMinor.parse`, which validates.
 */
declare const MONEY_MINOR: unique symbol;
export type MoneyMinor = bigint & { readonly [MONEY_MINOR]: true };

/** Parses a wire amount. Rejects anything a minor-unit integer cannot express. */
export function MoneyMinor_parse(raw: string): MoneyMinor;
```

Three parts, each load-bearing:

| Part                    | Why                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **String on the wire**  | Exact for any magnitude `bigint` can hold, and JSON-legal. No `toString`/precision surprises at 3dp.                                                                     |
| **Branded type**        | A branded `MoneyMinor` cannot be assigned from a `number` or a `string` literal without going through `parse`. The unsafe path is a compile error, not a review comment. |
| **Validation on parse** | `parse` rejects non-integers, empty strings, and exponent notation (`1e3`), which would otherwise sneak a float-shaped value through the front door.                     |

**Server-side the domain type is unchanged.** `Money` with `amountMinor: bigint`
remains the representation everywhere inside the process, per `ADR-002`. The
conversion happens in exactly one place — the API's serialisation boundary — so
no domain or use-case code ever sees a string, and `AGENTS.md` §2.2's layering
is not breached by a type that belongs to no layer.

## Consequences

**Good**

- `PLT-301`, `PLT-302` and `ARC-06` stop being blocked. The first money endpoint works.
- The 3dp-currency hazard is closed by construction, not by convention: there is
  no path where a minor-unit amount passes through a double.
- A client cannot accidentally do arithmetic on the wire value, because it is not
  a `number` and the branded type will not accept one.

**Costs, stated plainly**

- Every client call site pays a `parse`. It returns `MoneyMinor` (`bigint`), so
  **browsers need a polyfill** — `bigint` is not universally available in the
  target matrix and `BigInt` literals are not transpilable by Babel without a
  plugin. This is a **web build-config decision that `PLT-101` must make**, and it
  is the one genuine downside of this option.
- `Money` and `MoneyMinor` are two types, and confusing them is possible. The
  mitigation is naming: `Money` is the domain value, `MoneyMinor` is the wire
  value, and the only conversion is at the boundary.
- Round-tripping through `JSON.parse` yields `string`, never `MoneyMinor`, so the
  branded type cannot come from `JSON.parse` directly. That is the intended
  friction.

**Follow-on**

- `ARC-06` implements `MoneyMinor` and the boundary serialiser, with a test that
  **fails when a school's currency exceeds 2 decimals**. That test is the real
  guard: without it, option (B) can creep back in one line.
- `PC-003` (tax and currency) is **still open** and is not answered here. This ADR
  decides how an amount crosses a network boundary; it says nothing about the tax
  model, exactly as `ADR-002` was careful to say.

## Rejected alternatives

**(A) String on the wire, unbranded.** Rejected: the string is `string`, so a
client can concatenate, compare and add it, and TypeScript permits all three.
That is the arithmetic `ADR-002` forbids, arriving by a different road.

**(B) `number` on the wire.** Rejected. Convenient, and _quietly wrong_ past
2^53: 3dp currencies fail around 9 billion minor units, 2dp around 90 trillion,
with no error. `ADR-002`'s prohibition would be reintroduced one layer up, in the
place where no lint rule looks. It is defensible **only** with a test that fails
when a currency exceeds 2dp, and because currency is a per-school setting that
test would have to be written per deployment — which is worse than not relying on
it at all.

**(C) Send minor units as a JSON number, with `bigint` serialized as a string
manually, per field.** Rejected: it makes the format a property of each endpoint,
so the first endpoint someone forgets becomes the first 500. A boundary
convention that is opt-in per call site is not a convention.

**(D) A dedicated money library (`dinero.js`, `big.js`, `decimal.js`).** Deferred,
not rejected. If the team later wants arithmetic on the client — currency
conversion, totals in a cart — a library is the right tool and this ADR is
compatible with it, because the branded type is the seam. It is not needed to
make `PLT-301` work, and adding a dependency before a requirement exists is the
`YAGNI` failure this repository already has a decision record for.

## Open sub-question

**Browser `bigint` support is a build-config question, not a representation one.**
`MoneyMinor` is a branded `bigint`, so the web app must ship a `BigInt`
polyfill, or `PLT-301` must decide the web client works in minor units as
`number` while asserting the safe range at runtime. **The owner has not chosen.**
Tracked with `PLT-301`; it does not block this ADR, because the _server_ boundary
is unaffected either way.

## Revisit when

- Multi-currency display or FX conversion moves to the client (then a money
  library, per rejected alternative D).
- A web target is adopted without `BigInt` support (then re-open the polyfill
  decision, not this ADR).

---

_Indexed in `docs/adr/README.md` · Implements `ARC-06` · Amends `ADR-002` · Spec: `AGENTS.md` §2.5, §2.8, §2.14 · Related: `PC-003` in `docs/core/SSOT.md` §5.2, `D-4.2` in `docs/work/TODO.md`._
