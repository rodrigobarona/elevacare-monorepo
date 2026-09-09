import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  char,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organization, user } from "../auth"
import { expertProfiles, sessionModeEnum } from "./expert-profiles"
import { eventTypes } from "./event-types"
import { bookingLinks, eventTypeModes } from "./offer-model"

export const bookingStatusEnum = pgEnum("booking_status", [
  "slot_reserved",
  "awaiting_payment",
  "awaiting_confirmation",
  "reserved",
  "pending_payment",
  "confirmed",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
  "refunded",
])

export const slotReservationStatusEnum = pgEnum("slot_reservation_status", [
  "active",
  "reserved",
  "expired",
  "converted",
  "released",
  "released_while_processing",
])

export const bookingPaymentStatusEnum = pgEnum("booking_payment_status", [
  "intent_pending",
  "requires_payment",
  "succeeded",
  "failed",
  "refunded",
])

export const consentSubjectKindEnum = pgEnum("consent_subject_kind", [
  "user",
  "guest",
])

export const consentSourceEnum = pgEnum("consent_source", [
  "funnel",
  "account",
  "import",
])

export const consentKindEnum = pgEnum("consent_kind", [
  "terms",
  "privacy",
  "health_data_processing",
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
    orgId: orgIdColumn().references(() => organization.id, {
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

    /** sha256 of the one-time reservationToken; never the raw token. */
    capabilityHash: char("capability_hash", { length: 64 }).notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    expertUserId: uuid("expert_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }),
    eventTypeModeId: uuid("event_type_mode_id"),
    priceCents: integer("price_cents"),
    currency: varchar("currency", { length: 3 }),

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
    stripePiIdx: uniqueIndex("slot_reservations_stripe_pi_idx")
      .on(t.stripePaymentIntentId)
      .where(sql`stripe_payment_intent_id IS NOT NULL`),
    priceChk: check(
      "slot_reservations_price_cents",
      sql`price_cents IS NULL OR price_cents >= 0`
    ),
    currencyChk: check(
      "slot_reservations_currency_eur",
      sql`currency IS NULL OR currency = 'EUR'`
    ),
    priceCurrencyChk: check(
      "slot_reservations_price_currency",
      sql`(price_cents IS NULL) = (currency IS NULL)`
    ),
    modeFk: foreignKey({
      name: "slot_reservations_mode_fk",
      columns: [t.orgId, t.eventTypeModeId],
      foreignColumns: [eventTypeModes.orgId, eventTypeModes.id],
    }).onDelete("restrict"),
    // SQL 0028 adds EXCLUDE USING gist (expert_user_id, tstzrange).
    tenantPolicy: pgPolicy("slot_reservations_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

/**
 * Customer-facing commercial commitment tied to a specific slot and
 * event type. org_id = expert's org. Member access via application-
 * layer queries using withPlatformAdminContext + member_user_id filter.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id),
    memberUserId: uuid("member_user_id").references(() => user.id),
    reservationId: uuid("reservation_id").references(
      (): AnyPgColumn => slotReservations.id,
      { onDelete: "restrict" }
    ),
    counterpartyOrgId: uuid("counterparty_org_id").references(
      () => organization.id,
      { onDelete: "set null" }
    ),
    expertUserId: uuid("expert_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    guestEmail: varchar("guest_email", { length: 320 }),
    guestName: varchar("guest_name", { length: 200 }),
    guestPhone: varchar("guest_phone", { length: 32 }),
    eventTypeModeId: uuid("event_type_mode_id"),
    language: varchar("language", { length: 16 }),
    memberCountry: varchar("member_country", { length: 2 }),
    bookingLinkId: uuid("booking_link_id"),
    priceCents: integer("price_cents").notNull(),

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
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
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
    memberIdx: index("bookings_member_idx").on(t.memberUserId),
    statusIdx: index("bookings_status_idx").on(t.status),
    timeIdx: index("bookings_time_idx").on(t.expertProfileId, t.startsAt),
    stripePaymentIdx: uniqueIndex("bookings_stripe_payment_idx")
      .on(t.stripePaymentIntentId)
      .where(sql`stripe_payment_intent_id IS NOT NULL`),
    counterpartyIdx: index("bookings_counterparty_org_idx")
      .on(t.counterpartyOrgId)
      .where(sql`counterparty_org_id IS NOT NULL`),
    reservationKey: unique("bookings_reservation_id_key").on(t.reservationId),
    priceChk: check("bookings_price_cents", sql`price_cents >= 0`),
    priceMatchChk: check(
      "bookings_price_amount_match",
      sql`price_cents = price_amount`
    ),
    currencyChk: check("bookings_currency_eur", sql`currency = 'EUR'`),
    countryChk: check(
      "bookings_member_country",
      sql`member_country IS NULL OR member_country ~ '^[A-Z]{2}$'`
    ),
    guestOrMemberChk: check(
      "bookings_guest_or_member",
      sql`member_user_id IS NOT NULL OR guest_email IS NOT NULL`
    ),
    modeFk: foreignKey({
      name: "bookings_mode_fk",
      columns: [t.orgId, t.eventTypeModeId],
      foreignColumns: [eventTypeModes.orgId, eventTypeModes.id],
    }).onDelete("restrict"),
    linkFk: foreignKey({
      name: "bookings_link_fk",
      columns: [t.orgId, t.bookingLinkId],
      foreignColumns: [bookingLinks.orgId, bookingLinks.id],
    }).onDelete("set null"),
    dualOrgPolicy: pgPolicy("bookings_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR counterparty_org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR counterparty_org_id::text = current_setting('eleva.org_id', true)`,
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
    orgId: orgIdColumn().references(() => organization.id, {
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
    memberUserId: uuid("member_user_id")
      .notNull()
      .references(() => user.id),

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
    memberIdx: index("sessions_member_idx").on(t.memberUserId),
    timeIdx: index("sessions_time_idx").on(t.startsAt),
    tenantPolicy: pgPolicy("sessions_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export const bookingPayments = pgTable(
  "booking_payments",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    status: bookingPaymentStatusEnum("status")
      .notNull()
      .default("intent_pending"),
    amountCents: integer("amount_cents").notNull(),
    applicationFeeCents: integer("application_fee_cents").notNull().default(0),
    transferGroup: varchar("transfer_group", { length: 255 }),
    stripeIdempotencyKey: varchar("stripe_idempotency_key", {
      length: 255,
    }).notNull(),
    paymentMethodType: varchar("payment_method_type", { length: 64 }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    refundedCents: integer("refunded_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => ({
    orgIdx: index("booking_payments_org_idx").on(t.orgId),
    bookingKey: unique("booking_payments_booking_id_key").on(t.bookingId),
    stripePiIdx: uniqueIndex("booking_payments_stripe_pi_idx")
      .on(t.stripePaymentIntentId)
      .where(sql`stripe_payment_intent_id IS NOT NULL`),
    idempotencyIdx: uniqueIndex("booking_payments_idempotency_idx").on(
      t.stripeIdempotencyKey
    ),
    amountChk: check("booking_payments_amount", sql`amount_cents >= 0`),
    feeChk: check("booking_payments_fee", sql`application_fee_cents >= 0`),
    refundedChk: check("booking_payments_refunded", sql`refunded_cents >= 0`),
    tenantPolicy: pgPolicy("booking_payments_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export const consents = pgTable(
  "consents",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    subjectKind: consentSubjectKindEnum("subject_kind").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    guestEmailHash: char("guest_email_hash", { length: 64 }),
    kind: consentKindEnum("kind").notNull(),
    documentVersion: text("document_version").notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    source: consentSourceEnum("source").notNull(),
    reservationId: uuid("reservation_id").references(
      () => slotReservations.id,
      {
        onDelete: "set null",
      }
    ),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .default(sql`now()`),
    withdrawnAt: timestamp("withdrawn_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (t) => ({
    orgIdx: index("consents_org_idx").on(t.orgId),
    userIdx: index("consents_user_idx").on(t.userId),
    reservationIdx: index("consents_reservation_idx").on(t.reservationId),
    subjectChk: check(
      "consents_subject",
      sql`(subject_kind = 'user' AND user_id IS NOT NULL) OR (subject_kind = 'guest' AND guest_email_hash IS NOT NULL)`
    ),
    tenantPolicy: pgPolicy("consents_tenant_isolation", {
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
