# Eleva.care v3 Owner Map

Status: Living

## Purpose

This document defines the ownership model for Eleva v3.

It is intentionally role-based first. Names can be filled in as the team forms.

## Why This Exists

The handbook is only useful if key areas have clear owners.

Ownership is needed for:

- decisions
- roadmap execution
- incident response
- documentation maintenance
- approval paths

## Ownership Principles

- Every core workstream should have one primary owner.
- Shared ownership is fine, but one role must be the final driver.
- Handbook docs should have explicit stewards.
- Operational escalation should map to these owners.

## Workstream Owners

### Platform foundation

- Primary owner: platform/architecture lead
- Scope: monorepo, packages, CI, env/config, repo foundations

### Identity and RBAC

- Primary owner: auth/platform lead
- Scope: WorkOS, organizations, memberships, RBAC, session model

### Marketplace and discovery

- Primary owner: product/frontend lead
- Scope: public web, search, profiles, SEO-facing discovery

### Scheduling and booking

- Primary owner: scheduling/domain lead
- Scope: event types, availability, reservations, booking state

### Billing and payouts

- Primary owner: billing/domain lead
- Scope: Stripe integration, subscriptions, packs, payouts

### Patient experience

- Primary owner: product/application lead
- Scope: patient dashboard, documents, reports, customer-facing product flow

### Expert operations and CRM

- Primary owner: expert workflow/product lead
- Scope: CRM, notes, follow-up tasks, relationship workflows

### Video and AI

- Primary owner: AI/integrations lead
- Scope: Daily, transcript pipeline, AI draft/report pipeline

### Compliance and data governance

- Primary owner: compliance/security lead
- Scope: consent, retention, visibility rules, audit posture

### Observability and operations

- Primary owner: ops/platform lead
- Scope: logging, monitoring, runbooks, uptime, alerts

### Mobile

- Primary owner: mobile/product lead
- Scope: Eleva Diary integration, sync/share model, mobile releases

### Brand and design system

- Primary owner: design lead
- Scope: brand-book, `packages/ui`, tokens, design-system governance

## Documentation Owners

Recommended owner groups:

- Architecture docs: platform/architecture lead
- Product system specs: respective domain owner
- Brand docs: design/brand owner
- ADRs: architecture lead with contributors
- Runbooks/playbooks: operations owner plus the relevant domain owner

## Approval Hotspots

These areas should require explicit owner review:

- auth model changes
- schema/migration changes
- payment and payout logic
- transcript/AI visibility logic
- launch readiness
- security-sensitive changes

## Related Docs

- [`dependency-map.md`](./dependency-map.md)
- [`support-escalation-matrix.md`](./support-escalation-matrix.md)
- [`contribution-workflow.md`](./contribution-workflow.md)
