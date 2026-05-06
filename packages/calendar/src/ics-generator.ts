/**
 * RFC 5545-compliant .ics content generator for booking lifecycle events.
 *
 * Produces VCALENDAR text suitable for email attachments. Uses the booking
 * ID as UID for idempotency across create/update/cancel operations.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc5545
 */

export type IcsMethod = "REQUEST" | "CANCEL"

export interface IcsEventInput {
  uid: string
  summary: string
  description?: string
  startTime: Date
  endTime: Date
  timezone: string
  location?: string
  organizer: { name: string; email: string }
  attendees?: { name: string; email: string }[]
  /** Increment on each reschedule to signal update to calendar clients. */
  sequence?: number
}

function formatDateUTC(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

/** RFC 5545 §3.2: parameter values use DQUOTE-wrapped strings, no embedded DQUOTEs. */
function quoteParamValue(text: string): string {
  return `"${text.replace(/"/g, "")}"`
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function foldLine(line: string): string {
  const MAX_OCTETS = 75
  const bytes = encoder.encode(line)
  if (bytes.length <= MAX_OCTETS) return line

  const parts: string[] = []
  let pos = 0
  let first = true

  while (pos < bytes.length) {
    const chunkSize = first ? MAX_OCTETS : MAX_OCTETS - 1
    let end = Math.min(pos + chunkSize, bytes.length)

    while (end > pos && (bytes[end] ?? 0) >= 0x80 && (bytes[end] ?? 0) < 0xc0) {
      end--
    }

    const chunk = decoder.decode(bytes.slice(pos, end))
    parts.push(first ? chunk : " " + chunk)
    pos = end
    first = false
  }

  return parts.join("\r\n")
}

/**
 * Generate a VCALENDAR string for a booking event (create/update).
 */
export function generateIcsRequest(event: IcsEventInput): string {
  return generateIcs("REQUEST", "CONFIRMED", event)
}

/**
 * Generate a VCALENDAR string for a cancellation.
 */
export function generateIcsCancel(event: IcsEventInput): string {
  return generateIcs("CANCEL", "CANCELLED", event)
}

function generateIcs(
  method: IcsMethod,
  status: string,
  event: IcsEventInput
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eleva Care//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}@eleva.care`,
    `DTSTAMP:${formatDateUTC(new Date())}`,
    `DTSTART:${formatDateUTC(event.startTime)}`,
    `DTEND:${formatDateUTC(event.endTime)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `STATUS:${status}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `ORGANIZER;CN=${quoteParamValue(event.organizer.name)}:mailto:${event.organizer.email}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`)
  }

  if (event.attendees) {
    for (const attendee of event.attendees) {
      lines.push(
        `ATTENDEE;CN=${quoteParamValue(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`
      )
    }
  }

  lines.push("END:VEVENT", "END:VCALENDAR")

  return lines.map(foldLine).join("\r\n") + "\r\n"
}
