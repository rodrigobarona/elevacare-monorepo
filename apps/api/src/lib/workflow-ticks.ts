/**
 * Jobs that share a cadence run in one tick (`/workflows/tick/{cadence}`),
 * scheduled by Vercel Cron in `apps/api/vercel.json`. Daily, monthly and
 * payout jobs keep their own QStash schedules (infra/qstash).
 */
import { POST as accountDeletionSweep } from "@/app/workflows/account-deletion-sweep/route"
import { POST as auditOutboxDrainer } from "@/app/workflows/audit-outbox-drainer/route"
import { POST as bookingRequestExpiry } from "@/app/workflows/booking-request-expiry/route"
import { POST as crmFollowUpDue } from "@/app/workflows/crm-follow-up-due/route"
import { POST as domainEventsPublisher } from "@/app/workflows/domain-events-publisher/route"
import { POST as invoicingRetry } from "@/app/workflows/invoicing-retry/route"
import { POST as slotReservationExpiry } from "@/app/workflows/slot-reservation-expiry/route"
import { POST as stripeStuckEvents } from "@/app/workflows/stripe-stuck-events/route"
import { POST as videoAttendanceSweep } from "@/app/workflows/video-attendance-sweep/route"
import { POST as videoEjectRetry } from "@/app/workflows/video-eject-retry/route"
import { POST as videoRoomSweep } from "@/app/workflows/video-room-sweep/route"

export const WORKFLOW_TICKS = {
  minutely: {
    "slot-reservation-expiry": slotReservationExpiry,
    "booking-request-expiry": bookingRequestExpiry,
    "domain-events-publisher": domainEventsPublisher,
    "video-eject-retry": videoEjectRetry,
  },
  "10min": {
    "stripe-stuck-events": stripeStuckEvents,
    "video-room-sweep": videoRoomSweep,
    "video-attendance-sweep": videoAttendanceSweep,
  },
  hourly: {
    "audit-outbox-drainer": auditOutboxDrainer,
    "account-deletion-sweep": accountDeletionSweep,
    "crm-follow-up-due": crmFollowUpDue,
    "invoicing-retry": invoicingRetry,
  },
} as const satisfies Record<
  string,
  Record<string, (request: Request) => Promise<Response>>
>

export type WorkflowTickCadence = keyof typeof WORKFLOW_TICKS

export function isWorkflowTickCadence(
  value: string
): value is WorkflowTickCadence {
  return Object.hasOwn(WORKFLOW_TICKS, value)
}
