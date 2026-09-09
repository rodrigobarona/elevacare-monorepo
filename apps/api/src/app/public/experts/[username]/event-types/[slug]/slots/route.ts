import {
  PublicSlotsQuerySchema,
  PublicSlotsResponseSchema,
} from "@eleva/api-client"
import {
  findExpertByUsername,
  findPublicEventType,
  getScheduleForBooking,
  listExpertBusyBookings,
} from "@eleva/db"
import {
  emptyBusyTimeProvider,
  getAvailableSlotsForOffer,
  resolveOffer,
} from "@eleva/scheduling"
import {
  handlePublicGet,
  isIanaTimeZone,
  PUBLIC_NOT_FOUND,
  publicOptions,
} from "@/lib/public-marketplace"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string; slug: string }> }
) {
  return handlePublicGet(request, async (headers) => {
    const parsed = PublicSlotsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams)
    )
    if (!parsed.success) {
      return secureJson(
        { error: "validation", issues: parsed.error.issues },
        { status: 422, headers }
      )
    }

    const { modeId, from, to, tz, linkToken } = parsed.data
    if (!isIanaTimeZone(tz)) {
      return secureJson(
        { error: "validation", message: "invalid timezone" },
        { status: 422, headers }
      )
    }

    const rangeStart = new Date(from)
    const rangeEnd = new Date(to)
    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime()) ||
      rangeStart >= rangeEnd ||
      rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS
    ) {
      return secureJson(
        { error: "validation", message: "invalid range" },
        { status: 422, headers }
      )
    }

    const { username, slug } = await context.params
    const expert = await findExpertByUsername(username)
    if (!expert) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const eventType = await findPublicEventType(expert.id, slug)
    if (!eventType) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const resolved = await resolveOffer({
      expertOrgId: eventType.orgId,
      eventTypeModeId: modeId,
      linkToken,
    })
    if (!resolved.ok || resolved.offer.eventTypeId !== eventType.id) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const { schedule, rules, overrides } = await getScheduleForBooking(
      eventType.orgId,
      resolved.offer.scheduleId
    )
    if (!schedule) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const [existingBookings, externalBusyTimes] = await Promise.all([
      listExpertBusyBookings(expert.id, rangeStart, rangeEnd),
      emptyBusyTimeProvider.getBusy({
        expertUserId: expert.userId,
        from: rangeStart,
        to: rangeEnd,
      }),
    ])

    const slots = getAvailableSlotsForOffer({
      offer: resolved.offer,
      schedule,
      rules,
      overrides,
      existingBookings,
      externalBusyTimes,
      from: rangeStart,
      to: rangeEnd,
      viewerTz: tz,
      bookingWindowDays: eventType.bookingWindowDays,
      minimumNoticeMinutes: eventType.minimumNoticeMinutes,
      bufferBeforeMinutes: eventType.bufferBeforeMinutes,
      bufferAfterMinutes: eventType.bufferAfterMinutes,
    })

    return secureJson(
      PublicSlotsResponseSchema.parse({
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          startLocal: slot.startLocal,
          endLocal: slot.endLocal,
        })),
        priceCents: resolved.offer.priceCents,
        durationMinutes: resolved.offer.durationMinutes,
        scheduleId: resolved.offer.scheduleId,
      }),
      { status: 200, headers }
    )
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
