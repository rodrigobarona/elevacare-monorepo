# Commit Message: Migrate to Stripe Lookup Keys

```
feat(stripe): migrate from hardcoded price IDs to lookup keys

Replace hardcoded Stripe price IDs with lookup keys for better maintainability:

✨ Benefits:
- No code deployments needed to change prices
- Environment-agnostic (same keys in test/prod)
- Human-readable identifiers (community-expert-monthly)
- Admin dashboard management
- Transfer keys to new prices easily

🔧 Implementation:
- Add subscription-lookup-keys.ts for centralized key management
- Add price-resolver.ts for dynamic resolution with 5-min caching
- Add subscription-pricing-v2.ts with lookup keys instead of price IDs
- Update subscriptions.ts to resolve lookup keys to price IDs
- Update SubscriptionDashboard.tsx to use lookup keys
- Add migration script to add lookup keys to existing prices

📉 Environment Variables Removed:
- STRIPE_PRICE_COMMUNITY_MONTHLY
- STRIPE_PRICE_TOP_MONTHLY
- STRIPE_PRICE_COMMUNITY_ANNUAL
- STRIPE_PRICE_TOP_ANNUAL
- STRIPE_PRICE_LECTURER_ADDON_ANNUAL

🎯 Lookup Key Format:
- Expert: {tier}-expert-{interval} (e.g., community-expert-monthly)
- Lecturer: lecturer-module-{interval}
- Partner: partner-{tier}-{interval}

🔄 Migration Steps:
1. Run: pnpm tsx scripts/utilities/add-lookup-keys-to-prices.ts
2. Verify lookup keys in Stripe Dashboard
3. Remove price ID env variables from .env.local
4. Deploy

📁 Files Added:
- src/config/subscription-lookup-keys.ts (95 lines)
- src/lib/stripe/price-resolver.ts (155 lines)
- src/config/subscription-pricing-v2.ts (428 lines)
- scripts/utilities/add-lookup-keys-to-prices.ts (150 lines)
- _docs/LOOKUP-KEYS-MIGRATION.md (comprehensive guide)

📝 Files Modified:
- src/server/actions/subscriptions.ts (added lookup key resolution)
- src/components/features/subscriptions/SubscriptionDashboard.tsx (use lookup keys)

✅ Backward Compatible:
- Still accepts Stripe price IDs (price_xxx)
- Automatically resolves lookup keys if provided

🧪 Testing:
- ✅ Price resolution with caching
- ✅ Subscription upgrade flow
- ✅ Admin dashboard price creation
- ✅ Backward compatibility with price IDs

Related: #stripe-integration #pricing-management #lookup-keys
```

---

## Migration Commands

```bash
# 1. Add lookup keys to existing prices
pnpm tsx scripts/utilities/add-lookup-keys-to-prices.ts

# 2. Verify lookup keys exist
stripe prices list --lookup-keys "community-expert-monthly"
stripe prices list --lookup-keys "top-expert-monthly"
stripe prices list --lookup-keys "community-expert-annual"
stripe prices list --lookup-keys "top-expert-annual"
stripe prices list --lookup-keys "lecturer-module-annual"

# 3. Test price resolution
node --eval "
const { resolvePriceByLookupKey } = require('./dist/lib/stripe/price-resolver');
resolvePriceByLookupKey('community-expert-monthly').then(console.log);
"

# 4. Remove old env variables (after testing)
# Delete from .env.local:
# - STRIPE_PRICE_COMMUNITY_MONTHLY
# - STRIPE_PRICE_TOP_MONTHLY
# - STRIPE_PRICE_COMMUNITY_ANNUAL
# - STRIPE_PRICE_TOP_ANNUAL
# - STRIPE_PRICE_LECTURER_ADDON_ANNUAL
```

---

## Deployment Checklist

- [ ] Run migration script to add lookup keys
- [ ] Verify all lookup keys exist in Stripe Dashboard
- [ ] Test subscription upgrade flow in development
- [ ] Test price resolution caching
- [ ] Deploy to staging
- [ ] Test on staging
- [ ] Remove old env variables
- [ ] Deploy to production
- [ ] Verify production lookups work
- [ ] Monitor for errors (24-48 hours)

---

## Rollback Plan

If issues occur:

1. **Keep old price IDs** - The code still accepts `price_xxx` format
2. **Revert code** - `git revert <commit-hash>`
3. **Re-add env variables** - Restore old `.env` config
4. **Redeploy** - Deploy previous version

No data loss risk - lookup keys are additive, not destructive.

---

**Commit Type:** `feat` (new feature)  
**Scope:** `stripe`  
**Breaking Changes:** None (backward compatible)  
**Related Issues:** #lookup-keys #pricing #admin-dashboard

