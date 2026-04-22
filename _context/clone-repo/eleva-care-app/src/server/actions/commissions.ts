/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * 💰 COMMISSION RATE DETERMINATION:
 *
 * Solo Experts (type: 'expert_individual'):
 * ----------------------------------------
 * Commission rate = f(Expert Role, Subscription Plan)
 *
 * Community Expert (role: 'expert_community'):
 *   • Commission-only plan → 20%
 *   • Monthly subscription → 12% (saves 40%)
 *   • Annual subscription → 12% (saves 40%)
 *
 * Top Expert (role: 'expert_top'):
 *   • Commission-only plan → 15%
 *   • Monthly subscription → 8% (saves 47%)
 *   • Annual subscription → 8% (saves 47%)
 *
 * Clinics (type: 'clinic') - Future:
 * ----------------------------------
 * Each expert in the clinic keeps their INDIVIDUAL commission rate
 * based on their own role, regardless of the clinic's subscription.
 *
 * Example:
 *   Clinic subscribes to workspace plan ($99/month)
 *   ├─ Dr. Maria (expert_top) → 8% commission on her bookings
 *   ├─ Dr. João (expert_community) → 12% on his bookings
 *   └─ Commission per expert ensures fair compensation
 *
 * 🎯 WHY PER-EXPERT RATES IN CLINICS?
 * - Fair compensation (top experts earned their lower rates)
 * - Talent retention (experts keep benefits when joining clinics)
 * - Growth incentive (community → top progression)
 * - Industry standard (Cal.com, Vercel use similar models)
 *
 * 📊 CALCULATION LOGIC:
 * 1. Patient books appointment → Payment succeeds
 * 2. recordCommission() called with booking details
 * 3. Lookup expert's role from UsersTable
 * 4. Lookup org subscription from SubscriptionPlansTable
 * 5. Determine commission rate based on role + plan type
 * 6. Calculate: commission = bookingAmount × rate
 * 7. Record transaction with metadata (tierLevel, planType)
 * 8. Expert receives: bookingAmount - commission
 *
 * Used by:
 * - Stripe webhook (when payment_intent.succeeded)
 * - Financial reporting and analytics
 * - Eligibility calculations for subscription upgrades
 */

'use server';

