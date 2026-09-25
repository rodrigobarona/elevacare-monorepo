import {
  backfillMissingPlatformFeeInvoices,
  emptyPlatformFeeBackfillResult,
  retryFailedExpertInvoices,
  type InvoicingRetryResult,
  type PlatformFeeBackfillResult,
} from "@eleva/accounting"
import { heartbeat } from "@eleva/observability"

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
  try {
    await heartbeat("invoicing-retry")
  } catch (err) {
    console.error("[invoicing-retry] heartbeat failed", err)
  }
  return { ...result, platformFeeBackfill }
}
