# ADR-011: Observability And Incident Response

## Status

Accepted

## Date

2026-04-22

## Context

Eleva runs payments, health-adjacent data, and a marketplace. Observability must give us:

- fast error triage (Sentry)
- structured logs and uptime + status page (BetterStack)
- correlation across webhook → workflow → notification → audit
- redaction of PHI from logs and error payloads

## Decision

- **Sentry** (EU region) — error tracking + performance tracing. Correlation ID, org ID, user ID, booking/session ID as tags.
- **BetterStack** (EU region) — structured log aggregation, uptime heartbeats for durable workflows, status page, on-call rotation.
- **Correlation ID** generated at every entry point (webhook intake, internal action, scheduled trigger) and propagated via `AsyncLocalStorage` through every step.
- **Audit stream** (`eleva_v3_audit` Neon project) records every mutating action with correlation ID.
- **Redaction policy** enforced in logging/error layers: never emit session note bodies, transcript content, AI prompt bodies, card numbers, or patient PHI. Email, name, and IDs are allowed with tenant tags.
- `/admin/audit` and `/admin/workflows` expose correlation-ID-filtered views.

## Alternatives Considered

### Option A — Datadog

- Pros: comprehensive
- Cons: expensive, US-centric

### Option B — Grafana Cloud + Loki

- Pros: open ecosystem
- Cons: more integration work, less integrated error-vs-log story

### Option C — Sentry + BetterStack (chosen)

- Pros: best-of-breed for each role, EU regions, small vendor footprint, clear boundaries
- Cons: two vendors to manage (but with clear responsibility split)

## Consequences

- `packages/observability` wraps both SDKs with consistent tag propagation and redaction helpers
- Every mutating server action wrapped in `withAudit(action, entity, fn)` which writes to the audit project
- Forced errors in staging produce a verifiable Sentry entry with the correct correlation ID
- BetterStack heartbeats are emitted by every durable workflow (ADR-007)
- On-call rotation defined before production launch
- Status page publicly reachable (subdomain decided before launch)
