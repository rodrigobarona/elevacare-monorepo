import type { ElevaSession } from "@eleva/auth"
import { resolveFinanceScope } from "@eleva/auth/finance-scope"
import { financeSummary, listFinanceBookings } from "@eleva/billing/server"

/**
 * The finance page's cards and booking rows, scoped like
 * `GET /me/finance/summary`: a clinic clinician sees only bookings where
 * they are the expert, never the clinic's books. Null when a clinician has
 * no expert profile in this clinic.
 */
export async function loadFinanceOverview(session: ElevaSession) {
  const scope = await resolveFinanceScope(session)
  if (!scope) return null
  const [summary, bookings] = await Promise.all([
    financeSummary(session.orgId, scope),
    listFinanceBookings(session.orgId, scope),
  ])
  return { summary, bookings }
}
