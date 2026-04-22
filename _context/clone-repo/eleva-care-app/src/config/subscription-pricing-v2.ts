/**
 * Eleva Subscription Pricing Configuration v2
 * 
 * ✨ NEW: Uses Stripe lookup keys instead of hardcoded price IDs
 * 
 * Migration from v1:
 * - Removed: stripePriceId fields with hardcoded IDs
 * - Added: lookupKey fields for dynamic resolution
 * - Added: getPriceId() helper for runtime resolution
 * 
 * @see /admin/subscriptions - Create prices with lookup keys
 * @see src/lib/stripe/price-resolver.ts - Dynamic resolution
 */

import { EXPERT_LOOKUP_KEYS, LECTURER_LOOKUP_KEYS } from './subscription-lookup-keys';

export type PlanType = 'commission' | 'monthly' | 'annual';
export type TierLevel = 'community' | 'top';
export type BillingInterval = 'month' | 'year';

export interface PricingPlan {
  tier: TierLevel;
  planType: PlanType;
  monthlyFee: number; // in cents
  annualFee?: number; // in cents (for annual plans)
  monthlyEquivalent?: number; // in cents (for annual plans)
  commissionRate: number; // decimal (e.g., 0.20 for 20%)
  commissionDiscount?: number; // decimal (e.g., 0.08 for 8% reduction)
  lookupKey?: string; // ✨ NEW: Stripe lookup key
  breakEvenMonthlyRevenue?: number; // in dollars
  features: string[];
  limits: {
    maxServices: number; // -1 for unlimited
    payoutFrequency: 'daily' | 'weekly';
  };
  trialDays?: number;
  commitmentMonths?: number;
}

export interface AddonPricing {
  name: string;
  monthlyFee?: number; // in cents
  annualFee?: number; // in cents
  commissionRate: number; // decimal
  lookupKey?: string; // ✨ NEW: Stripe lookup key
  breakEvenAnnualSales?: number; // in dollars
}

export interface EligibilityCriteria {
  minMonthsActive: number;
  minAvgMonthlyRevenue: number; // in cents
  minCompletedAppointments: number;
  minRating: number;
}

/**
 * Subscription Pricing Configuration
 * Commission rates: 20% Community, 15% Top Expert
 * Annual subscriptions: $490/$1,774 with reduced commission (12%/8%)
 */
