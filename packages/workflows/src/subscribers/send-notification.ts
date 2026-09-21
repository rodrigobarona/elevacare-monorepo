import {
  isBookingNotificationKind,
  isClosedGateKind,
  isPaymentPayoutNotificationKind,
  parseBookingNotificationPayload,
  sendBookingNotification,
  sendClosedGateInvoiceNotification,
  sendPaymentPayoutNotification,
} from "@eleva/notifications"
import type { DomainEventSubscriber } from "../domain-events"
import { scheduleBookingReminders } from "../notifications/reminders"

export const handleSendNotification: DomainEventSubscriber = async (event) => {
  if (isClosedGateKind(event.type)) {
    await sendClosedGateInvoiceNotification({
      id: event.id,
      type: event.type,
      orgId: event.orgId,
      payload: event.payload,
    })
    return
  }
  if (isBookingNotificationKind(event.type)) {
    if (
      event.type === "booking.confirmed" ||
      event.type === "booking.rescheduled"
    ) {
      const parsed = parseBookingNotificationPayload(event.type, event.payload)
      const results = await Promise.allSettled([
        scheduleBookingReminders({
          bookingId: parsed.bookingId,
          orgId: event.orgId,
          startsAt: new Date(parsed.startsAt),
        }),
        sendBookingNotification({
          id: event.id,
          type: event.type,
          orgId: event.orgId,
          payload: event.payload,
        }),
      ])
      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      )
      if (failures.length > 0) {
        throw new AggregateError(
          failures.map((failure) => failure.reason),
          "send-notification: booking reminder schedule or send failed"
        )
      }
      return
    }
    await sendBookingNotification({
      id: event.id,
      type: event.type,
      orgId: event.orgId,
      payload: event.payload,
    })
    return
  }
  if (isPaymentPayoutNotificationKind(event.type)) {
    await sendPaymentPayoutNotification({
      id: event.id,
      type: event.type,
      orgId: event.orgId,
      payload: event.payload,
    })
    return
  }
  throw new Error(`send-notification: unsupported event type ${event.type}`)
}
