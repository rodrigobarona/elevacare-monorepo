import { and, eq, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession, LOGIN_PATH } from "@eleva/auth"
import { resolveExpertWorkspaceBase } from "@eleva/auth/org-routing"
import {
  getAdapter,
  parseAccountingOAuthState,
  storedAccountingOAuthNonce,
  verifyStoredAccountingOAuthNonce,
  type ConnectInput,
} from "@eleva/accounting"
import { auth, main, withPlatformAdminContext, type Tx } from "@eleva/db"
import { withAudit } from "@eleva/audit"
import { env, resolveGatewayUrl } from "@eleva/config/env"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

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
 * State encodes: `<provider>:<expertProfileId>:<nonce>`
 * The nonce is stored on the expert profile at connect time and consumed
 * here so a callback URL cannot be replayed onto another session.
 *
 * On success, exchanges code for tokens via the adapter's `connect()`
 * method and persists the vault ref + metadata in
 * `expert_integrations` (category = 'invoicing').
 */

class OAuthNonceConsumedError extends Error {
  constructor() {
    super("oauth_nonce_consumed")
    this.name = "OAuthNonceConsumedError"
  }
}

function withInvoicingStep(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const completedSteps = metadata.completedSteps
  const nextCompletedSteps = Array.isArray(completedSteps)
    ? [...completedSteps]
    : []
  if (!nextCompletedSteps.includes("invoicing")) {
    nextCompletedSteps.push("invoicing")
  }
  return { ...metadata, completedSteps: nextCompletedSteps }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const appUrl = env().APP_URL || request.url

  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL(LOGIN_PATH, appUrl))
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated
  )
  if (rateLimited) return rateLimited

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

  const parsedState = parseAccountingOAuthState(state)
  if (!parsedState) {
    return NextResponse.redirect(
      onboardingUrl(
        "invoicing_error=invalid_state",
        session.orgSlug,
        session.orgType
      )
    )
  }
  const { provider: providerSlug, expertProfileId } = parsedState

  try {
    const adapter = getAdapter(providerSlug)

    const expert = await withPlatformAdminContext(async (tx: Tx) => {
      const [row] = await tx
        .select({
          id: main.expertProfiles.id,
          orgId: main.expertProfiles.orgId,
          userId: main.expertProfiles.userId,
          metadata: main.expertProfiles.metadata,
          orgSlug: auth.organization.slug,
          orgType: auth.organization.type,
        })
        .from(main.expertProfiles)
        .innerJoin(
          auth.organization,
          eq(main.expertProfiles.orgId, auth.organization.id)
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

    const storedNonce = storedAccountingOAuthNonce(
      (expert.metadata ?? {}) as Record<string, unknown>
    )
    if (
      !verifyStoredAccountingOAuthNonce({
        stored: storedNonce,
        state: parsedState,
        userId: session.user.id,
      })
    ) {
      return NextResponse.redirect(
        onboardingUrl(
          "invoicing_error=invalid_state",
          expert.orgSlug,
          expert.orgType
        )
      )
    }

    try {
      await withAudit(
        { orgId: expert.orgId, actorUserId: session.user.id },
        async (tx, ctx) => {
          const [consumed] = await tx
            .update(main.expertProfiles)
            .set({
              metadata: sql`coalesce(${main.expertProfiles.metadata}, '{}'::jsonb) - 'accountingOAuth'`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(main.expertProfiles.id, expert.id),
                eq(main.expertProfiles.userId, session.user.id),
                sql`${main.expertProfiles.metadata}->'accountingOAuth'->>'nonce' = ${parsedState.nonce}`,
                sql`${main.expertProfiles.metadata}->'accountingOAuth'->>'provider' = ${parsedState.provider}`,
                sql`${main.expertProfiles.metadata}->'accountingOAuth'->>'userId' = ${session.user.id}`,
                sql`(coalesce(${main.expertProfiles.metadata}->'accountingOAuth'->>'exp', '0'))::bigint >= ${Date.now()}`
              )
            )
            .returning({ id: main.expertProfiles.id })
          if (!consumed) {
            throw new OAuthNonceConsumedError()
          }
          await ctx.emit({
            entity: "expert_profile",
            action: "updated",
            entityId: expert.id,
            payload: { field: "invoicing_oauth_nonce", consumed: true },
          })
        }
      )
    } catch (err) {
      if (err instanceof OAuthNonceConsumedError) {
        return NextResponse.redirect(
          onboardingUrl(
            "invoicing_error=invalid_state",
            expert.orgSlug,
            expert.orgType
          )
        )
      }
      throw err
    }

    const connectInput: ConnectInput = {
      expertProfileId: expert.id,
      orgId: expert.orgId,
      userId: expert.userId,
      payload: { code },
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

          const [current] = await tx
            .select({ metadata: main.expertProfiles.metadata })
            .from(main.expertProfiles)
            .where(eq(main.expertProfiles.id, expert.id))
            .limit(1)
            .for("update")
          const currentMetadata: Record<string, unknown> = {
            ...((current?.metadata ?? {}) as Record<string, unknown>),
          }

          await tx
            .update(main.expertProfiles)
            .set({
              invoicingProvider: providerSlug,
              invoicingSetupStatus: "connected",
              metadata: {
                ...withInvoicingStep(currentMetadata),
                invoicingProvider: providerSlug,
              },
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
