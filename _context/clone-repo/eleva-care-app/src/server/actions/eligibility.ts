/**
 * Subscription Eligibility Checker
 *
 * Calculates and tracks eligibility for annual subscription plans.
 * Updates metrics used to determine if an expert qualifies for annual pricing.
 *
 * Eligibility Criteria:
 * - Community Expert: 3+ months active, $510+/month avg, 15+ bookings, 4.0+ rating
 * - Top Expert: 3+ months active, $1,774+/month avg, 50+ bookings, 4.5+ rating
 */

'use server';

import * as Sentry from '@sentry/nextjs';
import { SUBSCRIPTION_PRICING } from '@/config/subscription-pricing';

const { logger } = Sentry;
import { db } from '@/drizzle/db';
import {
  AnnualPlanEligibilityTable,
  MeetingsTable,
  TransactionCommissionsTable,
  UserOrgMembershipsTable,
  UsersTable,
} from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Subscription Eligibility Checker
 *
 * Calculates and tracks eligibility for annual subscription plans.
 * Updates metrics used to determine if an expert qualifies for annual pricing.
 *
 * Eligibility Criteria:
 * - Community Expert: 3+ months active, $510+/month avg, 15+ bookings, 4.0+ rating
 * - Top Expert: 3+ months active, $1,774+/month avg, 50+ bookings, 4.5+ rating
 */

/**
 * Subscription Eligibility Checker
 *
 * Calculates and tracks eligibility for annual subscription plans.
 * Updates metrics used to determine if an expert qualifies for annual pricing.
 *
 * Eligibility Criteria:
 * - Community Expert: 3+ months active, $510+/month avg, 15+ bookings, 4.0+ rating
 * - Top Expert: 3+ months active, $1,774+/month avg, 50+ bookings, 4.5+ rating
 */

// ============================================================================
// Types
// ============================================================================

export interface EligibilityStatus {
  isEligible: boolean;
  tierLevel: 'community' | 'top';
  meetsRequirements: {
    monthsActive: boolean;
    avgMonthlyRevenue: boolean;
    totalBookings: boolean;
    rating: boolean;
  };
  currentMetrics: {
    monthsActive: number;
    avgMonthlyRevenue: number; // in cents
    totalBookings: number;
    currentRating: number;
  };
  projectedSavings: {
    annualCommissions: number; // in cents
    annualSavings: number; // in cents
    savingsPercentage: number; // as decimal (0.36 = 36%)
  };
  breakEvenMonthlyRevenue: number; // in cents
}

// ============================================================================
// Check Eligibility for a User
// ============================================================================

/**
 * Check if a user is eligible for an annual subscription
 *
 * @param workosUserId - The WorkOS user ID
 * @returns Eligibility status with detailed breakdown
 */
