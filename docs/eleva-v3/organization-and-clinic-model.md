# Eleva.care v3 Organization And Clinic Model

Status: Living

## Purpose

This document defines how organizations, clinics, and team-based work should fit into Eleva.care v3.

It should guide:

- tenancy modeling
- organization onboarding
- clinic/team support
- permissions and data boundaries
- future scale beyond solo experts

## Why This Matters

Eleva is not only a solo-expert marketplace.
It also needs to support:

- individual experts
- clinics
- organizations/teams
- future educational or academy contexts

If the organization model is weak, many later features become harder:

- seat billing
- team scheduling
- shared CRM visibility
- organization-level payouts
- internal admin controls

## Core Principle

Treat organizations as first-class platform entities from the start, even if many early users behave like single-user organizations.

## Organization Types

The model should allow types such as:

- patient personal organization
- expert personal organization
- clinic organization
- team/company organization
- future educational organization

These do not all need the same UX, but they should share a common structural foundation.

## Solo Expert Model

A solo expert should still operate inside an organization context, even if that organization effectively contains only them.

This is useful because it keeps the model aligned with future:

- team growth
- organization billing
- shared settings
- workspace switching

## Clinic Model

A clinic should be represented as an organization that may:

- have multiple expert memberships
- have organization admins
- own shared settings
- eventually own some booking, CRM, billing, and payout views

The platform does not need full clinic-grade scheduling on day one, but the data model should not block it.

## Organization Capabilities

The model should be able to support:

- member invitations
- role assignment
- seat tracking
- organization billing
- organization-wide configuration
- organization-specific expert visibility or marketplace behavior

## Data Boundaries

The system must clearly define what is:

- user-owned
- membership-scoped
- organization-owned
- shared by consent only

This is especially important for:

- customer relationships
- session data
- documents
- reports
- diary visibility

## Organization Admin Versus Expert

An organization admin may need to manage:

- memberships
- billing
- seat usage
- organization settings

An expert may need to manage:

- own schedule
- own sessions
- own CRM and reports

The model should not assume those are always the same person.

## Future Clinic/Team Scheduling

The initial model should leave room for:

- org-owned event templates
- clinic-managed schedules
- multi-expert routing
- team-level availability policies

These do not need to be fully implemented in MVP, but the organization structure should not prevent them.

## Organization And Marketplace Relationship

The platform should decide explicitly how organizations appear publicly.

Examples:

- only individual expert listings at first
- optional clinic listings later
- organization-branded booking flows later

## Organization And Billing Relationship

The model should support future:

- organization-owned subscriptions
- seat-based billing
- organization payout destinations
- organization-specific commercial terms

## Academy Compatibility

The organization model should also be able to support future education/academy contexts without introducing a second tenant system.

That means:

- reuse organization and membership foundations
- add academy-specific roles and capabilities later

## Open Questions

- exact organization type taxonomy
- whether clinic public pages are phase 1 or later
- whether org admins can see customer records across all experts by default
- when organization-owned scheduling enters scope

## Related Docs

- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`academy-strategy-spec.md`](./academy-strategy-spec.md)
- [`domain-model.md`](./domain-model.md)
