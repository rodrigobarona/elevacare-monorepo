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
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/stripe/webhook

# Apply (creates in Stripe)
pnpm stripe:seed:products -- --apply
pnpm stripe:seed:entitlements -- --apply
pnpm stripe:setup:webhooks -- --url https://api.eleva.care/stripe/webhook --apply

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

`setup-webhooks.ts` manages the Stripe webhook endpoint that receives billing events. The endpoint URL must be passed via `--url` so the same script works across environments.

**Subscribed events:**

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

These match the handler in `apps/api/src/app/stripe/webhook/route.ts`.

**The signing secret (`whsec_...`) is only returned when the endpoint is first created.** Save it immediately as `STRIPE_WEBHOOK_SECRET` in your environment. On subsequent runs, the script syncs the events list but cannot retrieve the secret again.

### Local development

Use the Stripe CLI instead of `setup-webhooks.ts` for local dev. The API runs
on port 3002.

**First-time setup:**

1. Install: `brew install stripe/stripe-cli/stripe`
2. Log in: `stripe login`
3. Start the listener:

   ```bash
   stripe listen --forward-to localhost:3002/stripe/webhook
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
stripe listen --forward-to localhost:3002/stripe/webhook
```

**Triggering test events:**

```bash
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

Check the API logs for `[stripe-webhook]` output.

## Production deployment checklist

1. Set `STRIPE_SECRET_KEY` to the **live** key
2. Run `pnpm stripe:seed:products -- --apply`
3. Run `pnpm stripe:seed:entitlements -- --apply`
4. Run `pnpm stripe:setup:webhooks -- --url https://api.eleva.care/stripe/webhook --apply`
5. Save the `whsec_...` secret as `STRIPE_WEBHOOK_SECRET` in production env vars
6. Verify in Stripe Dashboard: Products → each product shows "1 feature" attached
7. Verify in Stripe Dashboard: Developers → Webhooks → endpoint is active with 5 events
8. Verify in WorkOS Dashboard: Stripe Add-on connected to the live Stripe account

## Idempotency

All scripts are idempotent:

- `seed-products.ts` searches by `metadata["eleva_product_key"]` — skips existing products
- `seed-entitlements.ts` searches by `lookup_key` — skips existing features and attachments
- `setup-webhooks.ts` matches by URL — updates events on existing endpoints, creates if missing

Safe to re-run after adding new tiers, events, or if something went wrong.