import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import {
  MeetingsTable,
  SubscriptionPlansTable,
  TransactionCommissionsTable,
  UsersTable,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

const { logger } = Sentry;

import { getCurrentCommissionRate } from './subscriptions';

/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * 💰 COMMISSION RATE DETERMINATION:
 *
 * Solo Experts (type: 'expert_individual'):
 * ----------------------------------------
 * Commission rate = f(Expert Role, Subscription Plan)
 *
 * Community Expert (role: 'expert_community'):
 *   • Commission-only plan → 20%
 *   • Monthly subscription → 12% (saves 40%)
 *   • Annual subscription → 12% (saves 40%)
 *
 * Top Expert (role: 'expert_top'):
 *   • Commission-only plan → 15%
 *   • Monthly subscription → 8% (saves 47%)
 *   • Annual subscription → 8% (saves 47%)
 *
 * Clinics (type: 'clinic') - Future:
 * ----------------------------------
 * Each expert in the clinic keeps their INDIVIDUAL commission rate
 * based on their own role, regardless of the clinic's subscription.
 *
 * Example:
 *   Clinic subscribes to workspace plan ($99/month)
 *   ├─ Dr. Maria (expert_top) → 8% commission on her bookings
 *   ├─ Dr. João (expert_community) → 12% on his bookings
 *   └─ Commission per expert ensures fair compensation
 *
 * 🎯 WHY PER-EXPERT RATES IN CLINICS?
 * - Fair compensation (top experts earned their lower rates)
 * - Talent retention (experts keep benefits when joining clinics)
 * - Growth incentive (community → top progression)
 * - Industry standard (Cal.com, Vercel use similar models)
 *
 * 📊 CALCULATION LOGIC:
 * 1. Patient books appointment → Payment succeeds
 * 2. recordCommission() called with booking details
 * 3. Lookup expert's role from UsersTable
 * 4. Lookup org subscription from SubscriptionPlansTable
 * 5. Determine commission rate based on role + plan type
 * 6. Calculate: commission = bookingAmount × rate
 * 7. Record transaction with metadata (tierLevel, planType)
 * 8. Expert receives: bookingAmount - commission
 *
 * Used by:
 * - Stripe webhook (when payment_intent.succeeded)
 * - Financial reporting and analytics
 * - Eligibility calculations for subscription upgrades
 */

/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * 💰 COMMISSION RATE DETERMINATION:
 *
 * Solo Experts (type: 'expert_individual'):
 * ----------------------------------------
 * Commission rate = f(Expert Role, Subscription Plan)
 *
 * Community Expert (role: 'expert_community'):
 *   • Commission-only plan → 20%
 *   • Monthly subscription → 12% (saves 40%)
 *   • Annual subscription → 12% (saves 40%)
 *
 * Top Expert (role: 'expert_top'):
 *   • Commission-only plan → 15%
 *   • Monthly subscription → 8% (saves 47%)
 *   • Annual subscription → 8% (saves 47%)
 *
 * Clinics (type: 'clinic') - Future:
 * ----------------------------------
 * Each expert in the clinic keeps their INDIVIDUAL commission rate
 * based on their own role, regardless of the clinic's subscription.
 *
 * Example:
 *   Clinic subscribes to workspace plan ($99/month)
 *   ├─ Dr. Maria (expert_top) → 8% commission on her bookings
 *   ├─ Dr. João (expert_community) → 12% on his bookings
 *   └─ Commission per expert ensures fair compensation
 *
 * 🎯 WHY PER-EXPERT RATES IN CLINICS?
 * - Fair compensation (top experts earned their lower rates)
 * - Talent retention (experts keep benefits when joining clinics)
 * - Growth incentive (community → top progression)
 * - Industry standard (Cal.com, Vercel use similar models)
 *
 * 📊 CALCULATION LOGIC:
 * 1. Patient books appointment → Payment succeeds
 * 2. recordCommission() called with booking details
 * 3. Lookup expert's role from UsersTable
 * 4. Lookup org subscription from SubscriptionPlansTable
 * 5. Determine commission rate based on role + plan type
 * 6. Calculate: commission = bookingAmount × rate
 * 7. Record transaction with metadata (tierLevel, planType)
 * 8. Expert receives: bookingAmount - commission
 *
 * Used by:
 * - Stripe webhook (when payment_intent.succeeded)
 * - Financial reporting and analytics
 * - Eligibility calculations for subscription upgrades
 */

/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * 💰 COMMISSION RATE DETERMINATION:
 *
 * Solo Experts (type: 'expert_individual'):
 * ----------------------------------------
 * Commission rate = f(Expert Role, Subscription Plan)
 *
 * Community Expert (role: 'expert_community'):
 *   • Commission-only plan → 20%
 *   • Monthly subscription → 12% (saves 40%)
 *   • Annual subscription → 12% (saves 40%)
 *
 * Top Expert (role: 'expert_top'):
 *   • Commission-only plan → 15%
 *   • Monthly subscription → 8% (saves 47%)
 *   • Annual subscription → 8% (saves 47%)
 *
 * Clinics (type: 'clinic') - Future:
 * ----------------------------------
 * Each expert in the clinic keeps their INDIVIDUAL commission rate
 * based on their own role, regardless of the clinic's subscription.
 *
 * Example:
 *   Clinic subscribes to workspace plan ($99/month)
 *   ├─ Dr. Maria (expert_top) → 8% commission on her bookings
 *   ├─ Dr. João (expert_community) → 12% on his bookings
 *   └─ Commission per expert ensures fair compensation
 *
 * 🎯 WHY PER-EXPERT RATES IN CLINICS?
 * - Fair compensation (top experts earned their lower rates)
 * - Talent retention (experts keep benefits when joining clinics)
 * - Growth incentive (community → top progression)
 * - Industry standard (Cal.com, Vercel use similar models)
 *
 * 📊 CALCULATION LOGIC:
 * 1. Patient books appointment → Payment succeeds
 * 2. recordCommission() called with booking details
 * 3. Lookup expert's role from UsersTable
 * 4. Lookup org subscription from SubscriptionPlansTable
 * 5. Determine commission rate based on role + plan type
 * 6. Calculate: commission = bookingAmount × rate
 * 7. Record transaction with metadata (tierLevel, planType)
 * 8. Expert receives: bookingAmount - commission
 *
 * Used by:
 * - Stripe webhook (when payment_intent.succeeded)
 * - Financial reporting and analytics
 * - Eligibility calculations for subscription upgrades
 */

/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * Used by:
 * - Payment processing (when booking payment succeeds)
 * - Financial reporting
 * - Eligibility calculations
 */

/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * Used by:
 * - Payment processing (when booking payment succeeds)
 * - Financial reporting
 * - Eligibility calculations
 */

/**
 * Commission Tracking Server Actions
 *
 * Records and tracks commission transactions for all expert bookings.
 * Integrates with subscription system to apply correct commission rates.
 *
 * Used by:
 * - Payment processing (when booking payment succeeds)
 * - Financial reporting
 * - Eligibility calculations
 */

// ============================================================================
// Types
// ============================================================================

export interface CommissionTransaction {
  id: string;
  workosUserId: string;
  meetingId: string;
  grossAmount: number; // Total booking amount in cents
  commissionRate: number; // Commission rate in basis points (e.g., 2000 = 20%)
  commissionAmount: number; // Commission amount in cents
  netAmount: number; // Amount expert receives in cents
  currency: string;
  status: 'pending' | 'processed' | 'refunded' | 'disputed';
  planTypeAtTransaction: 'commission' | 'monthly' | 'annual';
  tierLevelAtTransaction: 'community' | 'top';
  createdAt: Date;
}

// ============================================================================
// Record Commission Transaction
// ============================================================================

/**
 * Record a commission transaction when a payment is processed
 *
 * Called by Stripe webhook when payment_intent.succeeded
 *
 * @param meetingId - The meeting/booking ID
 * @param grossAmount - Total amount paid by customer (in cents)
 * @param currency - Currency code (e.g., 'usd', 'eur')
 * @param stripePaymentIntentId - Stripe Payment Intent ID
 * @param stripeTransferId - Stripe Transfer ID (optional)
 * @returns The created commission record
 */
export async function recordCommission(
  meetingId: string,
  grossAmount: number,
  currency: string,
  stripePaymentIntentId: string,
  stripeTransferId?: string,
): Promise<CommissionTransaction | null> {
  return Sentry.withServerActionInstrumentation('recordCommission', { recordResponse: true }, async () => {
  try {
    // Get meeting details
    const meeting = await db.query.MeetingsTable.findFirst({
      where: eq(MeetingsTable.id, meetingId),
      columns: {
        id: true,
        workosUserId: true,
        orgId: true,
        stripePaymentIntentId: true,
      },
    });

    if (!meeting) {
      logger.error('Meeting not found', { meetingId });
      return null;
    }

    // Validate required fields
    if (!meeting.orgId) {
      logger.error('Meeting missing orgId', { meetingId });
      return null;
    }

    if (!stripePaymentIntentId) {
      logger.error('Missing stripePaymentIntentId for meeting', { meetingId });
      return null;
    }

    // Check if commission already recorded
    const existingCommission = await db.query.TransactionCommissionsTable.findFirst({
      where: eq(TransactionCommissionsTable.meetingId, meetingId),
    });

    if (existingCommission) {
      logger.info('Commission already recorded for meeting', { meetingId });
      return {
        id: existingCommission.id,
        workosUserId: existingCommission.workosUserId,
        meetingId: existingCommission.meetingId,
        grossAmount: existingCommission.grossAmount,
        commissionRate: existingCommission.commissionRate,
        commissionAmount: existingCommission.commissionAmount,
        netAmount: existingCommission.netAmount,
        currency: existingCommission.currency,
        status: existingCommission.status as 'pending' | 'processed' | 'refunded' | 'disputed',
        planTypeAtTransaction: existingCommission.planTypeAtTransaction as
          | 'commission'
          | 'monthly'
          | 'annual',
        tierLevelAtTransaction: existingCommission.tierLevelAtTransaction as 'community' | 'top',
        createdAt: existingCommission.createdAt,
      };
    }

    // Get user's subscription to determine commission rate
    const commissionRateDecimal = await getCurrentCommissionRate(meeting.workosUserId);
    const commissionRateBasisPoints = Math.round(commissionRateDecimal * 10000); // Convert to basis points

    // Calculate commission and net amounts
    const commissionAmount = Math.round((grossAmount * commissionRateDecimal) / 100) * 100; // Round to nearest dollar
    const netAmount = grossAmount - commissionAmount;

    // Get expert's role to determine their tier level
    // This determines their commission rate regardless of organization type
    const user = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, meeting.workosUserId),
      columns: { role: true },
    });

    // 🎯 TIER LEVEL DETERMINATION
    // User's role determines their commission tier:
    // - expert_top / expert_lecturer → 'top' tier (8-18% commission)
    // - expert_community → 'community' tier (12-20% commission)
    //
    // For SOLO EXPERTS: This matches their org subscription tier (1:1)
    // For CLINICS (future): Each expert keeps their own tier regardless of org subscription
    const tierLevel =
      user?.role === 'expert_top' || user?.role === 'expert_lecturer' ? 'top' : 'community';

    // Get organization subscription to determine plan type
    // Plan type affects the commission rate (commission/monthly/annual)
    const orgSubscription = await db.query.SubscriptionPlansTable.findFirst({
      where: eq(SubscriptionPlansTable.orgId, meeting.orgId),
      columns: { planType: true },
    });

    // 💳 PLAN TYPE DETERMINATION
    // Defaults to 'commission' if no active subscription found
    // - 'commission': Pay per transaction only (20% or 18%)
    // - 'monthly': Fixed monthly fee + reduced rate (12% or 8%)
    // - 'annual': Fixed annual fee + lowest rate (12% or 8%)
    const planType = orgSubscription?.planType || 'commission';

    // Create commission record
    const [commission] = await db
      .insert(TransactionCommissionsTable)
      .values({
        workosUserId: meeting.workosUserId,
        orgId: meeting.orgId,
        meetingId,
        grossAmount,
        commissionRate: commissionRateBasisPoints,
        commissionAmount,
        netAmount,
        currency: currency.toLowerCase(),
        stripePaymentIntentId,
        stripeTransferId: stripeTransferId || undefined,
        status: 'processed' as const,
        processedAt: new Date(),
        planTypeAtTransaction: planType,
        tierLevelAtTransaction: tierLevel,
      })
      .returning();

    logger.info('Commission recorded', { commissionId: commission.id, commissionAmount });

    return {
      id: commission.id,
      workosUserId: commission.workosUserId,
      meetingId: commission.meetingId,
      grossAmount: commission.grossAmount,
      commissionRate: commission.commissionRate,
      commissionAmount: commission.commissionAmount,
      netAmount: commission.netAmount,
      currency: commission.currency,
      status: commission.status as 'pending' | 'processed' | 'refunded' | 'disputed',
      planTypeAtTransaction: commission.planTypeAtTransaction as 'commission' | 'annual',
      tierLevelAtTransaction: commission.tierLevelAtTransaction as 'community' | 'top',
      createdAt: commission.createdAt,
    };
  } catch (error) {
    logger.error('Error recording commission', { error });
    return null;
  }
  });
}