export const SUBSCRIPTION_PRICING = {
  commission_based: {
    community_expert: {
      tier: 'community' as const,
      planType: 'commission' as const,
      monthlyFee: 0,
      commissionRate: 0.2, // 20%
      features: [
        'List up to 5 services',
        'Basic calendar integration',
        'Standard analytics',
        'Weekly payouts',
        'Email support',
        'Community forum',
        'Pay only 20% commission',
        'No monthly fees',
      ],
      limits: {
        maxServices: 5,
        payoutFrequency: 'weekly' as const,
      },
      trialDays: 30,
    },
    top_expert: {
      tier: 'top' as const,
      planType: 'commission' as const,
      monthlyFee: 0,
      commissionRate: 0.15, // 15%
      features: [
        'All Community Expert features',
        'Unlimited services',
        'Advanced analytics',
        'Priority support',
        'Featured placement',
        'Daily payout option',
        'Custom branding',
        'Group sessions',
        'Direct messaging',
        'Pay only 15% commission',
        'No monthly fees',
      ],
      limits: {
        maxServices: -1, // unlimited
        payoutFrequency: 'daily' as const,
      },
    },
  },

  monthly_subscription: {
    community_expert: {
      tier: 'community' as const,
      planType: 'monthly' as const,
      monthlyFee: 4900, // $49/month
      commissionRate: 0.12, // 12% commission
      commissionDiscount: 0.08, // 8% reduction
      lookupKey: EXPERT_LOOKUP_KEYS.community.monthly, // ✨ NEW
      breakEvenMonthlyRevenue: 510, // $510/month
      features: [
        'List up to 5 services',
        'Basic calendar integration',
        'Standard analytics',
        'Weekly payouts',
        'Email support',
        'Community forum',
        '✨ Commission reduced to 12% (was 20%)',
        '✨ Cancel anytime flexibility',
        '✨ Low monthly commitment ($49/mo)',
        '✨ Save $98/year with annual plan',
      ],
      limits: {
        maxServices: 5,
        payoutFrequency: 'weekly' as const,
      },
    },
    top_expert: {
      tier: 'top' as const,
      planType: 'monthly' as const,
      monthlyFee: 17700, // $177/month (corrected from $155)
      commissionRate: 0.08, // 8% commission
      commissionDiscount: 0.07, // 7% reduction
      lookupKey: EXPERT_LOOKUP_KEYS.top.monthly, // ✨ NEW
      breakEvenMonthlyRevenue: 1774, // $1,774/month
      features: [
        'All Top Expert features',
        'Unlimited services',
        'Advanced analytics',
        'Priority support',
        'Featured placement',
        'Daily payout option',
        'Custom branding',
        'Group sessions',
        'Direct messaging',
        '✨ Commission reduced to 8% (was 15%)',
        '✨ Cancel anytime flexibility',
        '✨ Save $350/year with annual plan',
        '✨ VIP subscriber benefits',
      ],
      limits: {
        maxServices: -1,
        payoutFrequency: 'daily' as const,
      },
    },
  },

  annual_subscription: {
    community_expert: {
      tier: 'community' as const,
      planType: 'annual' as const,
      monthlyFee: 0,
      annualFee: 49000, // $490/year
      monthlyEquivalent: 4083, // $40.83/month
      commissionRate: 0.12, // 12%
      commissionDiscount: 0.08, // 8% reduction
      lookupKey: EXPERT_LOOKUP_KEYS.community.annual, // ✨ NEW
      breakEvenMonthlyRevenue: 510, // $510/month
      features: [
        'List up to 5 services',
        'Basic calendar integration',
        'Standard analytics',
        'Weekly payouts',
        'Email support',
        'Community forum',
        '✨ Commission reduced to 12% (was 20%)',
        '✨ Save up to 40% on total costs',
        '✨ Predictable annual fee',
        '✨ Priority annual subscriber support',
      ],
      limits: {
        maxServices: 5,
        payoutFrequency: 'weekly' as const,
      },
      commitmentMonths: 12,
    },
    top_expert: {
      tier: 'top' as const,
      planType: 'annual' as const,
      monthlyFee: 0,
      annualFee: 177400, // $1,774/year (corrected from $1,490)
      monthlyEquivalent: 14783, // $147.83/month
      commissionRate: 0.08, // 8%
      commissionDiscount: 0.07, // 7% reduction
      lookupKey: EXPERT_LOOKUP_KEYS.top.annual, // ✨ NEW
      breakEvenMonthlyRevenue: 1774, // $1,774/month
      features: [
        'All Top Expert features',
        'Unlimited services',
        'Advanced analytics',
        'Priority support',
        'Featured placement',
        'Daily payout option',
        'Custom branding',
        'Group sessions',
        'Direct messaging',
        '✨ Commission reduced to 8% (was 15%)',
        '✨ Save up to 40% on total costs',
        '✨ Industry-leading low commission',
        '✨ VIP annual subscriber benefits',
      ],
      limits: {
        maxServices: -1,
        payoutFrequency: 'daily' as const,
      },
      commitmentMonths: 12,
    },
  },

  addons: {
    lecturer_commission: {
      name: 'Lecturer Module (Commission)',
      monthlyFee: 0,
      commissionRate: 0.05, // 5% on course sales
    },
    lecturer_annual: {
      name: 'Lecturer Module (Annual)',
      annualFee: 49000, // $490/year
      commissionRate: 0.03, // 3% on course sales
      lookupKey: LECTURER_LOOKUP_KEYS.annual, // ✨ NEW
      breakEvenAnnualSales: 14000, // $14,000 in course sales
    },
  },

  eligibility: {
    community_expert: {
      minMonthsActive: 3,
      minAvgMonthlyRevenue: 51000, // $510 in cents
      minCompletedAppointments: 15,
      minRating: 4.0,
    },
    top_expert: {
      minMonthsActive: 3,
      minAvgMonthlyRevenue: 177400, // $1,774 in cents
      minCompletedAppointments: 50,
      minRating: 4.5,
    },
  },
} as const;

/**
 * Helper functions for pricing calculations
 */

/**
 * Calculate commission amount for a transaction
 */
export function calculateCommission(grossAmount: number, commissionRate: number): number {
  return Math.round(grossAmount * commissionRate);
}

