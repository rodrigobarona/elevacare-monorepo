import { PublicBookingLinkResponseSchema } from "@eleva/api-client"
import { findUsableBookingLink } from "@eleva/db"
import { hashBookingLinkToken } from "@eleva/scheduling"
import {
  handlePublicGet,
  PUBLIC_NOT_FOUND,
  publicOptions,
} from "@/lib/public-marketplace"
import { secureJson } from "@/lib/security-headers"

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

    return secureJson(
      PublicBookingLinkResponseSchema.parse({
        eventTypeId: link.eventTypeId,
        eventTypeModeId: link.eventTypeModeId,
        priceCents: link.priceCents,
        expiresAt: link.expiresAt.toISOString(),
      }),
      { status: 200, headers }
    )
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
