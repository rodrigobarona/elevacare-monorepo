# ADR-016: Subscription UX Direction (supersedes ADR-005 UX section)

## Status

Active (effective 2026-05-19; supersedes the UX subsection of [ADR-005](ADR-005-payments-and-monetization.md): "Stripe UX — fully embedded, no redirects" lines 38-46)

## Date

2026-05-18 (Accepted), 2026-05-19 (Active after Phase 1+2 cutover audit closed)

## Context

ADR-005 (Accepted 2026-04-22) committed Eleva to a fully-embedded Stripe UX with no redirects and no Customer Portal:

> Custom Eleva UI + Payment Element + Billing API for subscription management (expert Top Expert tier, clinic SaaS tiers) — **no Customer Portal redirect**

Since then three things have changed:

- **WorkOS Stripe Add-on** is now part of the foundation ([stripe-foundation-review plan](../../../.cursor/plans/stripe-foundation-review_7e063870.plan.md)). Entitlements live in the WorkOS access-token JWT and Seat Sync owns subscription quantities for clinics via the `workos_seat_count` Billing Meter. Subscription state is read from JWT, not from the app's payment UI.
- **Stripe's recommendation tightened** in 2025-2026. The "Build a subscriptions integration" page now explicitly says: _"The Payment Intents API is a lower-level API for building custom checkout or payment flows, but requires significantly more code and ongoing maintenance. Stripe recommends the Payment Element with Checkout Sessions for most integrations."_ — [docs.stripe.com/billing/subscriptions/build-subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- **Embedded Checkout reached parity** on Appearance API customization, branding settings (Sep 2025), pt-PT locale support, and SCA/SEPA/tax handling. The brand-control argument that drove ADR-005 toward Payment Element is materially weaker than it was in April.

Three Eleva-specific facts also surfaced from research that ADR-005 did not address:

