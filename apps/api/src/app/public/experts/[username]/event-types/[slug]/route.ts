import { PublicEventTypeDetailSchema } from "@eleva/api-client"
import {
  findExpertByUsername,
  findPublicEventType,
  listPublicEventTypeModes,
} from "@eleva/db"
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
  context: { params: Promise<{ username: string; slug: string }> }
) {
  return handlePublicGet(request, async (headers) => {
    const { username, slug } = await context.params
    const expert = await findExpertByUsername(username)
    if (!expert) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const eventType = await findPublicEventType(expert.id, slug)
    if (!eventType) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const modesByEventType = await listPublicEventTypeModes([eventType.id])

    return secureJson(
      PublicEventTypeDetailSchema.parse({
        username: expert.username,
        slug: eventType.slug,
        title: eventType.title,
        description: eventType.description ?? null,
        durationMinutes: eventType.durationMinutes,
        priceAmount: eventType.priceAmount,
        currency: eventType.currency,
        languages: eventType.languages,
        sessionMode: eventType.sessionMode,
        modes: modesByEventType.get(eventType.id) ?? [],
      }),
      { status: 200, headers }
    )
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
