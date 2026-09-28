# ADR-010 — Activation Server Is an External Vendor Service

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-D)
**Affects:** `PLT-303`, `PLT-304`, `PLT-305` · `AGENTS.md` §2.2
**Source:** Prompt Pack §2.1 (D-D)

> **This ADR answers Open Question ⚑6** in `docs/core/SSOT.md` §7 — "Activation server: in this repo, or a separate service? Where do the keypairs live?"

---

## Context

`PLT-303` activates a licence **online**: the school submits a serial key plus a hardware footprint, and an activation server returns a signed certificate. `PLT-304` is the offline equivalent, via a `.lic` file.

Two things must never be in the same trust boundary:

1. **The private signing key.** Whoever holds it can mint a licence for any school, with any edition and any limits. It must be under the vendor's control, not the customer's.
2. **Serial-key issuance and validation.** That is a commercial and support function — issuing keys, checking them against a database, handling a customer's renewal.

Meanwhile ADR-003 fixes the deployment model: **one application deployment and one database per school.** A school's own box holds customer data about its students and staff. Putting a private signing key on it would be indefensible.

There is also a testing problem. `PLT-303` and `PLT-305` both call the activation server. Tests cannot depend on a live third-party service — that makes unit tests non-hermetic, integration tests flaky, and CI dependent on someone else's uptime.

## Decision

**The activation server is a separate vendor service and is NOT part of this repository.**

- The school-side app defines a port, `ILicenceActivationClient`, and nothing else. `AGENTS.md` §2.2: *never call a vendor SDK from a use-case or domain file.*
- An **OpenAPI contract** is the integration boundary. Generated client, not a hand-written one.
- A **local fake activation server** runs in development and in tests. It issues certificates signed by a throwaway keypair generated at test-setup time — never a real key (ADR-009).
- The **private key lives only on the activation server**. The school-side app embeds the public key.
- `LICENSE_PUBLIC_KEY_PATH` (`AGENTS.md` §11) points at the public key. The matching private key has no path in this repo, because it has no place in this repo.

### Boundary sketch

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ School deployment (this repo)│        │ Activation server (separate) │
│                              │        │                              │
│  ILicenceActivationClient   │──HTTP──▶  serial key validation       │
│  ├─ activate()              │        │  certificate issuance        │
│  └─ revalidate()            │        │  PRIVATE KEY (here only)     │
│                              │        │                              │
│  local validator            │◀─────── │  signed certificate           │
│  └─ embedded PUBLIC key     │        │                              │
│  (locked mode if invalid)   │        │                              │
└─────────────────────────────┘        └──────────────────────────────┘
      offline path (PLT-304): request token out → .lic file in
      → identical local validation
```

## Consequences

### Positive
- **The private key is never near customer data.** It sits in the vendor's boundary, under vendor controls. This is the whole point.
- **Tests are hermetic.** A fake local server means `PLT-303`/`PLT-305` test deterministically, with no network, and with keypairs generated per run.
- **The school-side app has no commercial logic.** Serial-key checks, renewals and support belong to the vendor service.
- The OpenAPI contract makes the integration explicit and reviewable rather than implied by shared code.
- `PLT-304` and `PLT-305` have a clean story: the app is designed to work when the server is unreachable, because it was never coupled to it.

### Negative / accepted costs
- **A network dependency for activation.** Mitigated by `PLT-304` (offline, air-gapped) and `PLT-305` (14-day grace period). These are not workarounds for the design; they are required by the per-school, sometimes-offline deployment reality.
- **The OpenAPI contract must be maintained in step** with the fake server and the real one. Drift shows up as a failing contract test, which is the point.
- **A second deployable to operate** (the activation server), outside this repository. Its own repo, its own reviews.

### Neutral
- The local validator and its embedded public key are unaffected — they are in this repo, because verification must work offline.
- `PLT-305`'s background revalidation job is the only recurring outbound call.

## Rejected alternatives

**❌ Activation server in this repository.** Rejected: it puts the private signing key in the same codebase and, in a shared deployment, potentially the same box as customer data. It also merges a commercial system with a product, so a change to serial-key logic ships to every school. It also makes tests depend on real infrastructure.

**❌ Call the activation server directly from a use-case, no port.** Rejected: violates `AGENTS.md` §2.2. The vendor SDK/HTTP client would leak into the domain layer, and swapping vendors — or substituting the fake in tests — would become a code change rather than a DI swap.

**❌ No server at all — ship keys and verify signatures locally only.** Rejected: that is offline-only activation, which breaks `PLT-303` and leaves nothing to revoke or reissue centrally. It also means the private key must be distributed to every customer.

**❌ Embed the private key for self-hosted licence generation.** Rejected: any customer with the private key can mint a Deluxe certificate for a Basic school. It destroys the entire entitlement model.

## Links
- `AGENTS.md` §2.2 (ports and adapters), §2.3, §11 (`LICENSE_PUBLIC_KEY_PATH`)
- `PLT-301`, `PLT-303`, `PLT-304`, `PLT-305` · Prompt Pack §6 P8, §7
- `docs/adr/ADR-009-licence-signature-ecdsa-canonical-json.md`, `ADR-006-licensing-ships-in-milestone-1.md`
- `docs/core/SSOT.md` §7 (⚑6 answered)

## Revisit when
- A school requires fully air-gapped activation as the *only* path. `PLT-304` already covers this; no change.
- The activation server's API changes shape. Update the OpenAPI contract and regenerate — do not bypass the port.
