import { z } from "zod"
import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { getExpertProfileByUserId, updateExpertProfile } from "@eleva/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_SESSION_MODES = ["online", "in_person", "phone"] as const

const PatchProfileSchema = z.object({
  nif: z.string().nullish(),
  licenseScope: z.string().nullish(),
  languages: z.array(z.string()).optional(),
  practiceCountries: z.array(z.string()).optional(),
  worldwideMode: z.boolean().optional(),
  sessionModes: z.array(z.enum(ALLOWED_SESSION_MODES)).optional(),
  displayName: z.string().min(1).optional(),
  headline: z.string().nullish(),
  bio: z.string().nullish(),
})

export async function PATCH(request: Request) {
  const headers = corsHeaders(request, "PATCH, OPTIONS")

  let session
  try {
    session = await requireApiAuth(request)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return secureJson({ error: "unauthorized" }, { status: 401, headers })
    }
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = PatchProfileSchema.safeParse(
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

  const completedSteps = (profile.metadata as Record<string, unknown>)
    ?.completedSteps
  const steps = Array.isArray(completedSteps) ? [...completedSteps] : []
  if (!steps.includes("profile")) steps.push("profile")

  try {
    await updateExpertProfile(profile.id, profile.orgId, {
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
      ...(data.headline !== undefined && { headline: data.headline ?? null }),
      ...(data.bio !== undefined && { bio: data.bio ?? null }),
      metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return secureJson({ error: "internal", message }, { status: 500, headers })
  }

  return secureJson({ ok: true }, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "PATCH, OPTIONS"),
  })
}
