import { listUpcomingPayouts } from "@eleva/billing/server"

export async function checkUpcomingPayouts(): Promise<{ upcoming: number }> {
  const upcoming = await listUpcomingPayouts(48)
  return { upcoming: upcoming.length }
}
