import {
  generateIcsFeed,
  hashCalendarFeedToken,
  icsFeedEtag,
} from "@eleva/calendar/ics-feed"
import {
  findActiveCalendarFeedTokenByHash,
  listExpertBookingsForFeed,
  type ExpertBookingListItem,
  type LocalizedText,
} from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"
import { secureJson } from "@/lib/security-headers"

export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PUBLIC_NOT_FOUND = { error: "not_found" } as const

const FEED_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000
const FEED_LOOKAHEAD_MS = 365 * 24 * 60 * 60 * 1000

function stripIcsSuffix(raw: string): string {
  return raw.toLowerCase().endsWith(".ics") ? raw.slice(0, -4) : raw
}

function pickText(text: LocalizedText | null | undefined): string {
  if (!text) return ""
  return text.en || text.pt || text.es || ""
}

function modeLocationLine(booking: ExpertBookingListItem): {
  location?: string
  description: string
} {
  const modeLabel =
    pickText(booking.modeLabel) || booking.sessionMode.replace("_", " ")
  const parts: string[] = [`Mode: ${modeLabel}`]

  let location: string | undefined
  if (booking.locationName) {
    const cityBits = [booking.locationCity, booking.locationCountry]
      .filter(Boolean)
      .join(", ")
    location = cityBits
      ? `${booking.locationName}, ${cityBits}`
      : booking.locationName
    parts.push(`Location: ${booking.locationName}`)
    if (booking.locationAddress) {
      parts.push(booking.locationAddress)
    }
  } else if (booking.sessionMode === "online") {
    location = "Online"
    parts.push("Location: Online")
  } else if (booking.sessionMode === "phone") {
    location = "Phone"
    parts.push("Location: Phone")
  }

  return { location, description: parts.join("\n") }
}

function toFeedEvent(booking: ExpertBookingListItem) {
  const title = pickText(booking.eventTypeTitle) || "Session"
  const member = booking.memberFirstName
  const summary = member ? `${title} — ${member}` : title
  const { location, description } = modeLocationLine(booking)

  return {
    uid: booking.id,
    summary,
    description,
    location,
    startTime: booking.startsAt,
    endTime: booking.endsAt,
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")
  const { token: rawToken } = await context.params
  const token = stripIcsSuffix(rawToken)

  if (!token || token.length < 16 || token.length > 128) {
    return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
  }

  const rateLimited = await applyRateLimit(
    `ics:${hashCalendarFeedToken(token)}`,
    RATE_LIMITS.icsFeed,
    headers
  )
  if (rateLimited) return rateLimited

  try {
    const feedToken = await findActiveCalendarFeedTokenByHash(
      hashCalendarFeedToken(token)
    )
    if (!feedToken) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const now = Date.now()
    const bookings = await listExpertBookingsForFeed(
      feedToken.expertProfileId,
      new Date(now - FEED_LOOKBACK_MS),
      new Date(now + FEED_LOOKAHEAD_MS)
    )

    // Confirmed-or-later sessions only (exclude holds / payment waits).
    const confirmed = bookings.filter((b) =>
      ["confirmed", "rescheduled", "completed"].includes(b.status)
    )

    const body = generateIcsFeed({
      calendarName: "Eleva",
      events: confirmed.map(toFeedEvent),
    })
    const etag = icsFeedEtag(body)

    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...headers,
          ETag: etag,
          "Cache-Control": "private, max-age=300",
        },
      })
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="eleva.ics"',
        ETag: etag,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (err) {
    console.error("calendar feed failure", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
