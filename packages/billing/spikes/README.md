# Phase 06.0 throwaway

Stripe test-mode funds-flow spike. Delete this folder before PR 06.1.

```bash
pnpm exec tsx packages/billing/spikes/funds-flow.ts --env staging
```

Refuses to run without `--env staging`, if `STRIPE_SECRET_KEY` is not `sk_test_`,
or if `STRIPE_PMC_BOOKING` or `STRIPE_API_VERSION` is missing.
Evidence: `evidence.json` (ids only; no secrets). Report:
`docs/eleva-v3/spikes/06-stripe-funds-flow.md`.
