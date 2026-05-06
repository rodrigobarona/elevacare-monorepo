import { Resend } from "resend"
import {
  generateIcsRequest,
  generateIcsCancel,
  type IcsEventInput,
} from "@eleva/calendar"
import {
  renderBookingConfirmed,
  renderBookingRescheduled,
  renderBookingCancelled,
  getEmailTranslations,
  type EmailLocale,
} from "@eleva/email"

let _resend: Resend | null = null
function resend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM_ADDRESS = "Eleva Care <bookings@eleva.care>"

export interface IcsEmailPayload {
  expertEmail: string
  expertName: string
  patientName: string
  eventTypeName: string
  bookingId: string
  startsAt: Date
  endsAt: Date
  timezone: string
  sessionMode: string
  location?: string
  /** Locale for the email content (from booking's bookedLocale). */
  locale?: EmailLocale
  /** Sequence number for reschedules (0 = original, 1+ = updates). */
  sequence?: number
}

function buildIcsInput(payload: IcsEmailPayload): IcsEventInput {
  return {
    uid: payload.bookingId,
    summary: `${payload.eventTypeName} — ${payload.patientName}`,
    description: `Eleva Care session with ${payload.patientName}. Mode: ${payload.sessionMode}.`,
    startTime: payload.startsAt,
    endTime: payload.endsAt,
    timezone: payload.timezone,
    location: payload.location,
    organizer: { name: "Eleva Care", email: "bookings@eleva.care" },
    attendees: [{ name: payload.expertName, email: payload.expertEmail }],
    sequence: payload.sequence ?? 0,
  }
}

function buildJsonLd(payload: IcsEmailPayload, status: string): string {
  const locationObj =
    payload.sessionMode === "in_person" && payload.location
      ? { "@type": "Place", name: payload.location }
      : { "@type": "VirtualLocation", url: "https://app.eleva.care" }

  return JSON.stringify({
    "@context": "http://schema.org",
    "@type": "EventReservation",
    reservationNumber: `BKG-${payload.bookingId.slice(0, 8)}`,
    reservationStatus: `http://schema.org/${status}`,
    underName: { "@type": "Person", name: payload.expertName },
    reservationFor: {
      "@type": "Event",
      name: `${payload.eventTypeName} with ${payload.patientName}`,
      startDate: payload.startsAt.toISOString(),
      endDate: payload.endsAt.toISOString(),
      location: locationObj,
    },
  })
}

const LOCALE_MAP: Record<EmailLocale, string> = {
  en: "en-GB",
  pt: "pt-PT",
  es: "es-ES",
}

function formatDateTime(
  date: Date,
  tz: string,
  locale: EmailLocale = "en"
): string {
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

export async function sendBookingIcsEmail(
  payload: IcsEmailPayload
): Promise<void> {
  const locale = payload.locale ?? "en"
  const t = getEmailTranslations(locale)
  const icsContent = generateIcsRequest(buildIcsInput(payload))
  const formattedDate = formatDateTime(
    payload.startsAt,
    payload.timezone,
    locale
  )
  const jsonLd = buildJsonLd(payload, "Confirmed")

  const html = await renderBookingConfirmed({
    patientName: payload.patientName,
    eventTypeName: payload.eventTypeName,
    formattedDate,
    sessionMode: payload.sessionMode,
    location: payload.location,
    locale,
    jsonLd,
  })

  await resend().emails.send({
    from: FROM_ADDRESS,
    to: [payload.expertEmail],
    subject: t.subject.newBooking(payload.patientName, formattedDate),
    html,
    attachments: [
      {
        content: Buffer.from(icsContent, "utf-8"),
        filename: "invite.ics",
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      },
    ],
  })
}

export async function sendRescheduleIcsEmail(
  payload: IcsEmailPayload,
  previousStartsAt: Date
): Promise<void> {
  const locale = payload.locale ?? "en"
  const t = getEmailTranslations(locale)
  const icsContent = generateIcsRequest(buildIcsInput(payload))
  const formattedDate = formatDateTime(
    payload.startsAt,
    payload.timezone,
    locale
  )
  const formattedPrevious = formatDateTime(
    previousStartsAt,
    payload.timezone,
    locale
  )
  const jsonLd = buildJsonLd(payload, "Confirmed")

  const html = await renderBookingRescheduled({
    patientName: payload.patientName,
    eventTypeName: payload.eventTypeName,
    previousDate: formattedPrevious,
    newDate: formattedDate,
    sessionMode: payload.sessionMode,
    locale,
    jsonLd,
  })

  await resend().emails.send({
    from: FROM_ADDRESS,
    to: [payload.expertEmail],
    subject: t.subject.rescheduled(payload.patientName, formattedDate),
    html,
    attachments: [
      {
        content: Buffer.from(icsContent, "utf-8"),
        filename: "invite.ics",
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
      },
    ],
  })
}

export async function sendCancellationIcsEmail(
  payload: IcsEmailPayload
): Promise<void> {
  const locale = payload.locale ?? "en"
  const t = getEmailTranslations(locale)
  const icsContent = generateIcsCancel(buildIcsInput(payload))
  const formattedDate = formatDateTime(
    payload.startsAt,
    payload.timezone,
    locale
  )
  const jsonLd = buildJsonLd(payload, "Cancelled")

  const html = await renderBookingCancelled({
    patientName: payload.patientName,
    eventTypeName: payload.eventTypeName,
    formattedDate,
    locale,
    jsonLd,
  })

  await resend().emails.send({
    from: FROM_ADDRESS,
    to: [payload.expertEmail],
    subject: t.subject.cancelled(payload.patientName, formattedDate),
    html,
    attachments: [
      {
        content: Buffer.from(icsContent, "utf-8"),
        filename: "cancel.ics",
        contentType: "text/calendar; charset=utf-8; method=CANCEL",
      },
    ],
  })
}
