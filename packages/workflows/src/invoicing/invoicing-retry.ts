import {
  backfillMissingPlatformFeeInvoices,
  emptyPlatformFeeBackfillResult,
  retryFailedExpertInvoices,
  type InvoicingRetryResult,
  type PlatformFeeBackfillResult,
} from "@eleva/accounting"

export async function processInvoicingRetry(): Promise<
  InvoicingRetryResult & { platformFeeBackfill: PlatformFeeBackfillResult }
> {
  const result = await retryFailedExpertInvoices()
  let platformFeeBackfill = emptyPlatformFeeBackfillResult()
  try {
    platformFeeBackfill = await backfillMissingPlatformFeeInvoices()
  } catch (err) {
    console.error("[invoicing-retry] platform-fee backfill failed", err)
    platformFeeBackfill.errors += 1
  }
  return { ...result, platformFeeBackfill }
}
