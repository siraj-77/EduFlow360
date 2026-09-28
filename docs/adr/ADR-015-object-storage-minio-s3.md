# ADR-015 — Object Storage: S3-Compatible Behind `IStorageAdapter`, MinIO in Dev

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-I)
**Affects:** `PLT-801`, `PLT-802` · `AGENTS.md` §2.2
**Source:** Prompt Pack §2.1 (D-I) · Master Plan §2.1 (Object Storage row)

---

## Context

Every school stores files: student ID photos, homework submissions, generated certificates and report cards, receipts, hall-hire agreements, facility inspection records, HR contracts, alumni material, event media.

`AGENTS.md` §2.9 makes a **Document/Print engine** the single pipeline for every generated document, and §2.2 requires every `IStorageAdapter` consumer to sit behind a port.

The security requirement is sharper than "upload a file". `AGENTS.md` §2.13 and Master Plan §27 require that recorded video-class content and homework files inherit the same encryption-at-rest and role-gated access rules as other student records, defaulting to teacher/student/parent visibility and never public. **A public bucket makes every one of those controls decorative** — a signed-out holder of a URL reads the file regardless of what the application decides.

## Decision

**All object storage is S3-compatible, behind `IStorageAdapter`. MinIO locally; any S3-compatible provider in production.**

- **No module imports an S3 SDK directly.** Enforced by an ESLint rule, not convention (`PLT-801`).
- **Private buckets only.** No public-read objects, ever. Retrieval is via **signed, time-limited URLs** (`AGENTS.md` §2.2).
- **File-scope tagging** — `student-document`, `homework-submission`, `id-photo`, `receipt`, … — so retention policy and access rules apply per scope rather than per bucket.
- **`IFileAccessPolicy` reuses RBAC and ownership.** A homework submission is readable by the submitting student, their teacher and their guardian. **Nothing else.** Until the Academic module exists, the policies are built **against fakes** (`PLT-801`), because ownership facts are the later module's concern.
- **Malware scanning is a port with a no-op adapter**, invoked on upload. Real content comes later; the *seam* exists now so no module assumes scanning is inline.
- **Per-scope max size and allowed MIME types, validated by content sniffing, not just file extension** (`PLT-802`). Rejection happens **before** any storage write.
- **Per-school storage quota** reads the licence `limits` (Master Plan §4.2). ADR-003 means one school per database, so quota is a per-deployment concern and needs no cross-tenant machinery.

## Consequences

### Positive
- **Swappable provider.** AWS S3, Cloudflare R2 or MinIO without touching domain or use-case code (`AGENTS.md` §2.2, SOLID-L).
- **Role-gated access is actually enforced** — private buckets plus signed URLs, not an application-level check in front of a public object.
- **Retention is policy-driven by scope**, so a homework submission can be purged on a different schedule from an ID photo.
- **MinIO locally means the real API is exercised in development and CI**, not a mock that behaves nothing like S3.
- The **malware-scan seam** exists before anything needs it, so no module builds its own.

### Negative / accepted costs
- **Another service in the compose file.** Real cost; the payoff is that development matches production.
- **Content sniffing is more work than extension checks** and needs a small file-header library. A `.exe` renamed to `.jpg` is the case this prevents, and for student photo uploads that is a real concern.
- **Signed URLs are a capability, so their lifetime matters.** A too-long expiry is a soft public link. Short, scoped, and audited.
- **`IFileAccessPolicy` is blocked on entities that do not exist yet.** It ships with fakes. The real policies arrive with Academic — which means the policy code is written twice, once against fakes. Accepted, because inventing `Student`/`Class` in Platform Core is explicitly forbidden (Prompt Pack §2.2, §9).
- **MinIO in CI costs container startup time** on every integration run.

### Neutral
- Encryption at rest is the provider's responsibility, configured per deployment. The app's obligation is that it is **enabled** and that buckets are private.
- Video-class recordings (milestone 2+) inherit the same rules; Master Plan §27 adds default-visibility and consent conditions on top.

## Rejected alternatives

**❌ Store files in PostgreSQL as `bytea`.** Rejected: the Document/Print engine produces large PDFs and video recordings; database bloat, backup size and memory pressure on reads all follow. Files belong in object storage, metadata in the database.

**❌ Direct S3 SDK calls from each module.** Rejected: the exact thing `AGENTS.md` §2.2 forbids. It also means a provider change touches every module, and the access policy is implemented inconsistently per module.

**❌ Public buckets with unguessable URLs.** Rejected: security by obscurity. Unguessability is not an access control, and a leaked URL is permanent. `AGENTS.md` §2.13 requires role-gated access, which an application check cannot enforce on a public object.

**❌ Use a hosted provider directly with no local S3-compatible option.** Rejected: CI would need real credentials and would make tests network-dependent.

**❌ Scan uploads inline and synchronously.** Rejected: latency on every upload, and a scanner outage would block all uploads. The port plus no-op adapter defers the choice without precluding it.

## Links
- `AGENTS.md` §2.2 (ports), §2.9 (one document engine), §2.13 (privacy, encryption, role-gated access)
- `PLT-801`, `PLT-802` · Prompt Pack §2.1 (D-I), §6 P11, §7
- Master Plan §2.1, §4.2 (licence limits), §27 · `SRS` §3.9

## Revisit when
- A school requires data residency in a specific jurisdiction — that is a provider and region configuration decision, behind this port.
- Malware scanning becomes mandatory by regulation. Implement the existing port; no redesign.
