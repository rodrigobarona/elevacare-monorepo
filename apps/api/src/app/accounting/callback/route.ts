import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession, LOGIN_PATH } from "@eleva/auth"
import { resolveExpertWorkspaceBase } from "@eleva/auth/org-routing"
import {
  getAdapter,
  InvoicingProviderSlug,
  type ConnectInput,
} from "@eleva/accounting"
import { main, withPlatformAdminContext, type Tx } from "@eleva/db"
import { withAudit } from "@eleva/audit"
import { env, resolveGatewayUrl } from "@eleva/config/env"

function onboardingUrl(
  query: string,
  orgSlug: string | null | undefined,
  orgType: string | null | undefined
): URL {
  const gateway = resolveGatewayUrl()
  if (orgSlug) {
    const base = resolveExpertWorkspaceBase(orgSlug, orgType)
    return new URL(`${base}/setup?${query}`, gateway)
  }
  return new URL(`/onboarding?${query}`, gateway)
}

/**
 * GET /accounting/callback
 *
 * OAuth redirect target for invoicing provider flows (TOConline, Moloni).
 * The provider sends `?code=...&state=...` after the expert authorizes.
 *
 * State encodes: `<provider>:<expertProfileId>:<codeVerifier>`
 *
 * On success, exchanges code for tokens via the adapter's `connect()`
 * method and persists the vault ref + metadata in
 * `expert_integrations` (category = 'invoicing').
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const appUrl = env().APP_URL || request.url

  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL(LOGIN_PATH, appUrl))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    console.error("[accounting/callback] Provider error:", error)
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=provider_denied",
        session.orgSlug,
        session.orgType
      )
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=missing_params",
        session.orgSlug,
        session.orgType
      )
    )
  }

  const parts = state.split(":")
  if (parts.length < 3) {
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=invalid_state",
        session.orgSlug,
        session.orgType
      )
    )
  }

  const [rawProvider, expertProfileId, codeVerifier] = parts as [
    string,
    string,
    string,
  ]

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(expertProfileId) || !codeVerifier) {
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=invalid_state",
        session.orgSlug,
        session.orgType
      )
    )
  }

  const parsed = InvoicingProviderSlug.safeParse(rawProvider)
  if (!parsed.success) {
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=invalid_provider",
        session.orgSlug,
        session.orgType
      )
    )
  }
  const providerSlug = parsed.data

  try {
    const adapter = getAdapter(providerSlug)

    const expert = await withPlatformAdminContext(async (tx: Tx) => {
      const [row] = await tx
        .select({
          id: main.expertProfiles.id,
          orgId: main.expertProfiles.orgId,
          userId: main.expertProfiles.userId,
          orgSlug: main.organizations.slug,
          orgType: main.organizations.type,
        })
        .from(main.expertProfiles)
        .innerJoin(
          main.organizations,
          eq(main.expertProfiles.orgId, main.organizations.id)
        )
        .where(eq(main.expertProfiles.id, expertProfileId))
        .limit(1)
      return row ?? null
    })

    if (!expert || expert.userId !== session.user.id) {
      return NextResponse.redirect(
        onboardingUrl(
          "invoicing_error=not_found",
          session.orgSlug,
          session.orgType
        )
      )
    }

    const connectInput: ConnectInput = {
      expertProfileId: expert.id,
      orgId: expert.orgId,
      userId: expert.userId,
      payload: { code, codeVerifier },
    }

    const result = await adapter.connect(connectInput)

    try {
      await withAudit(
        { orgId: expert.orgId, actorUserId: session.user.id },
        async (tx, ctx) => {
          const [integration] = await tx
            .insert(main.expertIntegrations)
            .values({
              orgId: expert.orgId,
              expertProfileId: expert.id,
              category: "invoicing",
              slug: providerSlug,
              connectType: "oauth",
              vaultRef: result.vaultRef,
              metadata: result.metadata ?? {},
              status: "connected",
              connectedAt: new Date(),
              expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
            })
            .onConflictDoUpdate({
              target: [
                main.expertIntegrations.expertProfileId,
                main.expertIntegrations.slug,
              ],
              set: {
                vaultRef: result.vaultRef,
                connectType: "oauth",
                category: "invoicing",
                metadata: result.metadata ?? {},
                status: "connected",
                connectedAt: new Date(),
                expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
                updatedAt: new Date(),
              },
            })
            .returning({ id: main.expertIntegrations.id })

          await tx
            .update(main.expertProfiles)
            .set({
              invoicingProvider: providerSlug,
              invoicingSetupStatus: "connected",
              updatedAt: new Date(),
            })
            .where(eq(main.expertProfiles.id, expert.id))

          await ctx.emit({
            entity: "expert_integration_credential",
            action: "connected",
            entityId: integration!.id,
            payload: { provider: providerSlug, category: "invoicing" },
          })
        }
      )
    } catch (dbErr) {
      try {
        await adapter.disconnect({ vaultRef: result.vaultRef })
      } catch (disconnectErr) {
        console.error(
          "[accounting/callback] Vault cleanup failed after DB error",
          { vaultRef: result.vaultRef, error: disconnectErr }
        )
      }
      throw dbErr
    }

    return NextResponse.redirect(
      onboardingUrl("invoicing_connected=true", expert.orgSlug, expert.orgType)
    )
  } catch (err) {
    console.error("[accounting/callback] Connect failed:", err)
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=connect_failed",
        session.orgSlug,
        session.orgType
      )
    )
  }
}
