# Eleva.care v3 Organization And Clinic Model

Status: Authoritative

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

The platform decides explicitly how organizations appear publicly.

v3 decisions:

- individual expert listings at launch
- optional clinic listings behind a flag (phase 2)
- organization-branded booking flows (phase 2)

## Monetization Model (Locked — Hybrid)

Grounded in [Doctolib's EU health-marketplace precedent](https://businessmodelcanvastemplate.com/blogs/how-it-works/doctolib-how-it-works) (~€139/user/mo subscription, 85% subscription revenue, 340K+ practitioners) plus [MarketplaceBeat monetization guidance](https://marketplacebeat.com/articles/marketplace-monetization-models) and [Monetizely clinic SaaS research](https://www.getmonetizely.com/articles/which-pricing-metric-fits-clinics-saas-best-per-seat-per-transaction-or-per-outcome) (3+ tiers → 26% higher ARPA).

### Solo experts — commission-based

- default 15% platform fee per booking
- reduced to 8% on paid Top Expert tier (€29/mo) via Stripe Entitlements
- zero-cost entry; no forced subscription
- Eleva issues a per-booking platform-fee invoice (Tier 1, series `ELEVA-FEE-{YYYY}`)

### Clinics / Organizations — per-seat SaaS, no booking commission

Three tiers (Stripe Subscriptions + Stripe Tax PT/NIF, TOConline series `ELEVA-SAAS-{YYYY}`):

| Tier | Base | Per-seat | Seat range |
|---|---|---|---|
| Clinic Starter | €99/mo | €39/mo | 1–5 |
| Clinic Growth | €199/mo | €29/mo | 6–20 |
| Clinic Enterprise | custom | custom | 20+ |

Rules:

- clinic's Stripe Connect account receives **100%** of member bookings
- internal clinic↔expert distribution is the clinic's own bookkeeping (Eleva exposes data, doesn't automate)
- seat count auto-syncs when experts join/leave the clinic (`customer.subscription.updated`)
- overage behavior: Starter hard-capped at 5, Growth at 20, Enterprise unlimited
- billed via Stripe Subscriptions; invoice issued by Eleva via TOConline monthly

Add-ons (drive ARPA):

- AI report credit bundles
- premium Daily video minutes
- extra CRM seats
- SAF-T export automation

### Primary commercial entity: `clinic_subscription`

Replaces the three-party `clinic_memberships + commission_rule + application_fee_breakdown` model for the default clinic path:

```text
clinic_subscription(
  id,
  org_id,
  tier,                   -- 'starter' | 'growth' | 'enterprise'
  seat_count,
  active_expert_ids,      -- references to expert memberships
  stripe_subscription_id,
  status,                 -- 'active' | 'past_due' | 'canceled' | 'trialing'
  current_period_end
)
```

Seat management rules:

- expert added to clinic membership → seat count auto-incremented → Stripe quantity syncs
- expert removed / suspended → seat count auto-decremented
- downgrade with grace period (7 days) before proration

### Three-party revenue (phase-2 opt-in)

- gated behind `ff.three_party_revenue` (default off)
- shipped only for clinics that negotiate a commission overlay on top of SaaS
- entities `clinic_memberships`, `commission_rule`, `application_fee_breakdown` exist only for this flag path
- default clinic flow does not touch these entities

### Clinic → Expert invoicing — clinic's own bookkeeping

Not automated by Eleva. Eleva exposes booking + fee split data via exports and admin views. Clinics issue clinic↔expert invoices on their own systems. Revisiting requires a new ADR.

## Academy Compatibility

The organization model supports future education/academy contexts without introducing a second tenant system:

- reuse organization and membership foundations
- add academy-specific roles and capabilities later
- clinic SaaS tier model likely adapts to academy tier model (e.g. "Academy Pro" per-seat)

## Open Questions

- whether clinic public pages are M3 or phase 2
- whether org admins can see customer records across all experts by default (consent boundary question)
- Clinic Enterprise per-deal pricing framework
- when organization-owned collective/round-robin scheduling enters scope (currently phase 2)

## Related Docs

- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`payments-payouts-spec.md`](./payments-payouts-spec.md)
- [`feature-flag-rollout-plan.md`](./feature-flag-rollout-plan.md)
- [`academy-strategy-spec.md`](./academy-strategy-spec.md)
- [`domain-model.md`](./domain-model.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`adrs/README.md`](./adrs/README.md) (ADR-005 Payments & Monetization)
