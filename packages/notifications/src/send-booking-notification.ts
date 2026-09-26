import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  describeCancellationPolicy,
  type CancellationPolicy,
} from "@eleva/config/cancellation-policy"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import {
  getEmailTranslations,
  renderBookingCancelled,
  renderBookingConfirmed,
  renderBookingReminder,
  renderBookingRescheduled,
  type EmailLocale,
} from "@eleva/email"
import { sendNotification } from "./send-notification"
import { toEmailLocale } from "./send-closed-gate-invoice"

export const BOOKING_NOTIFICATION_KINDS = [
  "booking.confirmed",
  "booking.cancelled",
  "booking.rescheduled",
] as const

export const BOOKING_REMINDER_KINDS = [
  "booking.reminder_24h",
  "booking.reminder_1h",
] as const

export type BookingNotificationKind =
  (typeof BOOKING_NOTIFICATION_KINDS)[number]

export type BookingReminderKind = (typeof BOOKING_REMINDER_KINDS)[number]

export type BookingSendKind = BookingNotificationKind | BookingReminderKind

const BOOKING_SEND_KINDS = [
  ...BOOKING_NOTIFICATION_KINDS,
  ...BOOKING_REMINDER_KINDS,
] as const

const BookingPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  startsAt: z.string().datetime(),
  occurredAt: z.string().datetime(),
  previousStartsAt: z.string().datetime().optional(),
  scheduleRevision: z.number().int().positive().optional(),
})

export type ParsedBookingNotificationPayload = z.infer<
  typeof BookingPayloadSchema
>

export function parseBookingNotificationPayload(
  type: string,
  payload: Record<string, unknown>
): ParsedBookingNotificationPayload {
  const parsed = BookingPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error("send-notification: booking payload is invalid")
  }
  if (
    type === "booking.rescheduled" &&
    (!parsed.data.previousStartsAt || parsed.data.scheduleRevision == null)
  ) {
    throw new Error(
      "send-notification: reschedule payload missing previousStartsAt or scheduleRevision"
    )
  }
  return parsed.data
}

export type BookingNotificationEvent = {
  id: string
  type: string
  orgId: string
  payload: Record<string, unknown>
}

const BOOKING_KIND_SET = new Set<string>(BOOKING_NOTIFICATION_KINDS)
const BOOKING_SEND_SET = new Set<string>(BOOKING_SEND_KINDS)

export function isBookingNotificationKind(
  type: string
): type is BookingNotificationKind {
  return BOOKING_KIND_SET.has(type)
}

export function isBookingSendKind(type: string): type is BookingSendKind {
  return BOOKING_SEND_SET.has(type)
}

type BookingSendDeps = {
  loadBooking?: typeof loadBookingForNotification
  send?: typeof sendNotification
}

export type LoadedBooking = {
  id: string
  orgId: string
  status: string
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: string
  bookedLocale: string | null
  memberUserId: string | null
  memberEmail: string | null
  memberName: string | null
  guestEmail: string | null
  guestName: string | null
  expertUserId: string
  expertEmail: string
  expertName: string
  eventTypeName: { en: string; pt?: string; es?: string }
  scheduleRevision: number
  cancellationPolicy: CancellationPolicy
  currency: string
  /** Cumulative refund target set on cancel; null when no refund was decided. */
  refundDueCents: number | null
}