// ============================================================================
// Get Commission History
// ============================================================================

/**
 * Get commission history for a user
 *
 * @param workosUserId - The WorkOS user ID
 * @param limit - Maximum number of records to return
 * @returns Array of commission transactions
 */
export async function getCommissionHistory(
  workosUserId: string,
  limit: number = 50,
): Promise<CommissionTransaction[]> {
  return Sentry.withServerActionInstrumentation('getCommissionHistory', { recordResponse: true }, async () => {
  try {
    const commissions = await db.query.TransactionCommissionsTable.findMany({
      where: eq(TransactionCommissionsTable.workosUserId, workosUserId),
      orderBy: (commissions, { desc }) => [desc(commissions.createdAt)],
      limit,
    });

    return commissions.map((c) => ({
      id: c.id,
      workosUserId: c.workosUserId,
      meetingId: c.meetingId,
      grossAmount: c.grossAmount,
      commissionRate: c.commissionRate,
      commissionAmount: c.commissionAmount,
      netAmount: c.netAmount,
      currency: c.currency,
      status: c.status as 'pending' | 'processed' | 'refunded' | 'disputed',
      planTypeAtTransaction: c.planTypeAtTransaction as 'commission' | 'annual',
      tierLevelAtTransaction: c.tierLevelAtTransaction as 'community' | 'top',
      createdAt: c.createdAt,
    }));
  } catch (error) {
    logger.error('Error getting commission history', { error });
    return [];
  }
  });
}

