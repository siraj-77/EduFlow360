# ADR-011 — Instance Fingerprint: Stable Install ID, Not MAC Address

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-E)
**Affects:** `PLT-303`, `PLT-304` · `AGENTS.md` §2.1
**Source:** Prompt Pack §2.1 (D-E)

---

## Context

`PLT-303` sends a **hardware footprint** with an activation request, and `PLT-304` binds an offline request token to the same footprint. The intent is that a certificate is tied to the deployment it was issued for, so copying a `.lic` file to another school does not work.

Master Plan §4.1 implies MAC address. **`PLT-303`'s own task text says "server MAC hash"**, and Prompt Pack §2.1 (D-E) exists specifically because that is wrong.

`AGENTS.md` §2.1 fixes the deployment model: **one application instance per school**, and `OPS-06` provisions that deployment as a container. A container is the normal case.

MAC addresses are unstable in exactly that environment:

- Containers get a **new MAC on every restart** unless the network is pinned.
- Kubernetes pod MACs change on rescheduling; serverless invocations have synthetic ones.
- A VM migration changes them.
- `docker compose up` after a host reboot can hand out a different address.
- Many virtualised NICs report an all-zero or locally-administered address.

Any of these and the school's licence no longer matches, so activation re-prompts or — worse — the app reports itself unlicensed. **The fingerprint must survive a reboot without anyone noticing.** A licence mechanism that breaks on a routine infrastructure restart is a support burden, not a security control.

## Decision

**Use a stable install ID, generated once at first boot and stored in the database. Add an optional host hash as a secondary signal. Do not use MAC address as the binding.**

- **Install ID:** a random identifier generated on first start and persisted. It is a *deployment* identifier, not a *hardware* identifier — which is the correct concept, because ADR-003 says the unit of deployment is the school, not the machine.
- **Host hash:** optional, derived from stable host properties where available. A **secondary signal**, never the sole binding — it is the part most likely to change.
- **Binding is advisory plus detection, not a hard lock.** A mismatch is **reported and logged**, and prompts re-activation. It does not brick a school mid-term because a VM was rescheduled.

## Consequences

### Positive
- **Survives restarts, rescheduling and migrations** — the property that actually matters.
- Matches the deployment model: the unit is the school deployment, so the identifier should identify the deployment.
- Reproducible: a restore-from-backup of the database restores the same install ID, so a recovered server re-validates cleanly.
- No privileged hardware access needed to read it, which matters in containers.

### Negative / accepted costs
- **Weaker than hardware binding.** An install ID in a database can be copied by anyone with database access. Combined with the private key staying on the activation server (ADR-010), an attacker still cannot mint a certificate — they can only replay one, and replay is detected by the install-ID comparison and by the family's logs.
- **A database restore to different hardware does not trip the check**, because the ID travels with the backup. Accepted: a restore is a legitimate operation, and treating it as suspicious would punish disaster recovery.
- Advisory rather than enforced means the signal is not a hard control. That is a deliberate trade of enforcement strength for availability, and it is correct for a system a school depends on daily.

### Neutral
- `PLT-304`'s offline request token embeds the install ID, so an air-gapped school still gets a bound token.
- Nothing here changes certificate contents beyond what Master Plan §4.2 already specifies.

## Rejected alternatives

**❌ MAC address hash (as `PLT-303` currently says).** Rejected: unstable across container restarts and VM migration. This is the specific defect D-E exists to correct, and `PLT-303`'s task text should be amended to match.

**❌ CPU serial / motherboard UUID.** Rejected: not present or not readable in many virtualised and containerised environments, and requires privileges a container often lacks.

**❌ Hostname.** Rejected: trivially editable, and not unique in any meaningful sense.

**❌ No fingerprint at all.** Rejected: then a certificate is a bearer artefact and can be replayed to any deployment undetected. The install ID is a cheap improvement over nothing, even if advisory.

**❌ Hard lock on mismatch.** Rejected: a school mid-term losing access because a hypervisor changed a MAC address is a worse outcome than a copied certificate, which cannot mint new entitlements anyway.

## Links
- `AGENTS.md` §2.1 (per-school deployment) · Master Plan §4.1, §4.2
- `PLT-303`, `PLT-304` · Prompt Pack §2.1 (D-E), §6 P8
- `docs/adr/ADR-010-activation-server-external-boundary.md`

## Revisit when
- A school requires hard hardware binding for compliance. Then the school is not container-based, and hardware attributes become stable — revisit with that precondition stated.
