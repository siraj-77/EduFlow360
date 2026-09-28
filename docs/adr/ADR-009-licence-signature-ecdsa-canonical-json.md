# ADR-009 — Licence Signature: ECDSA P-256 over Canonical JSON

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-C)
**Affects:** `PLT-301`, `PLT-303`, `PLT-304` · `AGENTS.md` §2.3
**Source:** Prompt Pack §2.1 (D-C), §6 P8 · Master Plan §4.2

---

## Context

A school's licence is a signed certificate that determines which modules and limits are available. It is the only thing standing between a Basic edition and a Deluxe feature set (`AGENTS.md` §2.3), so a forged or altered certificate is a licence bypass.

Master Plan §4.2 specifies the **payload** (edition, `school_id`, `allowed_modules`, `limits`, `features`, expiry) and §4.1 the flow (`License Key → Activation Server → Signed Certificate → Local Validator → Feature Entitlements Enforcer`).

The payload is JSON. **A signature over non-canonical JSON is not a signature over content — it is a signature over one particular byte sequence.** `{"a":1,"b":2}` and `{"b":2,"a":1}` are semantically identical but byte-different. If the verifier re-serialises before checking, or if key order, whitespace, number formatting or unicode escaping differ between the signer's and the verifier's serialiser, the check either fails on valid licences or — far worse — a caller can be handed a *re-serialised* payload that verifies while carrying different semantics than the one that was signed.

## Decision

**Sign with ECDSA P-256 + SHA-256 over a canonical, deterministic serialisation of the payload.**

- **Canonicalisation is a specified, versioned function**, not "whatever the serialiser does". It fixes: key ordering, no insignificant whitespace, a defined number format, and a defined unicode-escaping policy. The canonicalisation version is part of the signed material, so it can be changed later without invalidating historical certificates.
- **The public key is embedded in the build.** The private key exists **only** on the activation server.
- **Payload shape is validated with a schema** (Zod, from Master Plan §4.2) *before* the signature is checked, so a malformed certificate fails with a schema error rather than a signature error.

### Two mandatory tests

1. **Reordering keys does not break a valid signature.** Proves canonicalisation is genuinely canonical. Without this, a school can be locked out by a serialiser difference they cannot debug.
2. **Flipping any single byte breaks it.** Proves the signature is content-bound, not structure-bound.

A third, from §2.1: **expired is distinguishable from invalid.** They are different administrative states with different remedies, so a tampered certificate and an expired one must never produce the same error.

### Security constraints

- **The private signing key never enters this repository, tests included.** Test setup generates throwaway keypairs at runtime.
- On a tampered certificate, the system enters **locked maintenance mode** — activation and health endpoints only. Never a crash, never a silent bypass.
- No edition name is hard-coded in a guard. Gating is by **feature key** from the certificate (`features` map, Master Plan §4.2), so a new edition needs no guard change.
- `PLT-301` may persist the last-seen time and detect **system-clock rollback**, so extending a licence by rewinding the clock is not possible. Proposed for the plan, not decided here.

## Consequences

### Positive
- Content-bound signature: any change to any field invalidates it.
- Deterministic verification — the same certificate always verifies the same way, on any machine, forever.
- Historical certificates remain valid because the canonicalisation version is inside the signed material.
- A tamper is unambiguous: it is either a schema error, an invalid signature, or expired — three distinct, separately actionable states.

### Negative / accepted costs
- **A canonicalisation function is real work** and is a permanent compatibility surface. It must be specified precisely, versioned, and frozen once certificates are issued in the field.
- ECDSA signatures are **non-deterministic**: signing the same payload twice yields different signatures. Only *verification* needs determinism, so this is acceptable — but it means certificates cannot be compared by signature to detect identical content.
- Key rotation requires supporting a second public key during the overlap. A `key_id` in the signed material handles this.

### Neutral
- RSA-2048 (Master Plan §4.1) also works. P-256 is chosen for smaller keys and certificates, which matters little at this scale — see Rejected.
- Clock-rollback detection is proposed but not decided; it belongs to a follow-up.

## Rejected alternatives

**❌ RSA-2048.** Rejected only on key/certificate size and modern implementation practice. `AGENTS.md` §2.1 / Master Plan §4.1 permit either. **This is the weakest of the alternatives** — if a signing service already exists issuing RSA, use RSA and skip this ADR.

**❌ Sign the JSON string as-is, with no canonicalisation.** Rejected: the verifier and signer must agree byte-for-byte, forever, across language and library changes. Any drift between the activation server's serialiser and the app's breaks valid licences — and the failure looks like a bug, not a design flaw.

**❌ Sign a hash of a specific serialisation but verify by re-serialising.** Rejected: this is the failure mode above, dressed up. Verification must use the *same* canonical function that signed, not a fresh serialisation.

**❌ HMAC with a shared secret.** Rejected: symmetric. Every school deployment would hold the signing key, so one compromised deployment could mint licences for all of them. This directly contradicts the per-school deployment model in ADR-003.

**❌ Verify the licence against the activation server on every request.** Rejected: makes the app unavailable when the server is, which `PLT-305`'s grace period exists to avoid. Verification is local against an embedded public key.

## Links
- `AGENTS.md` §2.3, §7 · Master Plan §4.1, §4.2, §4.3
- `PLT-301`, `PLT-302`, `PLT-303`, `PLT-304`, `PLT-305` · Prompt Pack §6 P8, §7
- `docs/adr/ADR-006-licensing-ships-in-milestone-1.md`

## Revisit when
- A signing service already exists and issues RSA — use RSA; supersede this ADR rather than fight it.
- Multiple public keys are needed (rotation overlap) — add `key_id`, do not change the scheme.
