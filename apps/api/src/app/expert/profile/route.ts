import { PatchExpertProfileRequestSchema } from "@eleva/api-client"
import { isExpertPortraitUrl } from "@eleva/config/expert-profile-content"
import { deletePublicBlob } from "@eleva/storage"
import { buildLocalizedRichText } from "@eleva/editor/build-localized-rich-text"
import { localizedRichTextWriteSchema } from "@eleva/editor/types"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { withAudit } from "@eleva/audit"
import { getExpertProfileByUserId, updateExpertProfile } from "@eleva/db"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type BioUpdate = {
  bio: string | null
  bioRich: ReturnType<typeof buildLocalizedRichText> | null
  bioSourceLocale: "en" | "pt" | "es" | null
}

/**
 * Validates the Plate node tree and derives sanitized HTML and plain text.
 * The plain-text `bio` mirrors the source locale so search keeps working.
 */
function resolveRichBio(input: unknown): BioUpdate | { issues: unknown } {
  if (input === null) return { bio: null, bioRich: null, bioSourceLocale: null }
  const parsed = localizedRichTextWriteSchema.safeParse(input)
  if (!parsed.success) return { issues: parsed.error.issues }
  const built = buildLocalizedRichText(parsed.data)
  const source = built[parsed.data.sourceLocale]
  if (!source) return { bio: null, bioRich: null, bioSourceLocale: null }
  return {
    bio: source.text,
    bioRich: built,
    bioSourceLocale: parsed.data.sourceLocale,
  }
}

export async function PATCH(request: Request) {
  const headers = corsHeaders(request, "PATCH, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:onboard")
  } catch (err) {
    const authFailure = apiAuthFailure(err, headers)
    if (authFailure) return authFailure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = PatchExpertProfileRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const data = body.data

  if (data.avatarUrl && !isExpertPortraitUrl(data.avatarUrl, session.user.id)) {
    return secureJson(
      {
        error: "validation",
        issues: [
          {
            code: "custom",
            path: ["avatarUrl"],
            message: "Portrait must be your own upload",
          },
        ],
      },
      { status: 422, headers }
    )
  }

  let bioUpdate: BioUpdate | null = null
  if (data.bioRich !== undefined) {
    const resolved = resolveRichBio(data.bioRich)
    if ("issues" in resolved) {
      return secureJson(
        { error: "validation", issues: resolved.issues },
        { status: 422, headers }
      )
    }
    bioUpdate = resolved
  } else if (data.bio !== undefined) {
    bioUpdate = { bio: data.bio ?? null, bioRich: null, bioSourceLocale: null }
  }

  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const steps = Array.isArray(completedSteps) ? [...completedSteps] : []
  if (!steps.includes("profile")) steps.push("profile")

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        await updateExpertProfile(
          profile.id,
          profile.orgId,
          {
            ...(data.nif !== undefined && { nif: data.nif ?? null }),
            ...(data.licenseScope !== undefined && {
              licenseScope: data.licenseScope ?? null,
            }),
            ...(data.languages && { languages: data.languages }),
            ...(data.practiceCountries && {
              practiceCountries: data.practiceCountries,
            }),
            ...(data.worldwideMode !== undefined && {
              worldwideMode: data.worldwideMode,
            }),
            ...(data.sessionModes && {
              sessionModes:
                data.sessionModes.length > 0 ? data.sessionModes : ["online"],
            }),
            ...(data.displayName && { displayName: data.displayName }),
            ...(data.headline !== undefined && {
              headline: data.headline ?? null,
            }),
            ...(bioUpdate ?? {}),
            ...(data.avatarUrl !== undefined && {
              avatarUrl: data.avatarUrl ?? null,
            }),
            ...(data.socialLinks && { socialLinks: data.socialLinks }),
            ...(data.credentials && { credentials: data.credentials }),
            metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
          },
          tx
        )
        await ctx.emit({
          entity: "expert_profile",
          action: "updated",
          entityId: profile.id,
          payload: { fields: Object.keys(data) },
        })
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson({ error: "internal", message }, { status: 500, headers })
  }

  const previousPortrait = profile.avatarUrl
  if (
    data.avatarUrl !== undefined &&
    previousPortrait &&
    previousPortrait !== data.avatarUrl &&
    isExpertPortraitUrl(previousPortrait, session.user.id)
  ) {
    try {
      await deletePublicBlob(previousPortrait)
    } catch (err) {
      console.warn("[expert/profile] failed to delete old portrait", err)
    }
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PATCH, OPTIONS"),
  })
}
