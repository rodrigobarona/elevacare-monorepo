# Eleva.care v3 ADR Index

Status: Living

## Purpose

This folder stores Architecture Decision Records for Eleva.care v3.

ADRs should capture:

- the context behind a major decision
- the chosen direction
- the alternatives that were considered
- the consequences of the decision

## How To Use ADRs

Write an ADR when the team makes a decision that would be expensive or confusing to reverse later.

Examples:

- app topology
- auth strategy
- RBAC model
- scheduling model
- payments/payouts model
- transcript and AI data handling
- mobile sync/share model

## ADR Status Values

- `Proposed`
- `Accepted`
- `Superseded`
- `Deprecated`

## Naming Convention

Use sequential files:

- `ADR-001-app-topology.md`
- `ADR-002-monorepo-strategy.md`
- `ADR-003-mobile-diary-integration.md`

## Current ADRs

- [`ADR-001-app-topology.md`](./ADR-001-app-topology.md)

## ADR Template

```md
# ADR-XXX: Decision Title

## Status
Accepted

## Date
YYYY-MM-DD

## Context
Why this decision matters and what constraints exist.

## Decision
What we decided.

## Alternatives Considered

### Option A
- Pros
- Cons

### Option B
- Pros
- Cons

## Consequences
- Positive consequence
- Tradeoff
- Operational implication
```