export async function checkAnnualEligibility(workosUserId: string): Promise<EligibilityStatus> {
  return Sentry.withServerActionInstrumentation('checkAnnualEligibility', { recordResponse: true }, async () => {
  try {
    // Get user details
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, workosUserId),
      columns: {
        id: true,
        workosUserId: true,
        role: true,
        createdAt: true,
      },
      with: {
        profile: {
          columns: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Determine tier level from role
    const tierLevel =
      user.role === 'expert_top' || user.role === 'expert_lecturer' ? 'top' : 'community';

    // Get eligibility criteria for tier
    const criteria =
      tierLevel === 'top'
        ? SUBSCRIPTION_PRICING.eligibility.top_expert
        : SUBSCRIPTION_PRICING.eligibility.community_expert;

    // Calculate months active
    const accountCreatedAt = user.createdAt;
    const monthsActive = Math.floor(
      (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30),
    );

    // Get booking metrics (last 90 days for avg, all-time for total)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Get all completed bookings
    const allBookings = await db.query.MeetingsTable.findMany({
      where: and(
        eq(MeetingsTable.workosUserId, workosUserId),
        eq(MeetingsTable.stripePaymentStatus, 'succeeded'),
      ),
      columns: {
        id: true,
        stripeAmount: true,
        createdAt: true,
      },
    });

    // Get bookings from last 90 days
    const recentBookings = allBookings.filter((b) => b.createdAt >= ninetyDaysAgo);

    // Calculate total revenue (last 90 days)
    const recentRevenue = recentBookings.reduce((sum, b) => sum + (b.stripeAmount || 0), 0);

    // Calculate average monthly revenue (based on last 90 days)
    const avgMonthlyRevenue = Math.round((recentRevenue / 90) * 30);

    // Total bookings (all time)
    const totalBookings = allBookings.length;

    // Get rating from profile (if available)
    // TODO: Implement rating system, for now default to 5.0
    const currentRating = 5.0;

    // Check if meets all requirements
    const meetsRequirements = {
      monthsActive: monthsActive >= criteria.minMonthsActive,
      avgMonthlyRevenue: avgMonthlyRevenue >= criteria.minAvgMonthlyRevenue,
      totalBookings: totalBookings >= criteria.minCompletedAppointments,
      rating: currentRating >= criteria.minRating,
    };

    const isEligible = Object.values(meetsRequirements).every((v) => v);

    // Calculate projected savings
    const pricingConfig =
      tierLevel === 'top'
        ? SUBSCRIPTION_PRICING.annual_subscription.top_expert
        : SUBSCRIPTION_PRICING.annual_subscription.community_expert;

    const commissionOnlyRate =
      tierLevel === 'top'
        ? SUBSCRIPTION_PRICING.commission_based.top_expert.commissionRate
        : SUBSCRIPTION_PRICING.commission_based.community_expert.commissionRate;

    // Projected annual commissions (commission-only plan)
    const projectedAnnualCommissions = Math.round(avgMonthlyRevenue * 12 * commissionOnlyRate);

    // Projected annual cost (annual subscription plan)
    const projectedAnnualCost =
      pricingConfig.annualFee + Math.round(avgMonthlyRevenue * 12 * pricingConfig.commissionRate);

    // Savings
    const annualSavings = projectedAnnualCommissions - projectedAnnualCost;
    const savingsPercentage =
      projectedAnnualCommissions > 0 ? annualSavings / projectedAnnualCommissions : 0;

    return {
      isEligible,
      tierLevel: tierLevel as 'community' | 'top',
      meetsRequirements,
      currentMetrics: {
        monthsActive,
        avgMonthlyRevenue,
        totalBookings,
        currentRating,
      },
      projectedSavings: {
        annualCommissions: projectedAnnualCommissions,
        annualSavings,
        savingsPercentage,
      },
      breakEvenMonthlyRevenue: pricingConfig.breakEvenMonthlyRevenue,
    };
  } catch (error) {
    logger.error('Error checking eligibility', { error });
    Sentry.captureException(error);
    throw error;
  }
  });
}

// ============================================================================
// Update Eligibility Metrics
// ============================================================================

/**
 * Update eligibility metrics for a user in the database
 *
 * Called by cron job to keep eligibility data fresh
 *
 * @param workosUserId - The WorkOS user ID
 * @returns Success status
 */
export async function updateEligibilityMetrics(workosUserId: string): Promise<boolean> {
  return Sentry.withServerActionInstrumentation('updateEligibilityMetrics', { recordResponse: true }, async () => {
  try {
    // Get eligibility status
    const eligibility = await checkAnnualEligibility(workosUserId);

    // Get user's organization
    const membership = await db.query.UserOrgMembershipsTable.findFirst({
      where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
      columns: { orgId: true },
    });

    if (!membership?.orgId) {
      logger.error('No organization found for user', { workosUserId });
      return false;
    }

    // Get commissions data (last 90 days and all-time)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const allCommissions = await db.query.TransactionCommissionsTable.findMany({
      where: eq(TransactionCommissionsTable.workosUserId, workosUserId),
      columns: {
        commissionAmount: true,
        createdAt: true,
      },
    });

    const recentCommissions = allCommissions.filter((c) => c.createdAt >= ninetyDaysAgo);

    const totalCommissionsPaid = allCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const commissionsLast90Days = recentCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);

    // Check if record exists
    const existingRecord = await db.query.AnnualPlanEligibilityTable.findFirst({
      where: eq(AnnualPlanEligibilityTable.workosUserId, workosUserId),
    });

    const eligibilityData = {
      workosUserId,
      orgId: membership.orgId,
      monthsActive: eligibility.currentMetrics.monthsActive,
      totalBookings: eligibility.currentMetrics.totalBookings,
      bookingsLast90Days: eligibility.currentMetrics.totalBookings, // TODO: Calculate separately
      avgMonthlyRevenue: eligibility.currentMetrics.avgMonthlyRevenue,
      totalCommissionsPaid,
      commissionsLast90Days,
      currentRating: Math.round(eligibility.currentMetrics.currentRating * 100), // Store as integer (450 = 4.50)
      isEligible: eligibility.isEligible,
      eligibleSince:
        eligibility.isEligible && !existingRecord?.isEligible
          ? new Date()
          : existingRecord?.eligibleSince,
      tierLevel: eligibility.tierLevel,
      projectedAnnualCommissions: eligibility.projectedSavings.annualCommissions,
      projectedAnnualSavings: eligibility.projectedSavings.annualSavings,
      savingsPercentage: Math.round(eligibility.projectedSavings.savingsPercentage * 10000), // Store as basis points
      breakEvenMonthlyRevenue: eligibility.breakEvenMonthlyRevenue,
      lastCalculated: new Date(),
      calculationVersion: 1,
      updatedAt: new Date(),
    };

    if (existingRecord) {
      // Update existing record
      await db
        .update(AnnualPlanEligibilityTable)
        .set(eligibilityData)
        .where(eq(AnnualPlanEligibilityTable.id, existingRecord.id));
    } else {
      // Create new record
      await db.insert(AnnualPlanEligibilityTable).values({
        ...eligibilityData,
        createdAt: new Date(),
      });
    }

    logger.info('Updated eligibility metrics for user', { workosUserId });
    return true;
  } catch (error) {
    logger.error('Error updating eligibility metrics', { error });
    Sentry.captureException(error);
    return false;
  }
  });
}

