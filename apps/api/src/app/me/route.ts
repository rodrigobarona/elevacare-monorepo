import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireMemberApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import {
  PatchMeRequestSchema,
  MeProfileSchema,
  type MeProfile,
} from "@eleva/api-client"
import { locales, type Locale } from "@eleva/config/i18n"
import { getMemberProfile, listMemberNotificationPreferences } from "@eleva/db"
import { updateMemberProfile } from "@eleva/auth"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BLOB_HOST_PATTERN = /\.public\.blob\.vercel-storage\.com$/

function isLocale(value: string | null): value is Locale {
  return value !== null && (locales as readonly string[]).includes(value)
}

function toProfile(
  profile: {
    id: string
    email: string
    name: string
    timezone: string | null
    locale: string | null
    avatarUrl: string | null
  },
  preferences: MeProfile["preferences"]
): MeProfile {
  return MeProfileSchema.parse({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    timezone: profile.timezone,
    locale: isLocale(profile.locale) ? profile.locale : null,
    avatarUrl: profile.avatarUrl,
    preferences,
  })
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, PATCH, OPTIONS")

  let session
  try {
    session = await requireMemberApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const [profile, preferences] = await Promise.all([
    getMemberProfile(session.user.id),
    listMemberNotificationPreferences(session.user.id),
  ])
  if (!profile) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }

  return secureJson(toProfile(profile, preferences), { status: 200, headers })
}

export async function PATCH(request: Request) {
  const headers = corsHeaders(request, "GET, PATCH, OPTIONS")

  let session
  try {
    session = await requireMemberApiAuth(request)
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

  const body = PatchMeRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  if (body.data.avatarUrl) {
    try {
      const parsed = new URL(body.data.avatarUrl)
      if (
        parsed.protocol !== "https:" ||
        !BLOB_HOST_PATTERN.test(parsed.hostname)
      ) {
        return secureJson(
          {
            error: "validation",
            message: "avatarUrl must be a public Blob URL",
          },
          { status: 422, headers }
        )
      }
    } catch {
      return secureJson(
        { error: "validation", message: "avatarUrl must be a public Blob URL" },
        { status: 422, headers }
      )
    }
  }

  const updated = await updateMemberProfile({
    userId: session.user.id,
    orgId: session.orgId,
    name: body.data.name,
    timezone: body.data.timezone,
    locale: body.data.locale,
    avatarUrl: body.data.avatarUrl,
  })
  if (!updated) {
    return secureJson({ error: "not found" }, { status: 404, headers })
  }
  const preferences = await listMemberNotificationPreferences(session.user.id)
  return secureJson(toProfile(updated, preferences), { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, PATCH, OPTIONS"),
  })
}