// ============================================================================
// Calculate Total Commissions
// ============================================================================

/**
 * Calculate total commissions paid by a user
 *
 * @param workosUserId - The WorkOS user ID
 * @param startDate - Start date for calculation (optional)
 * @param endDate - End date for calculation (optional)
 * @returns Total commission amount in cents
 */
export async function calculateTotalCommissions(
  workosUserId: string,
  _startDate?: Date,
  _endDate?: Date,
): Promise<{
  totalCommissions: number;
  totalGrossRevenue: number;
  totalNetRevenue: number;
  transactionCount: number;
}> {
  return Sentry.withServerActionInstrumentation('calculateTotalCommissions', { recordResponse: true }, async () => {
  try {
    // TODO: Add date filtering when needed (using _startDate and _endDate)
    const commissions = await db.query.TransactionCommissionsTable.findMany({
      where: eq(TransactionCommissionsTable.workosUserId, workosUserId),
    });

    const totalCommissions = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const totalGrossRevenue = commissions.reduce((sum, c) => sum + c.grossAmount, 0);
    const totalNetRevenue = commissions.reduce((sum, c) => sum + c.netAmount, 0);

    return {
      totalCommissions,
      totalGrossRevenue,
      totalNetRevenue,
      transactionCount: commissions.length,
    };
  } catch (error) {
    logger.error('Error calculating total commissions', { error });
    return {
      totalCommissions: 0,
      totalGrossRevenue: 0,
      totalNetRevenue: 0,
      transactionCount: 0,
    };
  }
  });
}

// ============================================================================
// Mark Commission as Refunded
// ============================================================================

/**
 * Mark a commission as refunded (when booking is refunded)
 *
 * @param meetingId - The meeting ID
 * @returns Success status
 */
export async function markCommissionRefunded(meetingId: string): Promise<boolean> {
  return Sentry.withServerActionInstrumentation('markCommissionRefunded', { recordResponse: true }, async () => {
    try {
      const commission = await db.query.TransactionCommissionsTable.findFirst({
        where: eq(TransactionCommissionsTable.meetingId, meetingId),
      });

      if (!commission) {
        logger.error('Commission not found for meeting', { meetingId });
        return false;
      }

      await db
        .update(TransactionCommissionsTable)
        .set({
          status: 'refunded',
          refundedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(TransactionCommissionsTable.id, commission.id));

      logger.info('Commission marked as refunded', { commissionId: commission.id });
      return true;
    } catch (error) {
      logger.error('Error marking commission as refunded', { error });
      return false;
    }
  });
}
