import { corsHeaders } from "@/lib/cors"
import { requireApiAuth } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import { UnauthorizedError } from "@eleva/auth"
import { getExpertProfileByUserId, listCalendarIntegrations } from "@eleva/db"
import {
  getAdapter,
  getCalendarToken,
  type CalendarProvider,
} from "@eleva/calendar"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLUG_TO_PROVIDER: Record<string, CalendarProvider> = {
  "google-calendar": "google",
  "microsoft-calendar": "microsoft",
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const headers = corsHeaders(request, "GET, OPTIONS")

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

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const { id } = await params

  const integrations = await listCalendarIntegrations(profile.orgId, profile.id)
  const integration = integrations.find((i) => i.id === id)
  if (!integration) {
    return secureJson(
      { error: "not found", message: "integration not found" },
      { status: 404, headers }
    )
  }

  const provider = SLUG_TO_PROVIDER[integration.slug]
  if (!provider) {
    return secureJson(
      { error: "not found", message: "unknown provider" },
      { status: 404, headers }
    )
  }

  try {
    const accessToken = await getCalendarToken(
      session.user.workosUserId,
      provider
    )
    const adapter = getAdapter(provider)
    const subCalendars = await adapter.listCalendars(accessToken)

    return secureJson(
      {
        calendars: subCalendars.map((c) => ({
          id: c.id,
          name: c.name,
          primary: c.primary,
          email: c.email,
        })),
      },
      { status: 200, headers }
    )
  } catch {
    return secureJson(
      {
        error: "provider_error",
        message: "failed to fetch calendars from provider",
      },
      { status: 502, headers }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