export async function sendBookingNotification(
  event: BookingNotificationEvent,
  deps: BookingSendDeps = {}
): Promise<void> {
  if (!isBookingSendKind(event.type)) {
    throw new Error(
      `send-notification: unsupported booking event ${event.type}`
    )
  }
  const parsed = parseBookingNotificationPayload(event.type, event.payload)
  const loadBooking = deps.loadBooking ?? loadBookingForNotification
  const send = deps.send ?? sendNotification
  const booking = await loadBooking(parsed.bookingId)
  if (!booking || booking.orgId !== event.orgId) {
    throw new Error("send-notification: booking not found for event org")
  }
  if (!eventMatchesBooking(event.type, booking, parsed)) {
    return
  }

  const locale = toEmailLocale(booking.bookedLocale)
  const expertFirst = firstName(booking.expertName)
  const memberFirst = firstName(
    booking.memberName ?? booking.guestName ?? "member"
  )
  const snapshotStartsAt = new Date(parsed.startsAt)
  const formattedDate = formatDateTime(
    snapshotStartsAt,
    booking.timezone,
    locale
  )
  const eventTypeName = localizedTitle(booking.eventTypeName, locale)
  const t = getEmailTranslations(locale)
  const previousDate = parsed.previousStartsAt
    ? formatDateTime(
        new Date(parsed.previousStartsAt),
        booking.timezone,
        locale
      )
    : formattedDate
  const html = await renderBookingHtml({
    kind: event.type,
    memberName: memberFirst,
    eventTypeName,
    formattedDate,
    previousDate,
    sessionMode: booking.sessionMode,
    locale,
    cancellationPolicyName: describeCancellationPolicy(
      booking.cancellationPolicy,
      locale
    ).name,
    refundAmount:
      booking.refundDueCents === null
        ? undefined
        : formatMoney(booking.refundDueCents, booking.currency, locale),
  })
  const title = titleForKind(event.type, t.booking)
  const memberBody = memberSessionBody(locale, expertFirst, formattedDate)
  const expertSubject = subjectForKind(
    event.type,
    t.subject,
    memberFirst,
    formattedDate
  )
  const memberSubject = `${title} — ${formattedDate}`
  const expertBody = expertSubject

  const memberRecipient = booking.memberUserId
    ? { userId: booking.memberUserId }
    : booking.guestEmail
      ? { email: booking.guestEmail, locale }
      : null
  if (!memberRecipient) {
    throw new Error("send-notification: booking has no member recipient")
  }

  const idempotencyKey = deliveryIdempotencyKey(
    event.type,
    booking.id,
    parsed.startsAt,
    parsed.previousStartsAt,
    parsed.scheduleRevision
  )
  const results = await Promise.allSettled([
    send({
      kind: event.type,
      orgId: event.orgId,
      recipient: memberRecipient,
      ctx: { title, body: memberBody, subject: memberSubject, html },
      idempotencyKey,
    }),
    send({
      kind: event.type,
      orgId: event.orgId,
      recipient: { userId: booking.expertUserId },
      ctx: { title, body: expertBody, subject: expertSubject, html },
      idempotencyKey,
    }),
  ])
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  )
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "booking notification delivery failed"
    )
  }
}

