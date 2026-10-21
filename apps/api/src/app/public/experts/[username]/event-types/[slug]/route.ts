import { PublicEventTypeDetailSchema } from "@eleva/api-client"
import {
  findPublicBookableEventType,
  listPublicEventTypeModes,
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

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string; slug: string }> }
) {
  return handlePublicGet(request, async (headers) => {
    const { username, slug } = await context.params
    const target = await findPublicBookableEventType(username, slug)
    if (!target) {
      return secureJson(PUBLIC_NOT_FOUND, { status: 404, headers })
    }
    const { expert, eventType } = target

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
        cancellationPolicy: eventType.cancellationPolicy,
        requiresApproval: eventType.requiresApproval,
        instantBookLeadMinutes: eventType.instantBookLeadMinutes,
        whatsIncluded: eventType.whatsIncluded,
        whatToExpect: eventType.whatToExpect,
        exampleQuestions: eventType.exampleQuestions,
        modes: modesByEventType.get(eventType.id) ?? [],
      }),
      { status: 200, headers }
    )
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
