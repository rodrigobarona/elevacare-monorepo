import type { getAuthedApiClient } from "./member-api"

export async function findMemberBooking(
  api: Awaited<ReturnType<typeof getAuthedApiClient>>,
  bookingId: string
) {
  for (const range of ["upcoming", "past"] as const) {
    let cursor: string | undefined
    const seenCursors = new Set<string>()
    while (true) {
      if (cursor) {
        if (seenCursors.has(cursor)) break
        seenCursors.add(cursor)
      }
      const result = await api.me.listBookings({ range, cursor })
      const found = result.bookings.find((booking) => booking.id === bookingId)
      if (found) return found
      if (!result.nextCursor) break
      cursor = result.nextCursor
    }
  }
  return null
}
