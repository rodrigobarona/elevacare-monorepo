import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organizations } from "./organizations"
import { expertProfiles, sessionModeEnum } from "./expert-profiles"
import { eventTypes } from "./event-types"
import { users } from "./users"

export const bookingStatusEnum = pgEnum("booking_status", [
  "slot_reserved",
  "awaiting_payment",
  "awaiting_confirmation",
  "confirmed",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
])

export const slotReservationStatusEnum = pgEnum("slot_reservation_status", [
  "active",
  "expired",
  "converted",
  "released",
])

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
])

/**
 * Short-lived slot lock created during the booking/payment flow.
 * TTL is 5 minutes (enforced by the slotReservationExpiry workflow).
 * Atomic creation via Upstash Redis SET NX + DB transaction.
 *
 * org_id = expert's org (the reservation blocks expert time).
 */
export const slotReservations = pgTable(
  "slot_reservations",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),

    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    status: slotReservationStatusEnum("status").notNull().default("active"),

    /** Set when this reservation converts into a booking. */
    bookingId: uuid("booking_id").references(() => bookings.id),

    /** Opaque token identifying the user session holding this lock. */
    holdToken: varchar("hold_token", { length: 64 }).notNull(),

    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("slot_reservations_org_idx").on(t.orgId),
    expertIdx: index("slot_reservations_expert_idx").on(t.expertProfileId),
    activeIdx: index("slot_reservations_active_idx")
      .on(t.expertProfileId, t.startsAt)
      .where(sql`status = 'active'`),
    holdIdx: index("slot_reservations_hold_idx").on(t.holdToken),
    expiresActiveIdx: index("slot_reservations_expires_active_idx")
      .on(t.expiresAt)
      .where(sql`status = 'active'`),
    tenantPolicy: pgPolicy("slot_reservations_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

/**
 * Customer-facing commercial commitment tied to a specific slot and
 * event type. org_id = expert's org. Patient access via application-
 * layer queries using withPlatformAdminContext + patient_user_id filter.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id),

    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),

    status: bookingStatusEnum("status").notNull().default("slot_reserved"),
    sessionMode: sessionModeEnum("session_mode").notNull(),

    priceAmount: integer("price_amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("eur"),
    bookedLocale: varchar("booked_locale", { length: 5 }),

    /** Stripe references (populated in Sprint 4). */
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }),

    /** Self-reference for rescheduled bookings. */
    rescheduledFromId: uuid("rescheduled_from_id").references(
      (): AnyPgColumn => bookings.id
    ),

    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("bookings_org_idx").on(t.orgId),
    expertIdx: index("bookings_expert_idx").on(t.expertProfileId),
    patientIdx: index("bookings_patient_idx").on(t.patientUserId),
    statusIdx: index("bookings_status_idx").on(t.status),
    timeIdx: index("bookings_time_idx").on(t.expertProfileId, t.startsAt),
    stripePaymentIdx: uniqueIndex("bookings_stripe_payment_idx")
      .on(t.stripePaymentIntentId)
      .where(sql`stripe_payment_intent_id IS NOT NULL`),
    tenantPolicy: pgPolicy("bookings_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

/**
 * Operational meeting record. Grows after the booking is made with
 * session-specific data (Daily room, transcript, notes, reports).
 *
 * org_id = expert's org.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organizations.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id),

    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    sessionMode: sessionModeEnum("session_mode").notNull(),

    status: sessionStatusEnum("status").notNull().default("scheduled"),

    /** Daily.co room details (populated on booking confirmation). */
    dailyRoomUrl: text("daily_room_url"),
    dailyRoomName: varchar("daily_room_name", { length: 255 }),

    /** External calendar event ID for the destination calendar write. */
    calendarEventId: varchar("calendar_event_id", { length: 255 }),

    /** Vault refs for sensitive session artifacts (Sprint 5). */
    transcriptVaultRef: text("transcript_vault_ref"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("sessions_org_idx").on(t.orgId),
    bookingIdx: index("sessions_booking_idx").on(t.bookingId),
    expertIdx: index("sessions_expert_idx").on(t.expertProfileId),
    patientIdx: index("sessions_patient_idx").on(t.patientUserId),
    timeIdx: index("sessions_time_idx").on(t.startsAt),
    tenantPolicy: pgPolicy("sessions_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type SlotReservation = typeof slotReservations.$inferSelect
export type NewSlotReservation = typeof slotReservations.$inferInsert
export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number]
export type SlotReservationStatus =
  (typeof slotReservationStatusEnum.enumValues)[number]
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number]
