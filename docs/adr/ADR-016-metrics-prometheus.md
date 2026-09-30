# ADR-016 — Metrics in Prometheus Exposition Format

**Status:** ✅ **Accepted 2026-09-30 (owner)**
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-J)
**Affects:** `PLT-902`, `PLT-901` · `AGENTS.md` §2.15
**Source:** Prompt Pack §2.1 (D-J) · `PLT-902` · NFR-02

---

## Context

`PLT-902` must export request latency, error rate and queue depth so that:

- NFR-02's attendance round-trip latency is observable, and
- an operator can see elevated error rates.

`PLT-902`'s acceptance criterion is specific: *"A dashboard exists showing p50/p95/p99 latency for at least the Attendance capture endpoint."*

Two constraints shape the decision:

1. **The attendance capture endpoint does not exist yet** — it arrives in a later milestone. So the instrumentation must be **general**, with a documented dashboard definition and a synthetic test route proving the pipeline works before there is real traffic to measure.
2. **The format determines what tooling can consume it.** Choosing a proprietary format means a school without that specific tool sees nothing, and the operator's alerting stack has to be rebuilt per deployment.

`AGENTS.md` §2.15 already standardises logging: structured JSON with correlation IDs, redaction, and dual sinks. Metrics must not contradict that — and must obey the same redaction rule, since a metric label can leak just as a log line can.

## Decision

**Expose metrics in Prometheus exposition format on a dedicated endpoint.**

- **Prometheus-compatible text format.** The de-facto standard, supported by Prometheus, Grafana, VictoriaMetrics, Datadog, CloudWatch and most hosted offerings. A school chooses its own collector without a code change.
- **Instrument generally**, with latency and error rate on all routes; the attendance capture route gets the documented dashboard definition when it exists, and a **synthetic test route** proves the pipeline in the meantime (`PLT-902`).
- **The endpoint is `@Public('<reason>')`** — it must be scrapable by infrastructure. The reason is recorded in the allowlist file per `AGENTS.md` §2.3. This is a concrete, legitimate use of the escape hatch: an authenticated metrics endpoint cannot be scraped by a collector, and inventing a permission key for it would be worse.
- **Redaction applies to labels**, exactly as it does to log lines (`AGENTS.md` §2.13). No `user_id`, email, student name or filename in a label — labels are an unbounded-cardinality and privacy hazard.
- **Cardinality is bounded by design.** No per-student, per-file or per-request-id labels. Route, method and status code only.
- `PLT-903`'s admin status widget shows DB, Redis, licence state and grace countdown, and last backup time — it reads the same health data, it does not reimplement it.

## Consequences

### Positive
- **Tool-agnostic.** A school scrapes into whatever it already runs. No per-deployment code.
- **The format is testable in CI** without a collector: the endpoint's output is a string that can be asserted on.
- Bounded cardinality prevents a metrics backend from being melted by a busy school, and prevents a privacy leak through labels.
- The synthetic route means the pipeline is proven before the real route exists, so `PLT-902` ships with working instrumentation rather than a promise of it.

### Negative / accepted costs
- **The endpoint is public on the network.** Mitigated by `@Public` being allowlisted with a reason, by binding it to an internal interface, and by exposing **no sensitive values** — which is why the label-redaction rule is not optional.
- **p50/p95/p99 are not directly exported** by the text format; they are computed by the collector from a histogram or summary. The Prompt Pack's p50/p95/p99 requirement is therefore satisfied by a *dashboard definition* plus histograms, and that is what the story's acceptance criterion should say.
- **Histogram bucket choices are permanent-ish** — changing them restarts the time series. Worth choosing carefully at `PLT-902`.
- Requires the school to run a collector. Small deployments may never look at it, which is why `PLT-903`'s admin widget exists as the no-infrastructure path.

### Neutral
- Metrics are for operators; the **correlation ID** remains the tool for tracing a single request across services (`PLT-501`). Metrics answer "is it slow", logs answer "why".
- Nothing here changes the log format, which stays structured JSON with dual sinks per `AGENTS.md` §2.15.

## Rejected alternatives

**❌ A proprietary/vendored metrics format.** Rejected: locks the school to one collector and requires code changes per deployment. Wrong for a product sold per-school, where each customer's monitoring stack differs.

**❌ Log-only observability, no metrics.** Rejected: logs can tell you a request was slow but cannot give you p95 across a population, nor an alertable error *rate*. NFR-02 asks for exactly that.

**❌ Metrics with rich labels (user, student, file).** Rejected: unbounded cardinality, which is the classic way a metrics backend falls over, and a privacy leak — a student identifier in a label persists in monitoring data with different retention and access than the audit trail.

**❌ Authenticate the metrics endpoint.** Rejected: an authenticated endpoint cannot be scraped by a standard collector without a credential the collector holds, which is a worse operational trade than a bounded, redacted, internal-network-only endpoint.

## Links
- `AGENTS.md` §2.3 (`@Public`), §2.13 (redaction), §2.15 (logging and diagnostics)
- `PLT-901`, `PLT-902`, `PLT-903` · Prompt Pack §2.1 (D-J), §6 P13, §7
- NFR-01, NFR-02 · `SRS` §5

## Revisit when
- A school mandates a specific monitoring platform with a required ingestion format. That is a collector configuration change, not a code change.
