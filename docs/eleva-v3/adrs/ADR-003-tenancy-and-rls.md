# ADR-003: Tenancy Isolation — Neon RLS with `withOrgContext()`

## Status

Accepted

## Date

2026-04-22

## Context

Eleva is a multi-tenant marketplace with strict isolation needs between organizations (clinics, solo-expert orgs, patient orgs). A cross-tenant data leak in a health context is catastrophic — ERS, GDPR, and trust consequences.

We need tenancy isolation that is defense-in-depth: RBAC at the app layer plus physical row-level isolation at the DB layer.

## Decision

- **Neon Postgres** with Row-Level Security (RLS) on every tenant-scoped table.
- Enforcement via **`withOrgContext()`** helper in `packages/db`. Every query runs inside `withOrgContext(orgId, fn)`, which opens a transaction, runs `SET LOCAL eleva.org_id = '...'`, then executes `fn`.
- RLS policies on tenant-scoped tables check `current_setting('eleva.org_id', true) = org_id::text`.
- **Two Neon projects**:
  - `eleva_v3_main` — application data
  - `eleva_v3_audit` — immutable audit stream (append-only, separate policies)

## Alternatives Considered

### Option A — App-layer tenancy only (pass `orgId` everywhere)

- Pros: simpler DB model
- Cons: one missing `where org_id = ?` = cross-tenant leak. Unacceptable for health data.

### Option B — Database-per-tenant

- Pros: maximum isolation
- Cons: operationally prohibitive at marketplace scale; migrations multiply; cost explodes

### Option C — Neon RLS + withOrgContext (chosen)

- Pros: defense-in-depth, policy-enforced, auditable, scales linearly
- Cons: more query-discipline overhead; requires integration test that asserts isolation

## Consequences

- Every `db.select(...)` etc. must pass through `withOrgContext`. Lint + code review enforces.
- Integration test inserts as org A, selects as org B, must return zero rows.
- Cross-org admin queries use a separate `withPlatformAdminContext()` with explicit auditing.
- Audit stream writes go to the `eleva_v3_audit` project via a parallel connection with its own policies (append-only, no updates).
- Performance: RLS adds a small overhead; indexes on `(org_id, …)` are mandatory on tenant tables.
