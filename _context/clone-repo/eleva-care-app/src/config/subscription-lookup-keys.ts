/**
 * Stripe Price Lookup Keys Configuration
 *
 * Using lookup keys instead of hardcoded price IDs provides:
 * ✅ No code deployments to change prices
 * ✅ Environment-agnostic (same keys in test/prod)
 * ✅ Human-readable identifiers
 * ✅ Easy to manage via Admin Dashboard
 * ✅ Transfer keys to new prices when updating
 *
 * @see https://docs.stripe.com/products-prices/manage-prices#lookup-keys
 * @see /admin/subscriptions - Create prices with lookup keys
 */

/**
 * Expert Subscription Lookup Keys
 *
 * Format: {tier}-expert-{interval}
 * Example: community-expert-monthly
 */
export const EXPERT_LOOKUP_KEYS = {
  community: {
    monthly: 'community-expert-monthly',
    annual: 'community-expert-annual',
  },
  top: {
    monthly: 'top-expert-monthly',
    annual: 'top-expert-annual',
  },
} as const;

/**
 * Lecturer Module Lookup Keys
 */
export const LECTURER_LOOKUP_KEYS = {
  annual: 'lecturer-module-annual',
} as const;

/**
 * Partner Workspace Lookup Keys
 *
 * Format: partner-{tier}-{interval}
 * Example: partner-starter-monthly
 */
export const PARTNER_LOOKUP_KEYS = {
  starter: {
    monthly: 'partner-starter-monthly',
    annual: 'partner-starter-annual',
  },
  professional: {
    monthly: 'partner-professional-monthly',
    annual: 'partner-professional-annual',
  },
  enterprise: {
    monthly: 'partner-enterprise-monthly',
    annual: 'partner-enterprise-annual',
  },
} as const;

/**
 * All lookup keys (for validation and listing)
 */
export const ALL_LOOKUP_KEYS = [
  ...Object.values(EXPERT_LOOKUP_KEYS.community),
  ...Object.values(EXPERT_LOOKUP_KEYS.top),
  ...Object.values(LECTURER_LOOKUP_KEYS),
  ...Object.values(PARTNER_LOOKUP_KEYS.starter),
  ...Object.values(PARTNER_LOOKUP_KEYS.professional),
  ...Object.values(PARTNER_LOOKUP_KEYS.enterprise),
] as const;

/**
 * Type exports
 */
export type ExpertLookupKey = (typeof ALL_LOOKUP_KEYS)[number];
export type ExpertTier = keyof typeof EXPERT_LOOKUP_KEYS;
export type BillingInterval = 'monthly' | 'annual';
export type PartnerTier = keyof typeof PARTNER_LOOKUP_KEYS;

/**
 * Helper to get lookup key by tier and interval
 */
export function getExpertLookupKey(tier: ExpertTier, interval: BillingInterval): string {
  return EXPERT_LOOKUP_KEYS[tier][interval];
}

/**
 * Helper to get partner lookup key
 */
export function getPartnerLookupKey(tier: PartnerTier, interval: BillingInterval): string {
  return PARTNER_LOOKUP_KEYS[tier][interval];
}

/**
 * Helper to validate lookup key exists
 */
export function isValidLookupKey(key: string): key is ExpertLookupKey {
  return ALL_LOOKUP_KEYS.includes(key as ExpertLookupKey);
}

