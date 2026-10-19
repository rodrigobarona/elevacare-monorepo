import { PublicExpertProfileSchema } from "@eleva/api-client"
import {
  findExpertByUsername,
  listPublicEventTypeModes,
  listPublicEventTypes,
  type LocalizedRichText,
} from "@eleva/db"
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

function toPublicRichText(
  value: LocalizedRichText | null
): Partial<Record<"en" | "pt" | "es", { html: string; text: string }>> | null {
  if (!value) return null
  const result: Partial<
    Record<"en" | "pt" | "es", { html: string; text: string }>
  > = {}
  for (const locale of ["en", "pt", "es"] as const) {
    const entry = value[locale]
    if (entry) result[locale] = { html: entry.html, text: entry.text }
  }
  return Object.keys(result).length > 0 ? result : null
}

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
        bioRich: toPublicRichText(expert.bioRich),
        avatarUrl: expert.avatarUrl,
        socialLinks: expert.socialLinks,
        credentials: expert.credentials,
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
          cancellationPolicy: eventType.cancellationPolicy,
          requiresApproval: eventType.requiresApproval,
          whatsIncluded: eventType.whatsIncluded,
          whatToExpect: eventType.whatToExpect,
          exampleQuestions: eventType.exampleQuestions,
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
