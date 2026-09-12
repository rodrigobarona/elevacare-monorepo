import { executeTransfer, listScheduledDuePayouts } from "@eleva/billing/server"

export async function processExpertTransfers(): Promise<{
  transferred: number
  failed: number
  skipped: number
}> {
  const due = await listScheduledDuePayouts()
  let transferred = 0
  let failed = 0
  let skipped = 0
  for (const row of due) {
    const result = await executeTransfer(row.id)
    if (result.status === "transferred") transferred += 1
    else if (result.status === "failed") failed += 1
    else skipped += 1
  }
  return { transferred, failed, skipped }
}
