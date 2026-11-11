import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  generateIcsCancel,
  generateIcsRequest,
  type IcsEventInput,
} from "@eleva/calendar/ics"
import {
  describeCancellationPolicy,
  type CancellationPolicy,
} from "@eleva/config/cancellation-policy"
import { expertProfileUrl, resolveGatewayUrl } from "@eleva/config/env"
import { guestSignupPath } from "@eleva/config/guest-signup"
import { maskPhone } from "@eleva/config/phone"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import {
  joinGrantExpUnix,
  mintJoinGrant as mintJoinGrantDefault,
  sessionJoinPath,
  type JoinGrantRole,
  type MintJoinGrantInput,
} from "@eleva/video/join-grant"
import {
  getEmailTranslations,
  renderBookingCancelled,
  renderBookingConfirmed,
  renderBookingReminder,
  renderBookingRescheduled,
  type EmailLocale,
  type SessionPlace,
} from "@eleva/email"
import type { EmailAttachment } from "./send-email"
import { sendNotification } from "./send-notification"
import { toEmailLocale } from "./send-closed-gate-invoice"

export const BOOKING_NOTIFICATION_KINDS = [
  "booking.confirmed",
  "booking.cancelled",
  "booking.rescheduled",
  "booking.requested",
  "booking.request_accepted",
  "booking.request_declined",
  "booking.request_expired",
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
  refundCents: z.number().int().nonnegative().optional(),
  cancelledBy: z.literal("expert").optional(),
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
  mintJoinGrant?: (input: MintJoinGrantInput) => Promise<string>
}

