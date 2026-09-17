import { retryFailedExpertInvoices } from "@eleva/accounting"
import { heartbeat } from "@eleva/observability"

export async function processInvoicingRetry(): Promise<{
  scanned: number
  retried: number
  skipped: number
  blocked: number
  deadLettered: number
  errors: number
}> {
  const result = await retryFailedExpertInvoices()
  try {
    await heartbeat("invoicing-retry")
  } catch (err) {
    console.error("[invoicing-retry] heartbeat failed", err)
  }
  return result
}
