import type { Tx } from "../context"
import { domainEventWritten } from "../domain-event-signal"
import * as main from "../schema/main"

/**
 * The staff decision on a clinic's legal identity, as a domain event. The
 * notification subscriber tells the people who manage the clinic.
 */
export const CLINIC_DECISION_EVENT_TYPES = [
  "clinic.verified",
  "clinic.needs_changes",
  "clinic.rejected",
] as const

export type ClinicDecisionEventType =
  (typeof CLINIC_DECISION_EVENT_TYPES)[number]

export type ClinicDecisionPayload = {
  verificationId: string
  /** What staff found; set when a change is asked or the filing refused. */
  reason: string | null
  /**
   * Whether the clinic is verified once this decision is recorded: a clinic
   * verified before stays verified when newer details are not confirmed.
   */
  verified: boolean
}

const SEND_NOTIFICATION_SUBSCRIBER = "send-notification"

/**
 * Writes the event and its notification delivery in the decision's own
 * transaction, so a decision is never recorded without its notice queued.
 */
export async function _emitClinicDecisionEvent(
  tx: Tx,
  input: ClinicDecisionPayload & {
    orgId: string
    type: ClinicDecisionEventType
    reviewedAt: Date
  }
): Promise<void> {
  domainEventWritten()
  const [event] = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: input.type,
      payload: {
        verificationId: input.verificationId,
        reason: input.reason,
        verified: input.verified,
      } satisfies ClinicDecisionPayload,
      idempotencyKey: `${input.type}:${input.verificationId}:${input.reviewedAt.getTime()}`,
    })
    .returning({ id: main.domainEventsOutbox.id })
  await tx.insert(main.domainEventDeliveries).values({
    orgId: input.orgId,
    eventId: event!.id,
    subscriberId: SEND_NOTIFICATION_SUBSCRIBER,
    status: "pending",
  })
}
