import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession } from "@eleva/auth"
import {
  getAdapter,
  InvoicingProviderSlug,
  type ConnectInput,
} from "@eleva/accounting"
import {
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { env } from "@eleva/config/env"

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
 * `expert_integration_credentials`.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const appUrl = env().APP_URL || request.url

  const session = await getSession()
  if (!session) {
    return NextResponse.redirect(new URL("/signin", appUrl))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    console.error("[accounting/callback] Provider error:", error)
    return NextResponse.redirect(
      new URL("/expert/onboarding?invoicing_error=provider_denied", appUrl)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/expert/onboarding?invoicing_error=missing_params", appUrl)
    )
  }

  const parts = state.split(":")
  if (parts.length < 3) {
    return NextResponse.redirect(
      new URL("/expert/onboarding?invoicing_error=invalid_state", appUrl)
    )
  }

  const [rawProvider, expertProfileId, codeVerifier] = parts as [
    string,
    string,
    string,
  ]

  const parsed = InvoicingProviderSlug.safeParse(rawProvider)
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/expert/onboarding?invoicing_error=invalid_provider", appUrl)
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
        })
        .from(main.expertProfiles)
        .where(eq(main.expertProfiles.id, expertProfileId))
        .limit(1)
      return row ?? null
    })

    if (!expert || expert.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/expert/onboarding?invoicing_error=not_found", appUrl)
      )
    }

    const connectInput: ConnectInput = {
      expertProfileId: expert.id,
      orgId: expert.orgId,
      userId: expert.userId,
      payload: { code, codeVerifier },
    }

    const result = await adapter.connect(connectInput)

    await withOrgContext(expert.orgId, async (tx: Tx) => {
      await tx
        .insert(main.expertIntegrationCredentials)
        .values({
          orgId: expert.orgId,
          expertProfileId: expert.id,
          provider: providerSlug,
          vaultRef: result.vaultRef,
          metadata: result.metadata ?? {},
          status: "active",
          connectedAt: new Date(),
          expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
        })
        .onConflictDoUpdate({
          target: [
            main.expertIntegrationCredentials.expertProfileId,
            main.expertIntegrationCredentials.provider,
          ],
          set: {
            vaultRef: result.vaultRef,
            metadata: result.metadata ?? {},
            status: "active",
            connectedAt: new Date(),
            expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
            updatedAt: new Date(),
          },
        })

      await tx
        .update(main.expertProfiles)
        .set({
          invoicingProvider: providerSlug,
          invoicingSetupStatus: "connected",
          updatedAt: new Date(),
        })
        .where(eq(main.expertProfiles.id, expert.id))
    })

    return NextResponse.redirect(
      new URL("/expert/onboarding?invoicing_connected=true", appUrl)
    )
  } catch (err) {
    console.error("[accounting/callback] Connect failed:", err)
    return NextResponse.redirect(
      new URL("/expert/onboarding?invoicing_error=connect_failed", appUrl)
    )
  }
}
