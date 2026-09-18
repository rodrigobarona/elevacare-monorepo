import { sendClosedGateInvoiceNotification } from "@eleva/notifications"
import type { DomainEventSubscriber } from "../domain-events"

export const handleSendNotification: DomainEventSubscriber = async (event) => {
  await sendClosedGateInvoiceNotification({
    id: event.id,
    type: event.type,
    orgId: event.orgId,
    payload: event.payload,
  })
}
