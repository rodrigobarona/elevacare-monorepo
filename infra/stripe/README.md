# infra/stripe — Stripe Products & Entitlements Seeding

Idempotent scripts to provision Stripe products, prices, and entitlement features. Must be run once per Stripe environment (test/live) and can be safely re-run at any time.

## Prerequisites

- `STRIPE_SECRET_KEY` set in `.env.local` (test) or in your CI/production secrets
- Node.js 24+, pnpm 11+

## Scripts

| Script                           | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `pnpm seed:products`             | Dry-run: shows products/prices that would be created      |
| `pnpm seed:products --apply`     | Creates products and prices in Stripe                     |
| `pnpm seed:entitlements`         | Dry-run: shows entitlement features that would be created |
| `pnpm seed:entitlements --apply` | Creates features and attaches them to products            |

## Root-level shortcuts

From the monorepo root:

```bash
# Dry-run
pnpm stripe:seed:products
pnpm stripe:seed:entitlements

# Apply (creates in Stripe)
pnpm stripe:seed:products -- --apply
pnpm stripe:seed:entitlements -- --apply

# Run both in sequence (apply mode)
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

## Production deployment checklist

1. Set `STRIPE_SECRET_KEY` to the **live** key
2. Run `pnpm stripe:seed:products -- --apply`
3. Run `pnpm stripe:seed:entitlements -- --apply`
4. Verify in Stripe Dashboard: Products → each product shows "1 feature" attached
5. Verify in WorkOS Dashboard: Stripe Add-on connected to the live Stripe account

## Idempotency

Both scripts are idempotent:

- `seed-products.ts` searches by `metadata["eleva_product_key"]` — skips existing products
- `seed-entitlements.ts` searches by `lookup_key` — skips existing features and attachments

Safe to re-run after adding new tiers or if something went wrong.
