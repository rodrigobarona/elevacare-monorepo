/**
 * QStash schedules per cadence (see `POST /workflows/tick/{cadence}`). The
 * plan's schedule quota (10) is smaller than the number of recurring jobs,
 * so jobs that share a cadence share one schedule. Daily and payout jobs
 * keep their own schedules (infra/qstash).
 */
import { POST as accountDeletionSweep } from "@/app/workflows/account-deletion-sweep/route"
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
