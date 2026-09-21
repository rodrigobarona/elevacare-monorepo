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
      await scheduleActiveBookingReminders(event)
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

async function scheduleActiveBookingReminders(event: {
  type: string
  orgId: string
  payload: Record<string, unknown>
}): Promise<void> {
  const parsed = parseBookingNotificationPayload(event.type, event.payload)
  await scheduleBookingReminders({
    bookingId: parsed.bookingId,
    orgId: event.orgId,
    startsAt: new Date(parsed.startsAt),
  })
}
