import { db } from '@/drizzle/db';
import { PaymentTransfersTable } from '@/drizzle/schema';
import { PAYMENT_TRANSFER_STATUS_COMPLETED } from '@/lib/constants/payment-transfers';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

type CheckResult = {
  existingTransferId: string | null;
  shouldCreateTransfer: boolean;
};

/**
 * Check if a Stripe transfer already exists for a given charge.
 * This prevents duplicate transfers when webhooks have already processed the payment.
 *
 * For destination charges, checks charge.transfer.
 * For separate charges & transfers, falls back to listing transfers by source_transaction.
 *
 * If a transfer exists, updates the database record with the existing transfer ID
 * and marks it as COMPLETED.
 *
 * @param stripe - Stripe instance
 * @param chargeId - The Stripe charge ID to check
 * @param transferRecord - The database transfer record to update if needed
 * @returns CheckResult with existing transfer ID (if any) and whether to create a new transfer
 */
export async function checkExistingTransfer(
  stripe: Stripe,
  chargeId: string,
  transferRecord: { id: number; paymentIntentId: string },
): Promise<CheckResult> {
  // Retrieve the charge to check if it has any transfers already
  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ['transfer'],
  });

  // Check if a transfer already exists for this charge (destination charges)
  if (charge.transfer) {
    const existingTransferId =
      typeof charge.transfer === 'string' ? charge.transfer : charge.transfer.id;

    console.log(
      `⚠️ Transfer ${existingTransferId} already exists for charge ${chargeId} (destination charge), skipping creation`,
    );

    // Update our database record with the existing transfer ID
    await db
      .update(PaymentTransfersTable)
      .set({
        status: PAYMENT_TRANSFER_STATUS_COMPLETED,
        transferId: existingTransferId,
        updated: new Date(),
      })
      .where(eq(PaymentTransfersTable.id, transferRecord.id));

    console.log(
      `✅ Updated database record ${transferRecord.id} with existing transfer ID: ${existingTransferId}`,
    );

    return {
      existingTransferId,
      shouldCreateTransfer: false,
    };
  }

  // For separate charges & transfers, charge.transfer is null
  // Fall back to listing transfers by source_transaction
  console.log(
    `Charge ${chargeId} has no transfer property, checking for separate transfers by source_transaction`,
  );

  // source_transaction is a valid Stripe API parameter but may not be in TypeScript definitions
  const transfersList = await stripe.transfers.list({
    source_transaction: chargeId,
    limit: 10, // Check up to 10 transfers (should typically be 0 or 1)
  } as Stripe.TransferListParams);

  // Check if any of the returned transfers match our payment criteria
  for (const transfer of transfersList.data) {
    // Match by payment transfer ID or payment intent ID in metadata
    const matchesPaymentTransferId =
      transfer.metadata?.paymentTransferId === transferRecord.id.toString();
    const matchesPaymentIntentId =
      transfer.metadata?.paymentIntentId === transferRecord.paymentIntentId;

    if (matchesPaymentTransferId || matchesPaymentIntentId) {
      console.log(
        `⚠️ Transfer ${transfer.id} already exists for charge ${chargeId} (separate charge & transfer), skipping creation`,
      );

      // Update our database record with the existing transfer ID
      await db
        .update(PaymentTransfersTable)
        .set({
          status: PAYMENT_TRANSFER_STATUS_COMPLETED,
          transferId: transfer.id,
          updated: new Date(),
        })
        .where(eq(PaymentTransfersTable.id, transferRecord.id));

      console.log(
        `✅ Updated database record ${transferRecord.id} with existing transfer ID: ${transfer.id}`,
      );

      return {
        existingTransferId: transfer.id,
        shouldCreateTransfer: false,
      };
    }
  }

  // Log if we found transfers but none matched (edge case, might indicate data issues)
  if (transfersList.data.length > 0) {
    console.log(
      `Found ${transfersList.data.length} transfer(s) for charge ${chargeId}, but none matched our payment criteria`,
    );
  }

  return {
    existingTransferId: null,
    shouldCreateTransfer: true,
  };
}
