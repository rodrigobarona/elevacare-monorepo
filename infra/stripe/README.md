# infra/stripe — Stripe Products, Entitlements & Webhooks

Idempotent scripts to provision Stripe products, prices, entitlement features, and webhook endpoints. Must be run once per Stripe environment (test/live) and can be safely re-run at any time.

## Prerequisites

- `STRIPE_SECRET_KEY` set in `.env.local` (test) or in your CI/production secrets
- Node.js 24+, pnpm 11+

## Scripts

| Script                                       | Description                                               |
| -------------------------------------------- | --------------------------------------------------------- |
| `pnpm seed:products`                         | Dry-run: shows products/prices that would be created      |
| `pnpm seed:products --apply`                 | Creates products and prices in Stripe                     |
| `pnpm seed:entitlements`                     | Dry-run: shows entitlement features that would be created |
| `pnpm seed:entitlements --apply`             | Creates features and attaches them to products            |
| `pnpm setup:webhooks -- --url <URL>`         | Dry-run: shows webhook endpoint that would be configured  |
| `pnpm setup:webhooks -- --url <URL> --apply` | Creates or updates the webhook endpoint                   |

## Root-level shortcuts

From the monorepo root:

```bash
# Dry-run
pnpm stripe:seed:products
pnpm stripe:seed:entitlements
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/webhooks/stripe

# Apply (creates in Stripe)
pnpm stripe:seed:products -- --apply
pnpm stripe:seed:entitlements -- --apply
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/webhooks/stripe --apply

# Run both seed scripts in sequence (apply mode)
pnpm stripe:seed
```

## Products created

| Product          | Base Price    | Seat Price        | Entitlement Key    |
| ---------------- | ------------- | ----------------- | ------------------ |
| Member Free      | EUR 0.00/mo   | —                 | `member_free`      |
| Expert Community | EUR 0.00/mo   | —                 | `expert_community` |
| Top Expert       | EUR 0.00/mo   | —                 | `expert_top`       |
| Clinic Starter   | EUR 99.00/mo  | EUR 39.00/seat/mo | `clinic_starter`   |
| Clinic Growth    | EUR 199.00/mo | EUR 29.00/seat/mo | `clinic_growth`    |

## Entitlement features

Each product has an attached Stripe Entitlement Feature with a `lookup_key` matching the entitlement key above. When a customer has an active subscription to a product, the feature is "active" for that customer.

## How WorkOS uses these

1. WorkOS Stripe Add-on reads the customer's active entitlements from Stripe
2. WorkOS includes them in the `entitlements` claim of the access token JWT
3. `packages/auth` parses the JWT and populates `ElevaSession.entitlements`
4. `packages/flags` uses `hasEntitlement()` for runtime feature gating

## Webhook endpoint

`setup-webhooks.ts` manages the Stripe webhook endpoint that receives platform events. The endpoint URL must be passed via `--url` so the same script works across environments.

**Canonical endpoint URL** (per Phase 1 of stripe-foundation-review):

```
https://api.eleva.care/webhooks/stripe
```

The legacy URL (`/stripe/webhook`) is still active in the API layer during cutover and delegates to the same `processStripeEvent` core. Cutover order:

1. Deploy `/webhooks/stripe` (already shipped).
2. Run `pnpm stripe:setup:webhooks -- --url https://api.eleva.care/webhooks/stripe --apply` to update the Stripe Dashboard.
3. Verify deliveries land on `/webhooks/stripe` (check `stripe_webhook_events` rows).
4. Remove the legacy `/stripe/webhook` route file in a follow-up commit.

**Subscribed events** (from `setup-webhooks.ts` `WEBHOOK_EVENTS`):

SaaS lifecycle:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded` (legacy alias kept for back-compat)
- `invoice.payment_failed`
- `invoice.payment_action_required`

Stripe Identity:

- `identity.verification_session.verified`
- `identity.verification_session.requires_input`
- `identity.verification_session.canceled`

Stripe Connect platform + payouts:

- `account.updated`
- `capability.updated`
- `account.application.deauthorized`
- `payout.paid`
- `payout.failed`

Booking payments + refunds + disputes:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

These map to `case` branches in `dispatchEvent` inside `packages/billing/src/server/webhook.ts`. The route handlers (`apps/api/src/app/webhooks/stripe/route.ts` canonical and `apps/api/src/app/stripe/webhook/route.ts` legacy) are thin wrappers that verify the signature and call `processStripeEvent`.

**Idempotency.** Every event is recorded in the `stripe_webhook_events` table keyed by Stripe `event.id` before dispatch. Duplicate deliveries are short-circuited via `INSERT ... ON CONFLICT DO NOTHING` and the route returns `200 { received: true, status: "duplicate" }`.

**The signing secret (`whsec_...`) is only returned when the endpoint is first created.** Save it immediately as `STRIPE_WEBHOOK_SECRET` in your environment. On subsequent runs, the script syncs the events list but cannot retrieve the secret again.

### Local development

Use the Stripe CLI instead of `setup-webhooks.ts` for local dev. The API runs
on port 3002.

**First-time setup:**

1. Install: `brew install stripe/stripe-cli/stripe`
2. Log in: `stripe login`
3. Start the listener:

   ```bash
   stripe listen --forward-to localhost:3002/webhooks/stripe
   ```

4. Copy the `whsec_...` from the CLI output into `.env.local`:

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. Restart the API dev server so it picks up the new secret.

**Daily workflow:**

```bash
# Terminal 1 — API
pnpm --filter @eleva/api dev

# Terminal 2 — Stripe event forwarding
stripe listen --forward-to localhost:3002/webhooks/stripe
```

**Triggering test events:**

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger payment_intent.succeeded
stripe trigger payout.paid
stripe trigger account.updated
stripe trigger identity.verification_session.verified
```

Check the API logs for `[stripe-webhook]` output and `stripe_webhook_events` rows for the persisted entries.

### WorkOS Stripe Add-on note

The WorkOS Stripe Add-on does NOT support Stripe Sandbox accounts (per ADR-016). For staging/dev, use Stripe **test mode** on a standard account, not a Sandbox account. Entitlements and `workos_seat_count` meter integration require this.

## Production deployment checklist

1. Set `STRIPE_SECRET_KEY` to the **live** key
2. Run `pnpm stripe:seed:products -- --apply`
3. Run `pnpm stripe:seed:entitlements -- --apply`
4. Run `pnpm stripe:setup:webhooks -- --url https://api.eleva.care/webhooks/stripe --apply`
5. Save the `whsec_...` secret as `STRIPE_WEBHOOK_SECRET` in production env vars
6. Verify in Stripe Dashboard: Products → each product shows "1 feature" attached
7. Verify in Stripe Dashboard: Developers → Webhooks → endpoint is active with the full canonical event list (currently ~20 events)
8. Verify in WorkOS Dashboard: Stripe Add-on connected to the live Stripe account (must be a standard account, not a Sandbox — Sandbox is unsupported)
9. Trigger a `customer.subscription.created` test event and verify a row appears in the `stripe_webhook_events` table with status='processed'

## Idempotency

All scripts are idempotent:

- `seed-products.ts` searches by `metadata["eleva_product_key"]` — skips existing products
- `seed-entitlements.ts` searches by `lookup_key` — skips existing features and attachments
- `setup-webhooks.ts` matches by URL — updates events on existing endpoints, creates if missing

Safe to re-run after adding new tiers, events, or if something went wrong.
