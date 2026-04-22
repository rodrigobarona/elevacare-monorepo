# Eleva.care v3 Testing Strategy

Status: Living

## Purpose

This document defines the testing strategy for Eleva.care v3.

It should guide:

- what kinds of tests the team writes
- what should be validated at each layer
- how to prioritize testing effort for a high-trust platform

## Testing Principles

- Test the highest-risk workflows first.
- Prefer targeted, maintainable tests over noisy coverage.
- Use the right test type for the risk.
- Architecture and contracts should be testable by design.
- Critical user journeys need both automated and manual verification.

## Testing Layers

### Unit tests

Use for:

- pure domain logic
- utility logic
- validation rules
- fee/commission calculations
- scheduling rule calculations

### Integration tests

Use for:

- service-layer workflows
- DB-backed logic
- authorization-sensitive queries
- booking/payment state transitions

### Workflow/integration simulation tests

Use for:

- webhook processing
- reminder pipelines
- transcript -> AI -> review flows
- payout-related orchestration

### End-to-end tests

Use for:

- launch-critical user journeys
- onboarding
- booking
- payment success paths
- patient/expert dashboard basics

### Manual QA

Use for:

- visual review
- final launch validation
- provider-integrated flows that are hard to fully simulate

## Priority Areas

The highest-value tests should cover:

- authentication and RBAC
- booking and slot reservation conflicts
- payment success/failure handling
- payout eligibility and approval logic
- calendar integration basics
- reminder scheduling
- transcript and AI report flow
- diary sharing visibility rules

## What Not To Over-Test

Avoid low-value tests that:

- restate framework behavior
- snapshot massive UI trees with little signal
- test implementation details instead of outcomes

## Contract Testing

Because Eleva is becoming more multi-surface, contract correctness matters.

The team should validate:

- API input/output schemas
- mobile-safe payloads
- workflow payload shapes
- provider webhook normalization

## Authorization Testing

The team should explicitly test:

- unauthenticated access rejection
- wrong-role access rejection
- organization-context enforcement
- sensitive-data visibility rules

## Data And Compliance Testing

The team should validate:

- visibility boundaries
- consent-gated actions
- audit event creation for critical flows
- export/delete paths as they are implemented

## Environment Validation

Before launch, the team should also run:

- staging smoke tests
- key integration sanity checks
- production-safe launch verification steps

## Recommended Tooling Direction

The exact tools can evolve, but the strategy should support:

- fast unit/integration feedback
- browser E2E for key flows
- realistic integration testing for webhooks and workflows

## Exit Criteria For Major Features

For any launch-critical feature, the team should be able to show:

- the intended behavior is specified
- the highest-risk logic is covered by targeted tests
- the end-to-end path is validated
- failure behavior is understood

## Related Docs

- [`api-contract-spec.md`](./api-contract-spec.md)
- [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`security-hardening-checklist.md`](./security-hardening-checklist.md)
