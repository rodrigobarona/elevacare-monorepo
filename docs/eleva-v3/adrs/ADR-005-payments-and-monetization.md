# ADR-005: Payments, Monetization, and Stripe Integration

## Status

Accepted (UX subsection superseded by [ADR-016](ADR-016-subscription-ux-direction.md), 2026-05-18)

## Date

2026-04-22

## Context

Eleva needs a payments architecture that:

- supports PT/EU payment methods without code changes per country
- embeds natively in Eleva UI (no redirects, no popups)
- handles marketplace payouts to experts and clinics
- enforces plan gating for expert SaaS tier and clinic SaaS tiers
- monetizes solo experts via commission and clinics via SaaS (hybrid, segment-differentiated)
- leaves room for a phase-2 three-party revenue model for specific clinic deals

Grounded in [Doctolib's business model](https://businessmodelcanvastemplate.com/blogs/how-it-works/doctolib-how-it-works) (€139/user/mo subscription, 85% subscription revenue), [MarketplaceBeat monetization guide](https://marketplacebeat.com/articles/marketplace-monetization-models), and [Monetizely clinic SaaS pricing research](https://www.getmonetizely.com/articles/which-pricing-metric-fits-clinics-saas-best-per-seat-per-transaction-or-per-outcome).

## Decision

### Stripe technical architecture

- **Connect Express** accounts for experts and clinics
- Stripe API pinned **≥ 2023-08-16** → Dynamic Payment Methods on by default
- **Never hardcode `payment_method_types`** — methods auto-shown per country (PT gets MB WAY + card + wallets; EU gets SEPA/iDEAL/Bancontact per country). **Exception (carve-out introduced by [ADR-016](ADR-016-subscription-ux-direction.md), Accepted 2026-05-18)**: SaaS subscription Checkout Sessions (`mode: "subscription"`) MUST pin `payment_method_types: ["card", "sepa_debit"]` because MB WAY and Multibanco are one-time-only payment methods and cannot recur. Subscription Checkout is the only place `payment_method_types` may be hardcoded; booking PaymentIntents and booking Checkout Sessions continue to rely on Dynamic Payment Methods. This invariant is enforced in [`infra/stripe/seed-products.ts`](../../../infra/stripe/seed-products.ts).
- **Multibanco reference vouchers excluded** (7-day delay + voucher reminder complexity, MB WAY covers PT)
- **Single webhook endpoint** `/webhooks/stripe` per environment handles Payment + Subscriptions + Connect + Identity events; idempotency via Neon `stripe_webhook_events` (canonical table name; the ADR's original `stripe_event_log` proposal was renamed during Phase 1 implementation)
- Two accounts: `staging` + `production` (separate Connect platform, webhook, seed scripts)
- **Stripe Tax** configured for PT (NIF, no billing-address requirement)
- **Stripe Entitlements** for plan gating via `packages/flags`
- **Stripe Identity** embedded modal for expert KYC

### Stripe UX — superseded by ADR-016 (embedded + hosted redirects)

> **Superseded by [ADR-016](ADR-016-subscription-ux-direction.md) (Accepted 2026-05-18)** for SaaS subscription surfaces. ADR-016 keeps the embedded paradigm but adopts Stripe Embedded Checkout for subscription purchase and Stripe-hosted Customer Portal for subscription management, replacing the "Custom Eleva UI + Payment Element for subscription management" stance below. Patient booking checkout, Connect Embedded Components, Identity Embedded, the Appearance API mapping, and CSP allowances remain unchanged. ADR-016 also corrects the implicit assumption that MB WAY/Multibanco can be used for SaaS recurring billing — they cannot. **`payment_method_types` invariant**: this ADR's general rule against hardcoding `payment_method_types` (see Stripe technical architecture above) still applies everywhere _except_ subscription Checkout, where ADR-016 pins `["card", "sepa_debit"]` as the only allowed value.

- Payment Element for patient checkout
- Connect Embedded Components for expert: `<ConnectAccountOnboarding>`, `<ConnectPayouts>`, `<ConnectBalances>`, `<ConnectAccountManagement>`, `<ConnectDocuments>`, `<ConnectTaxSettings>`, `<ConnectNotificationBanner>`
- ~~Custom Eleva UI + Payment Element + Billing API for subscription management (expert Top Expert tier, clinic SaaS tiers) — no Customer Portal redirect~~ → see ADR-016: **Embedded Checkout for purchase + Customer Portal for management**, with multi-admin audit closed via `withAudit` on Portal session-mint correlated with webhook events.
- `appearance` API mapped to Eleva design tokens; dark-mode; locale via next-intl
- CSP allows `js.stripe.com`, `connect-js.stripe.com`, `*.stripe.com`, `billing.stripe.com` (added by ADR-016 for Portal redirect return flow)
- `AccountSession` tokens minted server-side per screen with precise permissions

### Monetization — segment-differentiated hybrid

**Solo experts** → 15% commission per booking, reduced to 8% on Top Expert tier (€29/mo, Stripe Entitlements-gated).

**Clinics / Orgs** → per-seat SaaS, **zero commission on member bookings**:

- Starter: €99/mo + €39/seat (1–5 seats)
- Growth: €199/mo + €29/seat (6–20 seats)
- Enterprise: custom (20+ seats, SLA, CSM)

Clinic Connect receives 100% of member bookings; internal distribution is clinic bookkeeping.

### Three-party revenue — phase-2 opt-in

Demoted behind `ff.three_party_revenue` (default off). Shipped only when a specific clinic negotiates a commission overlay on top of SaaS. Entities `clinic_memberships`, `commission_rule`, `application_fee_breakdown` exist only for this flag path.

## Alternatives Considered

### Payment methods — hardcoded per-country logic

- Pros: explicit
- Cons: every new method = code release; fragile in marketplace with EU/global supply

### UX — Stripe-hosted pages + Customer Portal

- Pros: less code
- Cons: redirects kill flow, off-brand, no design token integration, breaks the "feels native" product vision

### Monetization — pure 15% commission for everyone including clinics

- Pros: simplest to implement
- Cons: clinics will push back at 15% of GMV (validated by Doctolib migration to subscription-first); regulatorily fragile; creates three-party complexity for every clinic booking

### Monetization — pure subscription for everyone including solo experts

- Pros: predictable
- Cons: blocks solo-expert entry (most experts won't pay before earning anything); Intro.co/Fiverr/Superpeer validate commission-first for solo supply

### Monetization — hybrid (chosen)

- Pros: solo experts get zero-cost entry and pay for value; clinics get predictable, cheap-at-scale, EU-regulatorily-safe SaaS; maps cleanly to Doctolib's validated pattern
- Cons: two commercial flows to maintain

## Consequences

- `packages/billing` is large: Embedded Components wrappers, AccountSession minting, single webhook dispatcher, commission logic, subscription lifecycle for both expert and clinic tiers
- Clinic bookings route cleanly to clinic Connect account (single-leg Transfer); three-party complexity only exists when the flag is on
- Entitlement bridge: Stripe Entitlements are the source of truth, `packages/flags` reads them to gate features
- Webhook code is cleaner (one endpoint, one dispatcher, one idempotency table)
- `payment_method_types` is never in our code → a dashboard toggle enables new methods (e.g. iDEAL for NL expansion) with zero deploy
