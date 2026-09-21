/**
 * Direct Resend ICS mail is retired for Lane 1. Booking confirm / cancel /
 * reschedule emails go through `sendNotification`. ICS attachments land in a
 * later Phase 08 slice on that path. Callers keep the same function names so
 * calendar-optional fallbacks and member routes stay compile-clean.
 */

export interface IcsEmailPayload {
  expertEmail: string
  expertName: string
  memberName: string
  memberEmail: string
  eventTypeName: string
  bookingId: string
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: string
  location?: string
  locale?: "en" | "pt" | "es"
  sequence?: number
}

/** @deprecated Use `sendNotification` via the booking domain-event subscriber. */
export async function sendBookingIcsEmail(
  _payload: IcsEmailPayload
): Promise<void> {
  return
}

/** @deprecated Use `sendNotification` via the booking domain-event subscriber. */
export async function sendRescheduleIcsEmail(
  _payload: IcsEmailPayload,
  _previousStartsAt: Date
): Promise<void> {
  return
}

/** @deprecated Use `sendNotification` via the booking domain-event subscriber. */
export async function sendCancellationIcsEmail(
  _payload: IcsEmailPayload
): Promise<void> {
  return
}
