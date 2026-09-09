import { PublicBookingLinkResponseSchema } from "@eleva/api-client"
import { findUsableBookingLink, listPublicEventTypeModes } from "@eleva/db"
import { hashBookingLinkToken } from "@eleva/scheduling"
import {
  handlePublicGet,
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

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  return handlePublicGet(request, async (headers) => {
    const { token } = await context.params
    const link = await findUsableBookingLink(hashBookingLinkToken(token))
    if (!link) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const modes =
      (await listPublicEventTypeModes([link.eventTypeId])).get(
        link.eventTypeId
      ) ?? []
    if (
      modes.length === 0 ||
      (link.eventTypeModeId !== null &&
        !modes.some((mode) => mode.id === link.eventTypeModeId))
    ) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    return secureJson(
      PublicBookingLinkResponseSchema.parse({
        eventTypeId: link.eventTypeId,
        eventTypeModeId: link.eventTypeModeId,
        priceCents: link.priceCents,
        expiresAt: link.expiresAt.toISOString(),
        note: link.note,
        username: link.username,
        eventSlug: link.eventSlug,
        expertDisplayName: link.expertDisplayName,
        eventTitle: link.eventTitle,
        modes,
      }),
      { status: 200, headers }
    )
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