- **MB WAY and Multibanco cannot be used for recurring subscriptions.** They are one-time-only payment methods per Stripe docs ([mb-way](https://docs.stripe.com/payments/mb-way/accept-a-payment), [multibanco](https://docs.stripe.com/payments/multibanco)). For Portuguese SaaS recurring billing the only viable methods are `card` + `sepa_debit`. ADR-005 generalized "MB WAY + dynamic payment methods" to cover both booking payments and subscriptions; that conflation must be corrected.
- **Stripe Customer Portal does not support pt-PT.** Supported locales are roughly en, de, es, fr, it, ja, zh. Portuguese users see English or pt-BR.
- **Stripe Customer Portal has no multi-admin RBAC.** A Portal session is per-customer; Stripe does not tell us which clinic admin clicked Cancel. For clinic governance and regulated audit, this is a gap Eleva must close at the application layer (see audit-correlation pattern in the Decision section).

Finally, an Eleva-side product constraint that frames this decision: the team explicitly prefers an **"embedded widgets, no custom UI plumbing"** paradigm. WorkOS Widgets (User Management, User Profile) are already in production use as hosted-iframe widgets. The team wants the equivalent paradigm for billing, identity verification, and Connect onboarding — Stripe-controlled UI rendered inside Eleva — and is willing to accept a small redirect for management actions (Customer Portal) in exchange for not maintaining custom subscription-management code. This rules out Option B (full custom Payment Element) and rules out building a custom subscription-management UI as part of the foundation phase.

## Decision

Adopt **Option A — Embedded Checkout + Customer Portal — as the steady-state direction**, consistent with Eleva's already-chosen "embedded widgets, no custom UI plumbing" strategy (WorkOS Widgets are already in production use for user/identity management; Stripe surfaces are the equivalent paradigm for billing). A custom in-app management UI is treated as a **contingency escape hatch**, not a planned migration — built only if a specific limitation actually blocks the product.

The full direction:

### Subscription purchase (initial subscribe + plan upgrade) — Embedded Checkout

- Server creates a Stripe Checkout Session with `mode: "subscription"`, `ui_mode: "embedded"`, `customer`, `client_reference_id` (Eleva user/org id), `subscription_data.metadata.eleva_org_id`, `subscription_data.metadata.eleva_tier`, `automatic_tax[enabled]: true`, `tax_id_collection[enabled]: true`, `payment_method_types: ["card", "sepa_debit"]` (NOT MB WAY/Multibanco — they cannot recur).
- Client renders via `EmbeddedCheckoutProvider` from `@stripe/react-stripe-js`, scoped per app surface.
- On `checkout.session.completed`, the webhook persists `billing_subscriptions` and updates `expert_profiles.top_expert_active` where applicable. The return URL forces a WorkOS `session.refresh()` before reading entitlements.

### Subscription management (cancel, plan switch, payment method, invoices) — Customer Portal

- Server creates a Portal session via `billingPortal.sessions.create({ customer, return_url, configuration })`. Configuration enables `subscription_cancel` (with reasons + `at_period_end` proration), `subscription_update` (with `create_prorations`), `payment_method_update`, `invoice_history`, and `customer_update.tax_id` (for NIF).
- The act of minting the Portal session URL is itself wrapped in `withAudit({ entity: "billing_portal", action: "session_minted" })` capturing the actor `user_id`, `org_id`, IP, and timestamp. This becomes the **billing-actor audit record**.
- Caller redirects to the returned URL; user returns to Eleva via `return_url`.

### Multi-admin audit pattern (closes the Portal "no per-admin audit" gap without custom UI)

Stripe Customer Portal does not natively tell us which clinic admin clicked Cancel. Eleva closes this gap at the application layer via correlation, **without building a custom UI**:

- Audit-on-mint: every `POST /billing/portal` call is audited with the authenticated actor identity.
- Webhook events are also audited: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `payment_method.attached`, etc., with their Stripe event timestamps.
- Audit query joins the two: "subscription `sub_X` was updated at T; the most recent Portal session for that customer was minted by user U at T-30s → U is the inferred billing actor."

This is good enough for clinic governance, GDPR data-subject requests, and most regulated audit scenarios. It avoids the entire custom-UI build.

### Contingency escape hatch — custom in-app management UI

Treat custom management UI as a contingency, not a roadmap item. Build it only if **all** of the following become true:

- A specific clinic, regulator, or contract demands it in writing.
- The audit-correlation pattern above is demonstrably insufficient (e.g., concurrent admin sessions that cannot be disambiguated).
- The pt-PT regression on the management surface generates measurable user-research feedback (not assumed; observed).

If triggered, the contingency build replaces the Portal call site with a custom UI inside the relevant app, backed by `subscriptions.update` (with `proration_behavior: "create_prorations"` and `invoices.create_preview` for upgrade previews), SetupIntents + Payment Element for card replacement, and `invoices.list` for invoice history. Keep Portal as a fallback "Manage in Stripe" deep-link for niche cases. **Do not pre-build for this contingency.** Do not split the management UI into "some flows custom, some Portal" — pick one or the other in any given release.

### Booking payments — unchanged from ADR-005

Patient booking checkout keeps Payment Element with full Dynamic Payment Methods including **MB WAY**, card, and EU local methods. This is the one surface where ADR-005's stance is strictly correct: one-time payments, full brand control matters at the patient-facing moment, and MB WAY is in scope.

### Identity verification, Connect components — unchanged from ADR-005

Stripe Identity stays as an embedded modal (`stripe.verifyIdentity(clientSecret)`). Connect onboarding/payouts/balances/payments/tax-settings/notification-banner stay as Connect Embedded Components backed by tightly-scoped `AccountSession` tokens.

## Alternatives considered

### Pure Option A (Embedded Checkout + Customer Portal forever)

- Pros: smallest code surface, Stripe owns dunning and proration UX forever.
- Cons: pt-PT regression on management surface, no per-admin audit for clinic governance, brand inconsistency at the management moment.
- Rejected because pt-PT and clinic multi-admin audit are realistic Eleva requirements within 12 months.

### Pure Option B (Payment Element + custom UI for everything, per ADR-005)

- Pros: full brand control at every payment surface, full multi-admin audit, full pt-PT.
- Cons:
  - 2,000-5,000 LoC of payment UI to build, test, and maintain (Stripe's own docs warn this path "requires significantly more code and ongoing maintenance").
  - Owning the `incomplete`/`incomplete_expired` 23-hour expiry window, SCA re-prompt UX, dunning email cadence, and failed-payment recovery flow.
  - Blocks ship date for the foundation phase.
  - No reduction in PCI scope vs Embedded Checkout (both are SAQ-A if integrated correctly, but Embedded Checkout is harder to misconfigure).
- Rejected because the marginal brand-control gain at the _purchase_ surface is small, and the _management_ surface gain is real but defer-able to a Phase 5 hybrid step.

### Pure Option B for purchase, Portal for management (inverse hybrid)

- Pros: pt-PT/audit gap closed nowhere; loses the Embedded-Checkout SCA/tax/NIF wins exactly where they matter most.
- Rejected immediately — this combines the worst of both paths.

### "Hosted Checkout" (full-page Stripe-hosted, no embedded)

- Pros: zero embedding code; same SCA/tax/NIF wins as Embedded Checkout.
- Cons: full-page redirect breaks "feels native" at the highest-stakes moment of the funnel.
- Rejected because Embedded Checkout reaches the same goals while staying in-product.

## Consequences

### Code

- `[apps/api/src/app/billing/checkout/route.ts](../../../apps/api/src/app/billing/checkout/route.ts)` — new `POST /billing/checkout` returning Checkout Session `client_secret`. Auth: `requireApiAuth` + `billing:manage_org` + rate limit + Vercel BotID. Wrapped in `withAudit({ entity: "billing_checkout", action: "session_created" })`.
- `[apps/api/src/app/billing/portal/route.ts](../../../apps/api/src/app/billing/portal/route.ts)` — new `POST /billing/portal` returning Portal session URL. Same auth profile. **Wrapped in `withAudit({ entity: "billing_portal", action: "session_minted" })` capturing actor `user_id`, `org_id`, and Stripe `customer_id`** — this is the billing-actor audit anchor for the multi-admin correlation pattern described above.
- `[apps/api/src/app/billing/subscribe/route.ts](../../../apps/api/src/app/billing/subscribe/route.ts)` — keep as a temporary compatibility wrapper or delete if no client depends on it.
- `[packages/payments/src/embedded](../../../packages/payments/src/embedded)` — Embedded Checkout React wrapper using `EmbeddedCheckoutProvider`. No custom subscription-management UI is built; Portal redirect is the only management surface.
- The return URL after Embedded Checkout success must call WorkOS `session.refresh()` before reading entitlements, with a server-side fallback that reads entitlements from Stripe directly until JWT and Stripe agree.

### Configuration

- `[infra/stripe/seed-products.ts](../../../infra/stripe/seed-products.ts)` — `payment_method_types` for subscription products is `["card", "sepa_debit"]` only. Booking PaymentIntents keep the full dynamic set including MB WAY.
- A Portal Configuration must be created (one per environment) with cancel/update/payment-method/invoice/tax-id features enabled. Add to `[infra/stripe/setup-webhooks.ts](../../../infra/stripe/setup-webhooks.ts)` or a sibling `setup-portal.ts`.

### Compliance

- PCI scope is SAQ-A across Embedded Checkout, Portal, and the unchanged booking checkout (Payment Element via Elements).
- PHI must continue to be kept out of Stripe descriptors, metadata, line item names, and invoice memos. Stripe does not sign BAAs.
- Document this in the GDPR DPA appendix once the implementation lands.

### Product

- Customer Portal is the steady-state subscription-management surface, consistent with Eleva's broader "embedded widgets" pattern (WorkOS Widgets for user/identity, Stripe Embedded Checkout/Connect/Identity/Portal for billing and KYC).
- Communicate to clinic stakeholders that subscription management opens a Stripe-hosted page in a new tab; Eleva owns the audit log of who minted each session.
- No "Phase 5 hybrid migration" is planned. The contingency escape hatch is documented for the rare case it is needed; do not pre-build for it.

### Documentation

- Update [ADR-005](ADR-005-payments-and-monetization.md): mark the UX subsection as superseded by ADR-016, but leave its monetization, Connect, Tax, and three-party-revenue decisions intact.
- Update the [stripe-foundation-review plan](../../../.cursor/plans/stripe-foundation-review_7e063870.plan.md) Open Decision section to mark Option A + hybrid as resolved.
- Update `[infra/stripe/README.md](../../../infra/stripe/README.md)` and `[.cursor/rules/stripe-webhooks.mdc](../../../.cursor/rules/stripe-webhooks.mdc)` to reflect the final UX direction.

## References

- [docs.stripe.com/billing/subscriptions/build-subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — Stripe's recommended path
- [docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison](https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison) — Stripe's own comparison
- [docs.stripe.com/checkout/embedded/quickstart](https://docs.stripe.com/checkout/embedded/quickstart) — Embedded Checkout quickstart
- [docs.stripe.com/customer-management](https://docs.stripe.com/customer-management) — Customer Portal capabilities
- [docs.stripe.com/api/customer_portal/configurations](https://docs.stripe.com/api/customer_portal/configurations) — Portal configuration API
- [docs.stripe.com/api/customer_portal/sessions/create](https://docs.stripe.com/api/customer_portal/sessions/create) — Portal session locales
- [docs.stripe.com/payments/mb-way/accept-a-payment](https://docs.stripe.com/payments/mb-way/accept-a-payment) — MB WAY one-time-only constraint
- [docs.stripe.com/payments/multibanco](https://docs.stripe.com/payments/multibanco) — Multibanco one-time-only constraint
- [docs.stripe.com/billing/subscriptions/ideal](https://docs.stripe.com/billing/subscriptions/ideal) — SEPA Direct Debit bootstrap pattern for EU
- [docs.stripe.com/security/guide](https://docs.stripe.com/security/guide) — PCI scope (SAQ-A)
- [next-forge.com/docs/packages/payments](https://www.next-forge.com/docs/packages/payments) — reference Checkout + Portal pattern
- [vercel.com/blog/from-idea-to-secure-checkout-in-minutes-with-stripe](https://vercel.com/blog/from-idea-to-secure-checkout-in-minutes-with-stripe) — Vercel Marketplace canonical pattern
- [stripe-samples/checkout-single-subscription](https://github.com/stripe-samples/checkout-single-subscription) — Stripe-maintained reference
