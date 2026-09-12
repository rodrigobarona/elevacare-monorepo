import { promoteEligiblePendingPayouts } from "@eleva/billing/server"

export async function processPendingPayouts(): Promise<{ promoted: number }> {
  const promoted = await promoteEligiblePendingPayouts()
  return { promoted }
}
