import { Resend } from "resend"
import {
  generateIcsRequest,
  generateIcsCancel,
  type IcsEventInput,
} from "@eleva/calendar"

const resend = new Resend(process.env.RESEND_API_KEY)

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
      ? `{ "@type": "Place", "name": ${JSON.stringify(payload.location)} }`
      : `{ "@type": "VirtualLocation", "url": "https://app.eleva.care" }`

  return `<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "EventReservation",
  "reservationNumber": "BKG-${payload.bookingId.slice(0, 8)}",
  "reservationStatus": "http://schema.org/${status}",
  "underName": { "@type": "Person", "name": ${JSON.stringify(payload.expertName)} },
  "reservationFor": {
    "@type": "Event",
    "name": ${JSON.stringify(`${payload.eventTypeName} with ${payload.patientName}`)},
    "startDate": "${payload.startsAt.toISOString()}",
    "endDate": "${payload.endsAt.toISOString()}",
    "location": ${locationObj}
  }
}
</script>`
}

function formatDateTime(date: Date, tz: string): string {
  try {
    return date.toLocaleString("en-GB", {
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
  const icsContent = generateIcsRequest(buildIcsInput(payload))
  const formattedDate = formatDateTime(payload.startsAt, payload.timezone)
  const jsonLd = buildJsonLd(payload, "Confirmed")

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [payload.expertEmail],
    subject: `New booking: ${payload.patientName} — ${formattedDate}`,
    html: `${jsonLd}
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a; margin-bottom: 8px;">New Booking Confirmed</h2>
  <p style="color: #4a4a4a; margin-bottom: 20px;">A new session has been booked. The calendar invite is attached.</p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr><td style="padding: 8px 0; color: #6b6b6b; width: 120px;">Patient</td><td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${payload.patientName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Service</td><td style="padding: 8px 0; color: #1a1a1a;">${payload.eventTypeName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Date &amp; Time</td><td style="padding: 8px 0; color: #1a1a1a;">${formattedDate}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Mode</td><td style="padding: 8px 0; color: #1a1a1a;">${payload.sessionMode}</td></tr>
    ${payload.location ? `<tr><td style="padding: 8px 0; color: #6b6b6b;">Location</td><td style="padding: 8px 0; color: #1a1a1a;">${payload.location}</td></tr>` : ""}
  </table>
  <p style="color: #6b6b6b; font-size: 13px;">Open the attached .ics file to add this event to your calendar.</p>
</div>`,
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
  const icsContent = generateIcsRequest(buildIcsInput(payload))
  const formattedDate = formatDateTime(payload.startsAt, payload.timezone)
  const formattedPrevious = formatDateTime(previousStartsAt, payload.timezone)
  const jsonLd = buildJsonLd(payload, "Confirmed")

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [payload.expertEmail],
    subject: `Rescheduled: ${payload.patientName} — ${formattedDate}`,
    html: `${jsonLd}
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a; margin-bottom: 8px;">Booking Rescheduled</h2>
  <p style="color: #4a4a4a; margin-bottom: 20px;">A session has been rescheduled. The updated calendar invite is attached.</p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr><td style="padding: 8px 0; color: #6b6b6b; width: 120px;">Patient</td><td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${payload.patientName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Service</td><td style="padding: 8px 0; color: #1a1a1a;">${payload.eventTypeName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Previous</td><td style="padding: 8px 0; color: #c0392b; text-decoration: line-through;">${formattedPrevious}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">New Time</td><td style="padding: 8px 0; color: #27ae60; font-weight: 500;">${formattedDate}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Mode</td><td style="padding: 8px 0; color: #1a1a1a;">${payload.sessionMode}</td></tr>
  </table>
  <p style="color: #6b6b6b; font-size: 13px;">Open the attached .ics file to update the event in your calendar.</p>
</div>`,
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
  const icsContent = generateIcsCancel(buildIcsInput(payload))
  const formattedDate = formatDateTime(payload.startsAt, payload.timezone)
  const jsonLd = buildJsonLd(payload, "Cancelled")

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [payload.expertEmail],
    subject: `Cancelled: ${payload.patientName} — ${formattedDate}`,
    html: `${jsonLd}
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a; margin-bottom: 8px;">Booking Cancelled</h2>
  <p style="color: #4a4a4a; margin-bottom: 20px;">A session has been cancelled. The cancellation invite is attached to remove it from your calendar.</p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr><td style="padding: 8px 0; color: #6b6b6b; width: 120px;">Patient</td><td style="padding: 8px 0; color: #1a1a1a; font-weight: 500;">${payload.patientName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Service</td><td style="padding: 8px 0; color: #1a1a1a;">${payload.eventTypeName}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b6b6b;">Was scheduled</td><td style="padding: 8px 0; color: #c0392b;">${formattedDate}</td></tr>
  </table>
  <p style="color: #6b6b6b; font-size: 13px;">Open the attached .ics file to remove this event from your calendar.</p>
</div>`,
    attachments: [
      {
        content: Buffer.from(icsContent, "utf-8"),
        filename: "cancel.ics",
        contentType: "text/calendar; charset=utf-8; method=CANCEL",
      },
    ],
  })
}
