import type { Tx } from "@eleva/db/context"
import type {
  AvailabilityRule,
  DateOverride,
  EventType,
  ReservationFunnelSnapshot,
  Schedule,
} from "@eleva/db/schema"

export interface TimeSlot {
  start: Date
  end: Date
}

export interface BusyInterval {
  start: Date
  end: Date
}

export interface GetAvailableSlotsInput {
  eventType: Pick<
    EventType,
    | "durationMinutes"
    | "bookingWindowDays"
    | "minimumNoticeMinutes"
    | "bufferBeforeMinutes"
    | "bufferAfterMinutes"
  >
  schedule: Pick<Schedule, "timezone">
  rules: Pick<AvailabilityRule, "dayOfWeek" | "startTime" | "endTime">[]
  overrides: Pick<
    DateOverride,
    "overrideDate" | "startTime" | "endTime" | "isBlocked"
  >[]
  existingBookings: BusyInterval[]
  externalBusyTimes: BusyInterval[]
  rangeStart: Date
  rangeEnd: Date
  /**
   * Step between candidate starts. `getAvailableSlots` defaults this to the
   * event duration. `getAvailableSlotsForOffer` defaults to 30 minutes
   * (Phase 4 marketplace grid) unless overridden.
   */
  slotIntervalMinutes?: number
}

export interface ReserveSlotInput {
  eventTypeId: string
  expertProfileId: string
  expertUserId: string
  orgId: string
  startsAt: Date
  endsAt: Date
  holdToken: string
  ttlSeconds?: number
  userId?: string
  eventTypeModeId?: string
  price?: { cents: number; currency: "EUR" }
  funnel?: ReservationFunnelSnapshot
  afterInsert?: (tx: Tx, reservationId: string) => Promise<void>
  audit?: {
    actorUserId?: string | null
    payload?: Record<string, unknown>
  }
}

export type ReserveSlotResult =
  | { success: true; reservationId: string; reservationToken: string }
  | {
      success: false
      error: "slot_taken" | "conflict" | "db_error" | "link_unusable"
    }

export interface BookingRuleCheck {
  eventType: Pick<
    EventType,
    | "bookingWindowDays"
    | "minimumNoticeMinutes"
    | "cancellationWindowHours"
    | "rescheduleWindowHours"
  >
  slotStart: Date
  now?: Date
}

export type BookingRuleError =
  | "outside_booking_window"
  | "insufficient_notice"
  | "past_slot"
