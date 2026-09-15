import { eq } from "drizzle-orm"
import {
  AdapterError,
  ACCOUNTING_OAUTH_STATE_TTL_MS,
  createAccountingOAuthNonce,
  encodeAccountingOAuthState,
  getAdapter,
  InvoicingProviderSlug,
} from "@eleva/accounting"
import { withAudit } from "@eleva/audit"
import { getFlag } from "@eleva/flags"
import { getExpertProfileByUserId, main } from "@eleva/db"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { checkBot } from "@/lib/bot-protection"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ProviderParamSchema = InvoicingProviderSlug

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:invoicing_manage")
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  if (
    session.authMode !== "bearer" &&
    session.authMode !== "jwt" &&
    session.authMode !== "api-key"
  ) {
    const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
    if (botVerdict?.isBot) {
      return secureJson({ error: "blocked" }, { status: 403, headers })
    }
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  const { provider: rawProvider } = await params
  const parsed = ProviderParamSchema.safeParse(rawProvider)
  if (!parsed.success) {
    return secureJson(
      { error: "validation", issues: parsed.error.issues },
      { status: 422, headers }
    )
  }
  const provider = parsed.data

  if (provider === "manual") {
    return secureJson(
      { error: "validation", message: "manual invoicing does not use OAuth" },
      { status: 422, headers }
    )
  }

  const [appsEnabled, providerEnabled] = await Promise.all([
    getFlag("ff.expert_invoicing_apps_enabled"),
    provider === "toconline"
      ? getFlag("ff.invoicing.toconline")
      : getFlag("ff.invoicing.moloni"),
  ])
  if (!appsEnabled || !providerEnabled) {
    return secureJson(
      { error: "flag_disabled", message: "invoicing provider is not enabled" },
      { status: 403, headers }
    )
  }

  const profile = await getExpertProfileByUserId(session.user.id)
  if (!profile) {
    return secureJson(
      { error: "not_found", message: "no expert profile" },
      { status: 404, headers }
    )
  }

  const adapter = getAdapter(provider)
  if (!adapter.buildAuthUrl) {
    return secureJson(
      { error: "validation", message: "provider does not support OAuth" },
      { status: 422, headers }
    )
  }

  const nonce = createAccountingOAuthNonce()
  const state = encodeAccountingOAuthState({
    provider,
    expertProfileId: profile.id,
    nonce,
  })

  try {
    await withAudit(
      { orgId: profile.orgId, actorUserId: session.user.id },
      async (tx, ctx) => {
        const [current] = await tx
          .select({ metadata: main.expertProfiles.metadata })
          .from(main.expertProfiles)
          .where(eq(main.expertProfiles.id, profile.id))
          .limit(1)
          .for("update")
        const metadata: Record<string, unknown> = {
          ...((current?.metadata ?? {}) as Record<string, unknown>),
          accountingOAuth: {
            nonce,
            provider,
            userId: session.user.id,
            expertProfileId: profile.id,
            exp: Date.now() + ACCOUNTING_OAUTH_STATE_TTL_MS,
          },
        }

        await tx
          .update(main.expertProfiles)
          .set({
            invoicingProvider: provider,
            invoicingSetupStatus: "connecting",
            metadata,
            updatedAt: new Date(),
          })
          .where(eq(main.expertProfiles.id, profile.id))

        await ctx.emit({
          entity: "expert_profile",
          action: "updated",
          entityId: profile.id,
          payload: { field: "invoicing", provider, status: "connecting" },
        })
      }
    )

    const auth = await adapter.buildAuthUrl({
      state,
      expertProfileId: profile.id,
    })
    if (!auth?.url) {
      return secureJson(
        { error: "provider", message: "failed to build authorization URL" },
        { status: 502, headers }
      )
    }
    return secureJson({ url: auth.url }, { status: 200, headers })
  } catch (err) {
    if (err instanceof AdapterError) {
      const status = err.kind === "fatal" ? 503 : 502
      return secureJson(
        { error: "provider", message: err.message },
        { status, headers }
      )
    }
    throw err
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
