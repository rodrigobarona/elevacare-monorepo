import { unstable_cache } from "next/cache"
import {
  ListPublicExpertsQuerySchema,
  ListPublicExpertsResponseSchema,
} from "@eleva/api-client"
import { listPublicMarketplaceExperts } from "@eleva/db"
import { handlePublicGet, publicOptions } from "@/lib/public-marketplace"
import { secureJson } from "@/lib/security-headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  return handlePublicGet(request, async (headers) => {
    const parsed = ListPublicExpertsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams)
    )
    if (!parsed.success) {
      return secureJson(
        { error: "validation", issues: parsed.error.issues },
        { status: 422, headers }
      )
    }

    const result = await unstable_cache(
      () => listPublicMarketplaceExperts(parsed.data),
      ["public-experts", JSON.stringify(parsed.data)],
      { tags: ["public-experts"], revalidate: 60 }
    )()

    return secureJson(ListPublicExpertsResponseSchema.parse(result), {
      status: 200,
      headers,
    })
  })
}

export function OPTIONS(request: Request) {
  return publicOptions(request)
}
