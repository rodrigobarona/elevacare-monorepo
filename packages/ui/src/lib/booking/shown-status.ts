/**
 * The status to show for a booking.
 *
 * Nothing marks a booking "completed" when its time has passed: it stays
 * `confirmed` (or `rescheduled`). Shown as it is, a session from last month
 * says "Confirmed", as if it were still to come. Once the booked end has
 * passed, those two are shown as `completed`. Every other status is shown
 * as it is stored.
 *
 * It is a matter of display only: the stored status is not changed, and
 * nothing here says whether the two people met.
 */
export function shownBookingStatus(
  status: string,
  endsAt: Date | string,
  now: Date = new Date()
): string {
  if (status !== "confirmed" && status !== "rescheduled") return status
  const end = endsAt instanceof Date ? endsAt.getTime() : Date.parse(endsAt)
  // An end time that cannot be read changes nothing.
  if (!Number.isFinite(end)) return status
  return end <= now.getTime() ? "completed" : status
}
