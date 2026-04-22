# ADR-005: Payments, Monetization, and Stripe Integration

## Status

Accepted

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
- **Never hardcode `payment_method_types`** — methods auto-shown per country (PT gets MB WAY + card + wallets; EU gets SEPA/iDEAL/Bancontact per country)
- **Multibanco reference vouchers excluded** (7-day delay + voucher reminder complexity, MB WAY covers PT)
- **Single webhook endpoint** `/api/stripe/webhook` per environment handles Payment + Subscriptions + Connect + Identity events; idempotency via Neon `stripe_event_log`
- Two accounts: `staging` + `production` (separate Connect platform, webhook, seed scripts)
- **Stripe Tax** configured for PT (NIF, no billing-address requirement)
- **Stripe Entitlements** for plan gating via `packages/flags`
- **Stripe Identity** embedded modal for expert KYC

### Stripe UX — fully embedded, no redirects

- Payment Element for patient checkout
- Connect Embedded Components for expert: `<ConnectAccountOnboarding>`, `<ConnectPayouts>`, `<ConnectBalances>`, `<ConnectAccountManagement>`, `<ConnectDocuments>`, `<ConnectTaxSettings>`, `<ConnectNotificationBanner>`
- Custom Eleva UI + Payment Element + Billing API for subscription management (expert Top Expert tier, clinic SaaS tiers) — **no Customer Portal redirect**
- `appearance` API mapped to Eleva design tokens; dark-mode; locale via next-intl
- CSP allows `js.stripe.com`, `connect-js.stripe.com`, `*.stripe.com`
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
