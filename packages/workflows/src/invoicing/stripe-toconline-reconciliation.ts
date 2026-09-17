import { runStripeToconlineReconciliation } from "@eleva/accounting"
import { captureException, heartbeat } from "@eleva/observability"

const RECONCILIATION_HEARTBEAT = "stripe-toconline-reconciliation"

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
          probe: RECONCILIATION_HEARTBEAT,
          month: run.month,
          mismatchBps: run.mismatchBps,
          missingInvoiceCount: run.details.missingInvoiceCount,
        }
      )
    } catch (err) {
      console.error("[stripe-toconline-reconciliation] alert failed", err)
    }
  }
  try {
    await heartbeat(RECONCILIATION_HEARTBEAT)
  } catch (err) {
    console.error("[stripe-toconline-reconciliation] heartbeat failed", err)
  }
  return {
    month: run.month,
    status: run.status,
    mismatchBps: run.mismatchBps,
    missingInvoiceCount: run.details.missingInvoiceCount,
  }
}
