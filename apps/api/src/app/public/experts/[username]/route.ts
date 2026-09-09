import { PublicExpertProfileSchema } from "@eleva/api-client"
import {
  findExpertByUsername,
  listPublicEventTypeModes,
  listPublicEventTypes,
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
  context: { params: Promise<{ username: string }> }
) {
  return handlePublicGet(request, async (headers) => {
    const { username } = await context.params
    const expert = await findExpertByUsername(username)
    if (!expert) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }

    const eventTypes = await listPublicEventTypes(expert.id)
    const modesByEventType = await listPublicEventTypeModes(
      eventTypes.map((eventType) => eventType.id)
    )

    return secureJson(
      PublicExpertProfileSchema.parse({
        username: expert.username,
        displayName: expert.displayName,
        headline: expert.headline,
        bio: expert.bio,
        avatarUrl: expert.avatarUrl,
        languages: expert.languages,
        serviceCountries: expert.serviceCountries,
        categorySlugs: expert.categorySlugs,
        eventTypes: eventTypes.map((eventType) => ({
          slug: eventType.slug,
          title: eventType.title,
          description: eventType.description ?? null,
          durationMinutes: eventType.durationMinutes,
          priceAmount: eventType.priceAmount,
          currency: eventType.currency,
          languages: eventType.languages,
          sessionMode: eventType.sessionMode,
          modes: modesByEventType.get(eventType.id) ?? [],
        })),
      }),
      { status: 200, headers }
    )
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
