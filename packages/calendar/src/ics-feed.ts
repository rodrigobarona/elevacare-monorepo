import { createHash } from "node:crypto"

/**
 * Read-only multi-VEVENT ICS feed for calendar subscription clients.
 * UIDs are stable (`{bookingId}@eleva.care`) so clients update in place.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc5545
 */

export type IcsFeedEvent = {
  /** Booking primary key — used as UID. */
  uid: string
  summary: string
  description?: string
  location?: string
  startTime: Date
  endTime: Date
}

export type IcsFeedInput = {
  calendarName: string
  events: IcsFeedEvent[]
  /** Override DTSTAMP for deterministic tests. */
  stamp?: Date
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

/** sha256 hex of the raw feed token (stored; never the plaintext). */
export function hashCalendarFeedToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Build a VCALENDAR PUBLISH feed suitable for Apple / Google / Outlook
 * subscription URLs.
 */
export function generateIcsFeed(input: IcsFeedInput): string {
  const stamp = formatDateUTC(input.stamp ?? new Date())
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eleva Care//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
  ]

  for (const event of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@eleva.care`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatDateUTC(event.startTime)}`,
      `DTEND:${formatDateUTC(event.endTime)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE"
    )
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`)
    }
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.map(foldLine).join("\r\n") + "\r\n"
}

/** Weak ETag from feed body bytes (quoted). */
export function icsFeedEtag(body: string): string {
  const digest = createHash("sha256").update(body).digest("hex").slice(0, 32)
  return `"${digest}"`
}
