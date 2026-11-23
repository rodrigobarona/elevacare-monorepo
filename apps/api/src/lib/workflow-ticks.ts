/**
 * The jobs of the hourly tick (`/workflows/tick/hourly`), scheduled by
 * Vercel Cron in `apps/api/vercel.json`. Daily, monthly and payout jobs
 * keep their own QStash schedules (infra/qstash).
 *
 * There is one tick, and it is hourly, on purpose: see
 * `@eleva/config/background-jobs`. A job here is the net under its work.
 * Where a person would notice an hour, the work is started when it is
 * created or falls due (`./run-job-at.ts`, `./publish-domain-events.ts`).
 */
import type { JobsInTick, TickCadence } from "@eleva/config/background-jobs"
import { POST as accountDeletionSweep } from "@/app/workflows/account-deletion-sweep/route"
import { POST as auditOutboxDrainer } from "@/app/workflows/audit-outbox-drainer/route"
import { POST as bookingRequestExpiry } from "@/app/workflows/booking-request-expiry/route"
import { POST as crmFollowUpDue } from "@/app/workflows/crm-follow-up-due/route"
import { POST as domainEventsPublisher } from "@/app/workflows/domain-events-publisher/route"
import { POST as invoicingRetry } from "@/app/workflows/invoicing-retry/route"
import { POST as seatSyncSweep } from "@/app/workflows/seat-sync-sweep/route"
import { POST as slotReservationExpiry } from "@/app/workflows/slot-reservation-expiry/route"
import { POST as stripeStuckEvents } from "@/app/workflows/stripe-stuck-events/route"
import { POST as videoAttendanceSweep } from "@/app/workflows/video-attendance-sweep/route"
import { POST as videoEjectRetry } from "@/app/workflows/video-eject-retry/route"
import { POST as videoRoomSweep } from "@/app/workflows/video-room-sweep/route"

export const WORKFLOW_TICKS = {
  hourly: {
    "slot-reservation-expiry": slotReservationExpiry,
    "booking-request-expiry": bookingRequestExpiry,
    "domain-events-publisher": domainEventsPublisher,
    "video-eject-retry": videoEjectRetry,
    "stripe-stuck-events": stripeStuckEvents,
    "video-room-sweep": videoRoomSweep,
    "video-attendance-sweep": videoAttendanceSweep,
    "seat-sync-sweep": seatSyncSweep,
    "audit-outbox-drainer": auditOutboxDrainer,
    "account-deletion-sweep": accountDeletionSweep,
    "crm-follow-up-due": crmFollowUpDue,
    "invoicing-retry": invoicingRetry,
  },
  // The jobs of each tick are those `@eleva/config/background-jobs` lists
  // under that cadence: one more, one fewer or one moved does not compile.
} as const satisfies {
  [Cadence in TickCadence]: Record<
    JobsInTick<Cadence>,
    (request: Request) => Promise<Response>
  >
}

export type WorkflowTickCadence = keyof typeof WORKFLOW_TICKS

export function isWorkflowTickCadence(
  value: string
): value is WorkflowTickCadence {
  return Object.hasOwn(WORKFLOW_TICKS, value)
}
