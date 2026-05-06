import type {
  AvailabilityRule,
  DateOverride,
  EventType,
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
}

export interface ReserveSlotInput {
  eventTypeId: string
  expertProfileId: string
  orgId: string
  startsAt: Date
  endsAt: Date
  holdToken: string
  ttlSeconds?: number
}

export type ReserveSlotResult =
  | { success: true; reservationId: string }
  | { success: false; error: "slot_taken" | "conflict" | "db_error" }

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
