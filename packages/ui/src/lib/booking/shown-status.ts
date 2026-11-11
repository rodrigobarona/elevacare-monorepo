/**
 * The status to show for a booking.
 *
 * Nothing marks a booking as over when its time has passed: it stays
 * `confirmed` (or `rescheduled`). Shown as it is, a session from last month
 * says "Confirmed", as if it were still to come. Once it is over, those two
 * are shown as `ended`. Every other status is shown as it is stored.
 *
 * `ended` is a display value, not a stored status, and it only says the
 * time has passed. It is not "completed": for a phone or in-person session
 * nobody records whether the two met, and an online session can have ended
 * with one of them absent.
 *
 * `graceMs` keeps the stored status a little longer: an online session can
 * still be joined for a while after its booked end, and "Ended" beside a
 * working Join button would be wrong.
 */
export function shownBookingStatus(
  status: string,
  endsAt: Date | string,
  options: { graceMs?: number; now?: Date } = {}
): string {
  if (status !== "confirmed" && status !== "rescheduled") return status
  const end = endsAt instanceof Date ? endsAt.getTime() : Date.parse(endsAt)
  // An end time that cannot be read changes nothing.
  if (!Number.isFinite(end)) return status
  const now = (options.now ?? new Date()).getTime()
  return end + (options.graceMs ?? 0) <= now ? "ended" : status
}