/**
 * Calculate net amount after commission
 */
export function calculateNetAmount(grossAmount: number, commissionRate: number): number {
  const commission = calculateCommission(grossAmount, commissionRate);
  return grossAmount - commission;
}

/**
 * Calculate annual cost for commission-based plan
 */
export function calculateAnnualCommissionCost(
  monthlyRevenue: number,
  commissionRate: number,
): number {
  return monthlyRevenue * 12 * commissionRate;
}

/**
 * Calculate annual cost for subscription plan
 */
export function calculateAnnualSubscriptionCost(
  monthlyRevenue: number,
  annualFee: number,
  commissionRate: number,
): number {
  const annualCommissions = monthlyRevenue * 12 * commissionRate;
  return annualFee / 100 + annualCommissions; // Convert cents to dollars
}

/**
 * Calculate savings between commission and annual plans
 */
export function calculateAnnualSavings(
  monthlyRevenue: number,
  commissionRate: number,
  annualFee: number,
  annualCommissionRate: number,
): {
  commissionCost: number;
  annualCost: number;
  savings: number;
  savingsPercentage: number;
} {
  const commissionCost = calculateAnnualCommissionCost(monthlyRevenue, commissionRate);
  const annualCost = calculateAnnualSubscriptionCost(
    monthlyRevenue,
    annualFee,
    annualCommissionRate,
  );
  const savings = commissionCost - annualCost;
  const savingsPercentage = (savings / commissionCost) * 100;

  return {
    commissionCost,
    annualCost,
    savings,
    savingsPercentage,
  };
}

/**
 * Check if expert is eligible for annual plan upgrade
 */
export function checkAnnualEligibility(
  tier: TierLevel,
  avgMonthlyRevenue: number, // in cents
  monthsActive: number,
  completedAppointments: number,
  rating: number,
): {
  eligible: boolean;
  criteria: EligibilityCriteria;
  failedCriteria?: string[];
} {
  const criteria =
    SUBSCRIPTION_PRICING.eligibility[tier as keyof typeof SUBSCRIPTION_PRICING.eligibility];
  const failedCriteria: string[] = [];

  if (monthsActive < criteria.minMonthsActive) {
    failedCriteria.push(`Need ${criteria.minMonthsActive} months active (have ${monthsActive})`);
  }

  if (avgMonthlyRevenue < criteria.minAvgMonthlyRevenue) {
    failedCriteria.push(
      `Need $${criteria.minAvgMonthlyRevenue / 100}/month avg revenue (have $${avgMonthlyRevenue / 100})`,
    );
  }

  if (completedAppointments < criteria.minCompletedAppointments) {
    failedCriteria.push(
      `Need ${criteria.minCompletedAppointments} completed appointments (have ${completedAppointments})`,
    );
  }

  if (rating < criteria.minRating) {
    failedCriteria.push(`Need ${criteria.minRating}+ rating (have ${rating})`);
  }

  return {
    eligible: failedCriteria.length === 0,
    criteria,
    failedCriteria: failedCriteria.length > 0 ? failedCriteria : undefined,
  };
}

/**
 * Get pricing plan by tier and plan type
 */
export function getPricingPlan(tier: TierLevel, planType: PlanType): PricingPlan {
  if (planType === 'commission') {
    return SUBSCRIPTION_PRICING.commission_based[`${tier}_expert`] as unknown as PricingPlan;
  } else if (planType === 'monthly') {
    return SUBSCRIPTION_PRICING.monthly_subscription[`${tier}_expert`] as unknown as PricingPlan;
  } else {
    return SUBSCRIPTION_PRICING.annual_subscription[`${tier}_expert`] as unknown as PricingPlan;
  }
}

/**
 * Type exports for use in the application
 */
export type SubscriptionPricing = typeof SUBSCRIPTION_PRICING;
export type CommissionBasedPlan = typeof SUBSCRIPTION_PRICING.commission_based;
export type MonthlySubscriptionPlan = typeof SUBSCRIPTION_PRICING.monthly_subscription;
export type AnnualSubscriptionPlan = typeof SUBSCRIPTION_PRICING.annual_subscription;
export type Addons = typeof SUBSCRIPTION_PRICING.addons;
export type EligibilityConfig = typeof SUBSCRIPTION_PRICING.eligibility;

