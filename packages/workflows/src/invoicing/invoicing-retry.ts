import {
  backfillMissingPlatformFeeInvoices,
  retryFailedExpertInvoices,
  type InvoicingRetryResult,
  type PlatformFeeBackfillResult,
} from "@eleva/accounting"
import { captureException } from "@eleva/observability"

export async function processInvoicingRetry(): Promise<
  InvoicingRetryResult & { platformFeeBackfill: PlatformFeeBackfillResult }
> {
  const result = await retryFailedExpertInvoices()
  let platformFeeBackfill: PlatformFeeBackfillResult
  try {
    platformFeeBackfill = await backfillMissingPlatformFeeInvoices()
  } catch (err) {
    // The expert-invoice part above has run and stands. The backfill as a
    // whole did not, so the run failed: thrown on, the route answers 500
    // and the run is reported as failed. The next hourly run tries again.
    await captureException(err, {
      workflow: "invoicingRetry",
      step: "platformFeeBackfill",
    })
    throw err
  }
  return { ...result, platformFeeBackfill }
}