function eventMatchesBooking(
  kind: BookingSendKind,
  booking: LoadedBooking,
  payload: { startsAt: string; scheduleRevision?: number }
): boolean {
  switch (kind) {
    case "booking.confirmed":
      return booking.status === "confirmed"
    case "booking.cancelled":
      return booking.status === "cancelled"
    case "booking.reminder_24h":
    case "booking.reminder_1h":
      return (
        (booking.status === "confirmed" || booking.status === "rescheduled") &&
        booking.startsAt.toISOString() === payload.startsAt
      )
    case "booking.rescheduled": {
      if (booking.status !== "rescheduled") return false
      if (booking.startsAt.toISOString() !== payload.startsAt) return false
      return payload.scheduleRevision === booking.scheduleRevision
    }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

function deliveryIdempotencyKey(
  kind: BookingSendKind,
  bookingId: string,
  startsAt: string,
  previousStartsAt?: string,
  scheduleRevision?: number
): string {
  const suffix = kind.slice("booking.".length)
  if (kind === "booking.rescheduled") {
    if (!previousStartsAt) {
      throw new Error("booking.rescheduled requires previousStartsAt")
    }
    if (scheduleRevision === undefined) {
      throw new Error("booking.rescheduled requires scheduleRevision")
    }
    return `booking:${bookingId}:${suffix}:${previousStartsAt}:${startsAt}:${scheduleRevision}`
  }
  if (kind === "booking.reminder_24h" || kind === "booking.reminder_1h") {
    return `booking:${bookingId}:${suffix}:${startsAt}`
  }
  return `booking:${bookingId}:${suffix}`
}

function memberSessionBody(
  locale: EmailLocale,
  expertFirst: string,
  formattedDate: string
): string {
  switch (locale) {
    case "pt":
      return `A sua sessão com ${expertFirst} — ${formattedDate}`
    case "es":
      return `Tu sesión con ${expertFirst} — ${formattedDate}`
    case "en":
      return `Your session with ${expertFirst} — ${formattedDate}`
    default: {
      const _exhaustive: never = locale
      return _exhaustive
    }
  }
}

function titleForKind(
  kind: BookingSendKind,
  booking: {
    confirmedTitle: string
    rescheduledTitle: string
    cancelledTitle: string
    reminder24hTitle: string
    reminder1hTitle: string
  }
): string {
  switch (kind) {
    case "booking.confirmed":
      return booking.confirmedTitle
    case "booking.cancelled":
      return booking.cancelledTitle
    case "booking.rescheduled":
      return booking.rescheduledTitle
    case "booking.reminder_24h":
      return booking.reminder24hTitle
    case "booking.reminder_1h":
      return booking.reminder1hTitle
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

function subjectForKind(
  kind: BookingSendKind,
  subject: {
    newBooking: (member: string, date: string) => string
    rescheduled: (member: string, date: string) => string
    cancelled: (member: string, date: string) => string
    reminder24h: (member: string, date: string) => string
    reminder1h: (member: string, date: string) => string
  },
  memberFirst: string,
  formattedDate: string
): string {
  switch (kind) {
    case "booking.confirmed":
      return subject.newBooking(memberFirst, formattedDate)
    case "booking.cancelled":
      return subject.cancelled(memberFirst, formattedDate)
    case "booking.rescheduled":
      return subject.rescheduled(memberFirst, formattedDate)
    case "booking.reminder_24h":
      return subject.reminder24h(memberFirst, formattedDate)
    case "booking.reminder_1h":
      return subject.reminder1h(memberFirst, formattedDate)
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

async function renderBookingHtml(input: {
  kind: BookingSendKind
  memberName: string
  eventTypeName: string
  formattedDate: string
  previousDate: string
  sessionMode: string
  locale: EmailLocale
  cancellationPolicyName: string
  refundAmount?: string
}): Promise<string> {
  switch (input.kind) {
    case "booking.confirmed":
      return renderBookingConfirmed({
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
      })
    case "booking.cancelled":
      return renderBookingCancelled({
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        cancellationPolicyName: input.cancellationPolicyName,
        refundAmount: input.refundAmount,
        locale: input.locale,
      })
    case "booking.rescheduled":
      return renderBookingRescheduled({
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        previousDate: input.previousDate,
        newDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
      })
    case "booking.reminder_24h":
      return renderBookingReminder({
        window: "24h",
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
      })
    case "booking.reminder_1h":
      return renderBookingReminder({
        window: "1h",
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
      })
    default: {
      const _exhaustive: never = input.kind
      return _exhaustive
    }
  }
}

function firstName(value: string): string {
  const token = value.trim().split(/\s+/)[0]
  return token || "member"
}

function localizedTitle(
  title: { en: string; pt?: string; es?: string },
  locale: EmailLocale
): string {
  if (locale === "pt" && title.pt) return title.pt
  if (locale === "es" && title.es) return title.es
  return title.en
}

const LOCALE_MAP: Record<EmailLocale, string> = {
  en: "en-GB",
  pt: "pt-PT",
  es: "es-ES",
}

function formatDateTime(date: Date, tz: string, locale: EmailLocale): string {
  try {
    return date.toLocaleString(LOCALE_MAP[locale] ?? "en-GB", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return date.toISOString()
  }
}

function formatMoney(cents: number, currency: string, locale: EmailLocale) {
  return new Intl.NumberFormat(LOCALE_MAP[locale], {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export async function loadBookingForNotification(
  bookingId: string
): Promise<LoadedBooking | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        status: main.bookings.status,
        startsAt: main.bookings.startsAt,
        endsAt: main.bookings.endsAt,
        timezone: main.bookings.timezone,
        sessionMode: main.bookings.sessionMode,
        bookedLocale: main.bookings.bookedLocale,
        memberUserId: main.bookings.memberUserId,
        guestEmail: main.bookings.guestEmail,
        guestName: main.bookings.guestName,
        expertUserId: main.bookings.expertUserId,
        eventTypeName: main.eventTypes.title,
        scheduleRevision: main.bookings.scheduleRevision,
        cancellationPolicy: main.bookings.cancellationPolicy,
        currency: main.bookings.currency,
        refundDueCents: main.bookingPayments.refundDueCents,
      })
      .from(main.bookings)
      .innerJoin(
        main.eventTypes,
        eq(main.eventTypes.id, main.bookings.eventTypeId)
      )
      .leftJoin(
        main.bookingPayments,
        eq(main.bookingPayments.bookingId, main.bookings.id)
      )
      .where(eq(main.bookings.id, bookingId))
      .limit(1)
    if (!row) return null

    const [expert] = await tx
      .select({
        email: auth.user.email,
        name: auth.user.name,
      })
      .from(auth.user)
      .where(eq(auth.user.id, row.expertUserId))
      .limit(1)
    if (!expert?.email) return null

    let memberEmail: string | null = null
    let memberName: string | null = null
    if (row.memberUserId) {
      const [member] = await tx
        .select({
          email: auth.user.email,
          name: auth.user.name,
        })
        .from(auth.user)
        .where(eq(auth.user.id, row.memberUserId))
        .limit(1)
      memberEmail = member?.email ?? null
      memberName = member?.name ?? null
    }

    return {
      ...row,
      memberEmail,
      memberName,
      expertEmail: expert.email,
      expertName: expert.name,
    }
  })
}