// ============================================================================
// Get Eligibility Status from Database
// ============================================================================

/**
 * Get cached eligibility status from database
 *
 * Faster than checkAnnualEligibility() as it uses pre-calculated data
 *
 * @param workosUserId - The WorkOS user ID
 * @returns Eligibility data from database or null if not found
 */
export async function getEligibilityStatus(
  workosUserId: string,
): Promise<EligibilityStatus | null> {
  return Sentry.withServerActionInstrumentation('getEligibilityStatus', { recordResponse: true }, async () => {
    try {
      const eligibility = await db.query.AnnualPlanEligibilityTable.findFirst({
        where: eq(AnnualPlanEligibilityTable.workosUserId, workosUserId),
      });

      if (!eligibility) {
        return null;
      }

      const criteria =
        eligibility.tierLevel === 'top'
          ? SUBSCRIPTION_PRICING.eligibility.top_expert
          : SUBSCRIPTION_PRICING.eligibility.community_expert;

      return {
        isEligible: eligibility.isEligible || false,
        tierLevel: eligibility.tierLevel as 'community' | 'top',
        meetsRequirements: {
          monthsActive: (eligibility.monthsActive || 0) >= criteria.minMonthsActive,
          avgMonthlyRevenue: (eligibility.avgMonthlyRevenue || 0) >= criteria.minAvgMonthlyRevenue,
          totalBookings: (eligibility.totalBookings || 0) >= criteria.minCompletedAppointments,
          rating: (eligibility.currentRating || 0) / 100 >= criteria.minRating,
        },
        currentMetrics: {
          monthsActive: eligibility.monthsActive || 0,
          avgMonthlyRevenue: eligibility.avgMonthlyRevenue || 0,
          totalBookings: eligibility.totalBookings || 0,
          currentRating: (eligibility.currentRating || 0) / 100,
        },
        projectedSavings: {
          annualCommissions: eligibility.projectedAnnualCommissions || 0,
          annualSavings: eligibility.projectedAnnualSavings || 0,
          savingsPercentage: (eligibility.savingsPercentage || 0) / 10000,
        },
        breakEvenMonthlyRevenue: eligibility.breakEvenMonthlyRevenue || 0,
      };
    } catch (error) {
      logger.error('Error getting eligibility status', { error });
      Sentry.captureException(error);
      return null;
    }
  });
}