export type LoadedBooking = {
  id: string
  orgId: string
  orgSlug: string
  status: string
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: string
  bookedLocale: string | null
  memberUserId: string | null
  memberEmail: string | null
  memberName: string | null
  memberPhone: string | null
  memberEmailVerified: boolean
  guestEmail: string | null
  guestName: string | null
  guestPhone: string | null
  expertUserId: string
  expertEmail: string
  expertName: string
  /** The expert's public profile address, for "book a new time". */
  expertUsername?: string | null
  /** Expert's own language and time zone for their copy (UX-3-01/02). */
  expertLocale?: string | null
  expertTimezone?: string | null
  eventTypeName: { en: string; pt?: string; es?: string }
  scheduleRevision: number
  cancellationPolicy: CancellationPolicy
  currency: string
  priceCents: number
  language: string | null
  memberCountry: string | null
  location: {
    name: string
    address: string
    line2: string | null
    postalCode: string | null
    city: string
    latitude: number | null
    longitude: number | null
    instructions: { en: string; pt?: string; es?: string } | null
  } | null
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
  const mint = deps.mintJoinGrant ?? mintJoinGrantDefault
  const booking = await loadBooking(parsed.bookingId)
  if (!booking || booking.orgId !== event.orgId) {
    throw new Error("send-notification: booking not found for event org")
  }
  if (!eventMatchesBooking(event.type, booking, parsed)) {
    return
  }

  // Each copy speaks to its reader: the member in the language they
  // booked in and the time zone they chose; the expert in their own.
  const locale = toEmailLocale(booking.bookedLocale)
  const expertLocale = toEmailLocale(
    booking.expertLocale ?? booking.bookedLocale
  )
  const expertTimezone = booking.expertTimezone ?? booking.timezone
  const expertFirst = firstName(booking.expertName)
  const memberFullName = booking.memberName ?? booking.guestName ?? null
  const memberFirst = firstName(memberFullName ?? "member")
  const snapshotStartsAt = new Date(parsed.startsAt)
  const view = (viewLocale: EmailLocale, timezone: string) => {
    const formattedDate = formatDateTime(snapshotStartsAt, timezone, viewLocale)
    return {
      t: getEmailTranslations(viewLocale),
      formattedDate,
      previousDate: parsed.previousStartsAt
        ? formatDateTime(
            new Date(parsed.previousStartsAt),
            timezone,
            viewLocale
          )
        : formattedDate,
      eventTypeName: localizedTitle(booking.eventTypeName, viewLocale),
      cancellationPolicyName: describeCancellationPolicy(
        booking.cancellationPolicy,
        viewLocale
      ).name,
      place: sessionPlace(booking, viewLocale),
      refundAmount:
        parsed.refundCents === undefined
          ? undefined
          : formatMoney(parsed.refundCents, booking.currency, viewLocale),
      price:
        booking.priceCents > 0
          ? formatMoney(booking.priceCents, booking.currency, viewLocale)
          : getEmailTranslations(viewLocale).labels.free,
    }
  }
  // The expert cancelled: the emails say who, and the member's policy
  // (which binds the member, not the expert) is left out of them.
  const cancelledByExpert =
    event.type === "booking.cancelled" && parsed.cancelledBy === "expert"
  const memberView = view(locale, booking.timezone)
  const expertView = view(expertLocale, expertTimezone)
  const gateway = resolveGatewayUrl()
  const [memberJoinHref, expertJoinHref] = await Promise.all([
    sessionJoinHref(event.type, booking, "member", gateway, mint),
    sessionJoinHref(event.type, booking, "expert", gateway, mint),
  ])
  // When the expert cancelled, the first thing the member reads (subject,
  // push, text message) says who did, not just "cancelled".
  const title = cancelledByExpert
    ? memberView.t.booking.cancelledByExpertSubject(expertFirst)
    : titleForKind(event.type, memberView.t.booking)
  const expertTitle = titleForKind(event.type, expertView.t.booking)
  // Member subjects name the expert: "Booking confirmed · Ana · Monday…".
  const memberSubject = cancelledByExpert
    ? `${title} · ${memberView.formattedDate}`
    : `${title} · ${expertFirst} · ${memberView.formattedDate}`
  const expertSubject = subjectForKind(
    event.type,
    expertView.t.subject,
    memberFirst,
    expertView.formattedDate
  )
  const memberHtml = await renderBookingHtml({
    kind: event.type,
    place: memberView.place,
    memberName: memberFirst,
    eventTypeName: memberView.eventTypeName,
    formattedDate: memberView.formattedDate,
    previousDate: memberView.previousDate,
    sessionMode: booking.sessionMode,
    locale,
    cancellationPolicyName: memberView.cancellationPolicyName,
    refundAmount: memberView.refundAmount,
    cancelledByExpert,
    // The terms offer a new booking when the expert cancels: one tap away.
    rebookHref:
      cancelledByExpert && booking.expertUsername
        ? expertProfileUrl(locale, booking.expertUsername)
        : undefined,
    audience: "member",
    greetingName: memberFirst,
    expertName: booking.expertName,
    price: memberView.price,
    previewText: memberSubject,
    joinHref: memberJoinHref,
    activateHref: memberActivateHref(event.type, booking, gateway),
    maskedPhone:
      booking.sessionMode === "phone"
        ? maskMemberPhone(booking.guestPhone ?? booking.memberPhone)
        : undefined,
  })
  const expertHtml = await renderBookingHtml({
    kind: event.type,
    place: expertView.place,
    memberName: memberFullName ?? memberFirst,
    eventTypeName: expertView.eventTypeName,
    formattedDate: expertView.formattedDate,
    previousDate: expertView.previousDate,
    sessionMode: booking.sessionMode,
    locale: expertLocale,
    cancellationPolicyName: expertView.cancellationPolicyName,
    refundAmount: expertView.refundAmount,
    cancelledByExpert,
    joinHref: expertJoinHref,
    audience: "expert",
    greetingName: expertFirst,
    previewText: expertSubject,
    memberEmail: booking.memberEmail ?? booking.guestEmail ?? undefined,
    memberPhone: booking.guestPhone ?? booking.memberPhone ?? undefined,
    duration: formatDuration(booking.startsAt, booking.endsAt, expertLocale),
    timezone: expertTimezone,
    language: formatLanguage(booking.language, expertLocale),
    country: formatCountry(booking.memberCountry, expertLocale),
    price: expertView.price,
    calendarHref: `${gateway.replace(/\/$/, "")}/${booking.orgSlug}/team/calendar`,
  })
  // The text message and the in-app notice carry only this line: when the
  // expert cancelled, it has to say so by itself.
  const memberBody = cancelledByExpert
    ? `${title} — ${memberView.formattedDate}`
    : memberSessionBody(locale, expertFirst, memberView.formattedDate)
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
  const memberAttachments = calendarAttachments(
    event.type,
    booking,
    icsSummary(locale, expertFirst),
    memberJoinHref,
    locale
  )
  const expertAttachments = calendarAttachments(
    event.type,
    booking,
    icsSummary(expertLocale, memberFirst),
    expertJoinHref,
    expertLocale
  )
  const results = await Promise.allSettled([
    send({
      kind: event.type,
      orgId: event.orgId,
      recipient: memberRecipient,
      ctx: {
        title,
        body: memberBody,
        subject: memberSubject,
        html: memberHtml,
        attachments: memberAttachments,
      },
      idempotencyKey,
      // Their expert cancelled: the member is emailed whatever their
      // preference, so nobody waits for a session that will not happen.
      essential: cancelledByExpert,
    }),
    send({
      kind: event.type,
      orgId: event.orgId,
      recipient: { userId: booking.expertUserId },
      ctx: {
        title: expertTitle,
        body: expertBody,
        subject: expertSubject,
        html: expertHtml,
        attachments: expertAttachments,
      },
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
    case "booking.request_accepted":
      return booking.status === "confirmed"
    case "booking.requested":
      return booking.status === "awaiting_confirmation"
    case "booking.cancelled":
    case "booking.request_declined":
    case "booking.request_expired":
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

/**
 * Calendar files carry no service name or notes: calendars sync to third
 * parties, so the summary names only the counterpart's first name and
 * `LOCATION` never holds a phone number, masked or not.
 */
export function calendarAttachments(
  kind: BookingSendKind,
  booking: LoadedBooking,
  summary: string,
  joinHref?: string,
  locale: EmailLocale = "en"
): EmailAttachment[] | undefined {
  const attendeeEmail = booking.memberEmail ?? booking.guestEmail
  const event: IcsEventInput = {
    uid: booking.id,
    summary,
    startTime: booking.startsAt,
    endTime: booking.endsAt,
    timezone: booking.timezone,
    url: joinHref,
    location: icsLocation(booking, joinHref, locale),
    organizer: { name: booking.expertName, email: booking.expertEmail },
    attendees: attendeeEmail
      ? [
          {
            name: firstName(booking.memberName ?? booking.guestName ?? ""),
            email: attendeeEmail,
          },
        ]
      : undefined,
    sequence: booking.scheduleRevision,
  }
  switch (kind) {
    case "booking.confirmed":
    case "booking.request_accepted":
    case "booking.rescheduled":
      return [icsAttachment("REQUEST", generateIcsRequest(event))]
    case "booking.requested":
    case "booking.request_declined":
    case "booking.request_expired":
      return undefined
    case "booking.cancelled":
      return [
        icsAttachment(
          "CANCEL",
          generateIcsCancel({
            ...event,
            sequence: booking.scheduleRevision + 1,
          })
        ),
      ]
    case "booking.reminder_24h":
    case "booking.reminder_1h":
      return undefined
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

function icsLocation(
  booking: Pick<LoadedBooking, "sessionMode" | "location">,
  joinHref: string | undefined,
  locale: EmailLocale
): string | undefined {
  const t = getEmailTranslations(locale)
  switch (booking.sessionMode) {
    case "online":
      return joinHref ?? t.booking.videoCall
    case "phone":
      return t.booking.phoneCall
    case "in_person":
      return booking.location
        ? `${booking.location.name}, ${formatAddress(booking.location)}`
        : t.modes.in_person
    default:
      return undefined
  }
}

function formatAddress(
  location: NonNullable<LoadedBooking["location"]>
): string {
  const city = [location.postalCode, location.city].filter(Boolean).join(" ")
  return [location.address, location.line2, city].filter(Boolean).join(", ")
}

export function sessionPlace(
  booking: Pick<LoadedBooking, "sessionMode" | "location">,
  locale: EmailLocale
): SessionPlace | undefined {
  const location = booking.location
  if (booking.sessionMode !== "in_person" || !location) return undefined
  const address = formatAddress(location)
  const query =
    location.latitude !== null && location.longitude !== null
      ? `${location.latitude},${location.longitude}`
      : `${location.name}, ${address}`
  const instructions = location.instructions
    ? localizedTitle(location.instructions, locale)
    : undefined
  return {
    name: location.name,
    address,
    mapsHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    ...(instructions ? { instructions } : {}),
  }
}

function maskMemberPhone(phone: string | null): string | null {
  return phone ? maskPhone(phone) : null
}

function icsAttachment(
  method: "REQUEST" | "CANCEL",
  content: string
): EmailAttachment {
  return {
    filename: method === "CANCEL" ? "cancel.ics" : "invite.ics",
    content,
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  }
}

function icsSummary(locale: EmailLocale, counterpartFirst: string): string {
  switch (locale) {
    case "pt":
      return `Sessão Eleva com ${counterpartFirst}`
    case "es":
      return `Sesión Eleva con ${counterpartFirst}`
    case "en":
      return `Eleva session with ${counterpartFirst}`
    default: {
      const _exhaustive: never = locale
      return _exhaustive
    }
  }
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
    requestedTitle: string
    requestAcceptedTitle: string
    requestDeclinedTitle: string
    requestExpiredTitle: string
    rescheduledTitle: string
    cancelledTitle: string
    reminder24hTitle: string
    reminder1hTitle: string
  }
): string {
  switch (kind) {
    case "booking.confirmed":
      return booking.confirmedTitle
    case "booking.requested":
      return booking.requestedTitle
    case "booking.request_accepted":
      return booking.requestAcceptedTitle
    case "booking.request_declined":
      return booking.requestDeclinedTitle
    case "booking.request_expired":
      return booking.requestExpiredTitle
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

function emailCopyForKind(
  kind: BookingSendKind,
  t: ReturnType<typeof getEmailTranslations>,
  isExpert: boolean,
  cancelled?: { byExpert: boolean; expertName: string; refunded: boolean }
): {
  heading: string
  subheading: string
  preview: (member: string, date: string) => string
} {
  switch (kind) {
    case "booking.requested":
      return {
        heading: isExpert
          ? t.booking.expertRequestedTitle
          : t.booking.requestedTitle,
        subheading: isExpert
          ? t.booking.expertRequestedSubtitle
          : t.booking.requestedSubtitle,
        preview: t.subject.requested,
      }
    case "booking.request_accepted":
      return {
        heading: isExpert
          ? t.booking.expertConfirmedTitle
          : t.booking.requestAcceptedTitle,
        subheading: isExpert
          ? t.booking.expertConfirmedSubtitle
          : t.booking.requestAcceptedSubtitle,
        preview: t.subject.requestAccepted,
      }
    case "booking.request_declined":
      return {
        heading: t.booking.requestDeclinedTitle,
        subheading: isExpert
          ? t.booking.expertRequestDeclinedSubtitle
          : t.booking.requestDeclinedSubtitle,
        preview: t.subject.requestDeclined,
      }
    case "booking.request_expired":
      return {
        heading: t.booking.requestExpiredTitle,
        subheading: isExpert
          ? t.booking.expertRequestExpiredSubtitle
          : t.booking.requestExpiredSubtitle,
        preview: t.subject.requestExpired,
      }
    case "booking.confirmed":
      return {
        heading: isExpert
          ? t.booking.expertConfirmedTitle
          : t.booking.confirmedTitle,
        subheading: isExpert
          ? t.booking.expertConfirmedSubtitle
          : t.booking.confirmedSubtitle,
        preview: t.subject.newBooking,
      }
    case "booking.cancelled":
      if (cancelled?.byExpert) {
        return {
          heading: t.booking.cancelledTitle,
          subheading: isExpert
            ? t.booking.expertCancelledByYouSubtitle(cancelled.refunded)
            : t.booking.cancelledByExpertSubtitle(
                cancelled.expertName,
                cancelled.refunded
              ),
          preview: t.subject.cancelled,
        }
      }
      return {
        heading: t.booking.cancelledTitle,
        subheading: isExpert
          ? t.booking.expertCancelledSubtitle
          : t.booking.cancelledSubtitle,
        preview: t.subject.cancelled,
      }
    case "booking.rescheduled":
      return {
        heading: t.booking.rescheduledTitle,
        subheading: isExpert
          ? t.booking.expertRescheduledSubtitle
          : t.booking.rescheduledSubtitle,
        preview: t.subject.rescheduled,
      }
    case "booking.reminder_24h":
      return {
        heading: t.booking.reminder24hTitle,
        subheading: isExpert
          ? t.booking.expertReminder24hSubtitle
          : t.booking.reminder24hSubtitle,
        preview: t.subject.reminder24h,
      }
    case "booking.reminder_1h":
      return {
        heading: t.booking.reminder1hTitle,
        subheading: isExpert
          ? t.booking.expertReminder1hSubtitle
          : t.booking.reminder1hSubtitle,
        preview: t.subject.reminder1h,
      }
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
    requested: (member: string, date: string) => string
    requestAccepted: (member: string, date: string) => string
    requestDeclined: (member: string, date: string) => string
    requestExpired: (member: string, date: string) => string
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
    case "booking.requested":
      return subject.requested(memberFirst, formattedDate)
    case "booking.request_accepted":
      return subject.requestAccepted(memberFirst, formattedDate)
    case "booking.request_declined":
      return subject.requestDeclined(memberFirst, formattedDate)
    case "booking.request_expired":
      return subject.requestExpired(memberFirst, formattedDate)
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

export async function sessionJoinHref(
  kind: BookingSendKind,
  booking: Pick<
    LoadedBooking,
    "id" | "sessionMode" | "endsAt" | "scheduleRevision"
  >,
  role: JoinGrantRole,
  gateway = resolveGatewayUrl(),
  mint: (input: MintJoinGrantInput) => Promise<string> = mintJoinGrantDefault
): Promise<string | undefined> {
  if (
    kind !== "booking.confirmed" &&
    kind !== "booking.request_accepted" &&
    kind !== "booking.reminder_1h" &&
    kind !== "booking.rescheduled"
  ) {
    return undefined
  }
  if (booking.sessionMode !== "online") return undefined
  if (joinGrantExpUnix(booking.endsAt) <= Math.floor(Date.now() / 1000)) {
    return undefined
  }
  try {
    const grant = await mint({
      bookingId: booking.id,
      role,
      endsAt: booking.endsAt,
      scheduleRevision: booking.scheduleRevision,
    })
    const base = gateway.replace(/\/$/, "")
    return `${base}${sessionJoinPath(booking.id, grant)}`
  } catch {
    console.error("[booking-notification] join grant mint failed", {
      bookingId: booking.id,
      role,
      kind,
    })
    return undefined
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
  /** `booking.cancelled` only: the expert cancelled, not the member. */
  cancelledByExpert?: boolean
  /** Member copy of an expert cancellation: the expert's public profile. */
  rebookHref?: string
  joinHref?: string
  audience?: "member" | "expert"
  greetingName?: string
  activateHref?: string
  calendarHref?: string
  memberEmail?: string
  memberPhone?: string
  duration?: string
  timezone?: string
  language?: string
  country?: string
  price?: string
  place?: SessionPlace
  maskedPhone?: string | null
  /** Member copy: the expert they booked with. */
  expertName?: string
  /** Inbox preview line; defaults to the kind's expert-style preview. */
  previewText?: string
}): Promise<string> {
  const t = getEmailTranslations(input.locale)
  const isExpert = input.audience === "expert"
  const copy = emailCopyForKind(input.kind, t, isExpert, {
    byExpert: input.cancelledByExpert === true,
    expertName: input.expertName
      ? firstName(input.expertName)
      : t.labels.expert,
    refunded: input.refundAmount !== undefined,
  })
  const preview =
    input.previewText ?? copy.preview(input.memberName, input.formattedDate)
  // Who is greeted, and who the "other person" row shows.
  const people = {
    greetingName: input.greetingName,
    counterpartLabel: isExpert ? t.labels.member : t.labels.expert,
    counterpartName: isExpert
      ? input.memberName
      : (input.expertName ?? input.memberName),
  }
  switch (input.kind) {
    case "booking.confirmed":
    case "booking.requested":
    case "booking.request_accepted":
      return renderBookingConfirmed({
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
        joinHref: input.joinHref,
        audience: input.audience,
        greetingName: input.greetingName,
        activateHref: input.activateHref,
        calendarHref: input.calendarHref,
        memberEmail: input.memberEmail,
        memberPhone: input.memberPhone,
        duration: input.duration,
        timezone: input.timezone,
        language: input.language,
        country: input.country,
        price: input.price,
        place: input.place,
        maskedPhone: input.maskedPhone,
        cancellationPolicyName: input.cancellationPolicyName,
        expertName: input.expertName,
        heading: copy.heading,
        subheading: copy.subheading,
        preview,
        showIcsHint: input.kind !== "booking.requested",
      })
    case "booking.cancelled":
    case "booking.request_declined":
    case "booking.request_expired":
      return renderBookingCancelled({
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        cancellationPolicyName: input.cancelledByExpert
          ? undefined
          : input.cancellationPolicyName,
        refundAmount: input.refundAmount,
        rebookHref: input.rebookHref,
        locale: input.locale,
        ...people,
        heading: copy.heading,
        subheading: copy.subheading,
        preview,
        showIcsHint: input.kind === "booking.cancelled",
        urgentHelp: isExpert ? undefined : "full",
      })
    case "booking.rescheduled":
      return renderBookingRescheduled({
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        previousDate: input.previousDate,
        newDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
        joinHref: input.joinHref,
        place: input.place,
        maskedPhone: input.maskedPhone,
        ...people,
        subheading: copy.subheading,
        preview,
        urgentHelp: isExpert ? undefined : "emergency",
      })
    case "booking.reminder_24h":
      return renderBookingReminder({
        window: "24h",
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
        joinHref: input.joinHref,
        place: input.place,
        maskedPhone: input.maskedPhone,
        ...people,
        subheading: copy.subheading,
        preview,
        urgentHelp: isExpert ? undefined : "emergency",
      })
    case "booking.reminder_1h":
      return renderBookingReminder({
        window: "1h",
        memberName: input.memberName,
        eventTypeName: input.eventTypeName,
        formattedDate: input.formattedDate,
        sessionMode: input.sessionMode,
        locale: input.locale,
        joinHref: input.joinHref,
        place: input.place,
        maskedPhone: input.maskedPhone,
        ...people,
        subheading: copy.subheading,
        preview,
        urgentHelp: isExpert ? undefined : "emergency",
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
      timeZoneName: "short",
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

function formatDuration(
  startsAt: Date,
  endsAt: Date,
  locale: EmailLocale
): string {
  const minutes = Math.max(
    1,
    Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  )
  return new Intl.NumberFormat(LOCALE_MAP[locale], {
    style: "unit",
    unit: "minute",
    unitDisplay: "long",
  }).format(minutes)
}

function formatLanguage(
  code: string | null,
  locale: EmailLocale
): string | undefined {
  if (!code) return undefined
  try {
    return (
      new Intl.DisplayNames([LOCALE_MAP[locale]], { type: "language" }).of(
        code
      ) ?? code
    )
  } catch {
    return code
  }
}

function formatCountry(
  code: string | null,
  locale: EmailLocale
): string | undefined {
  if (!code) return undefined
  try {
    return (
      new Intl.DisplayNames([LOCALE_MAP[locale]], { type: "region" }).of(
        code
      ) ?? code
    )
  } catch {
    return code
  }
}

function memberActivateHref(
  kind: BookingSendKind,
  booking: LoadedBooking,
  gateway: string
): string | undefined {
  if (kind !== "booking.confirmed" && kind !== "booking.request_accepted") {
    return undefined
  }
  if (!booking.guestEmail) return undefined
  if (booking.memberEmailVerified) return undefined
  const path = guestSignupPath({
    email: booking.guestEmail,
    name: booking.guestName,
  })
  return `${gateway.replace(/\/$/, "")}${path}`
}

export async function loadBookingForNotification(
  bookingId: string
): Promise<LoadedBooking | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        id: main.bookings.id,
        orgId: main.bookings.orgId,
        orgSlug: auth.organization.slug,
        status: main.bookings.status,
        startsAt: main.bookings.startsAt,
        endsAt: main.bookings.endsAt,
        timezone: main.bookings.timezone,
        sessionMode: main.bookings.sessionMode,
        bookedLocale: main.bookings.bookedLocale,
        memberUserId: main.bookings.memberUserId,
        guestEmail: main.bookings.guestEmail,
        guestName: main.bookings.guestName,
        guestPhone: main.bookings.guestPhone,
        expertUserId: main.bookings.expertUserId,
        expertUsername: main.expertProfiles.username,
        eventTypeName: main.eventTypes.title,
        scheduleRevision: main.bookings.scheduleRevision,
        cancellationPolicy: main.bookings.cancellationPolicy,
        currency: main.bookings.currency,
        priceCents: main.bookings.priceCents,
        language: main.bookings.language,
        memberCountry: main.bookings.memberCountry,
        locationId: main.expertPracticeLocations.id,
        locationName: main.expertPracticeLocations.name,
        locationAddress: main.expertPracticeLocations.address,
        locationLine2: main.expertPracticeLocations.line2,
        locationPostalCode: main.expertPracticeLocations.postalCode,
        locationCity: main.expertPracticeLocations.city,
        locationLatitude: main.expertPracticeLocations.latitude,
        locationLongitude: main.expertPracticeLocations.longitude,
        locationInstructions: main.expertPracticeLocations.instructions,
      })
      .from(main.bookings)
      .innerJoin(
        main.eventTypes,
        eq(main.eventTypes.id, main.bookings.eventTypeId)
      )
      .innerJoin(
        auth.organization,
        eq(auth.organization.id, main.bookings.orgId)
      )
      .leftJoin(
        main.expertProfiles,
        eq(main.expertProfiles.id, main.bookings.expertProfileId)
      )
      .leftJoin(
        main.eventTypeModes,
        eq(main.eventTypeModes.id, main.bookings.eventTypeModeId)
      )
      .leftJoin(
        main.expertPracticeLocations,
        eq(main.expertPracticeLocations.id, main.eventTypeModes.locationId)
      )
      .where(eq(main.bookings.id, bookingId))
      .limit(1)
    if (!row) return null

    const [expert] = await tx
      .select({
        email: auth.user.email,
        name: auth.user.name,
        locale: auth.user.locale,
        timezone: auth.user.timezone,
      })
      .from(auth.user)
      .where(eq(auth.user.id, row.expertUserId))
      .limit(1)
    if (!expert?.email) return null

    let memberEmail: string | null = null
    let memberName: string | null = null
    let memberPhone: string | null = null
    let memberEmailVerified = false
    if (row.memberUserId) {
      const [member] = await tx
        .select({
          email: auth.user.email,
          name: auth.user.name,
          phoneE164: auth.user.phoneE164,
          emailVerified: auth.user.emailVerified,
        })
        .from(auth.user)
        .where(eq(auth.user.id, row.memberUserId))
        .limit(1)
      memberEmail = member?.email ?? null
      memberName = member?.name ?? null
      memberPhone = member?.phoneE164 ?? null
      memberEmailVerified = member?.emailVerified ?? false
    }

    const {
      locationId,
      locationName,
      locationAddress,
      locationLine2,
      locationPostalCode,
      locationCity,
      locationLatitude,
      locationLongitude,
      locationInstructions,
      ...booking
    } = row
    return {
      ...booking,
      location:
        locationId && locationName && locationAddress && locationCity
          ? {
              name: locationName,
              address: locationAddress,
              line2: locationLine2,
              postalCode: locationPostalCode,
              city: locationCity,
              latitude: locationLatitude,
              longitude: locationLongitude,
              instructions: locationInstructions,
            }
          : null,
      memberEmail,
      memberName,
      memberPhone,
      memberEmailVerified,
      expertEmail: expert.email,
      expertName: expert.name,
      expertLocale: expert.locale ?? null,
      expertTimezone: expert.timezone ?? null,
    }
  })
}
