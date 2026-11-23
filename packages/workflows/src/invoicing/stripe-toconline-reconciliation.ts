import { runStripeToconlineReconciliation } from "@eleva/accounting"
import { captureException } from "@eleva/observability"

const RECONCILIATION_PROBE = "stripe-toconline-reconciliation"

/**
 * QStash cron + `runInternalWorkflow` (D-18). Not Vercel Workflows DevKit.
 * Compares ledgers only; never POSTs TOConline sales documents.
 */
export async function processStripeToconlineReconciliation(
  input: {
    month?: string
    now?: Date
  } = {}
): Promise<{
  month: string
  status: "matched" | "mismatch"
  mismatchBps: number
  missingInvoiceCount: number
}> {
  const run = await runStripeToconlineReconciliation(input)
  if (run.status === "mismatch") {
    try {
      await captureException(
        new Error("stripe_toconline_reconciliation_mismatch"),
        {
          probe: RECONCILIATION_PROBE,
          month: run.month,
          mismatchBps: run.mismatchBps,
          missingInvoiceCount: run.details.missingInvoiceCount,
        }
      )
    } catch (err) {
      console.error("[stripe-toconline-reconciliation] alert failed", err)
    }
  }
  return {
    month: run.month,
    status: run.status,
    mismatchBps: run.mismatchBps,
    missingInvoiceCount: run.details.missingInvoiceCount,
  }
}
