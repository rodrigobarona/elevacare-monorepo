import {
  isBookingNotificationKind,
  isClosedGateKind,
  sendBookingNotification,
  sendClosedGateInvoiceNotification,
} from "@eleva/notifications"
import type { DomainEventSubscriber } from "../domain-events"

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
    await sendBookingNotification({
      id: event.id,
      type: event.type,
      orgId: event.orgId,
      payload: event.payload,
    })
    return
  }
  throw new Error(`send-notification: unsupported event type ${event.type}`)
}
