import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession } from "@eleva/auth"
import { getAdapter, type InvoicingProviderSlug } from "@eleva/accounting"
import {
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
import { corsHeaders } from "@/lib/cors"

/**
 * GET /accounting/status
 *
 * Returns the current invoicing adapter connection status for the
 * authenticated expert. Used by the onboarding wizard to poll
 * connection state after an OAuth redirect.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}

export async function GET(request: Request) {
  const cors = corsHeaders(request, "GET, OPTIONS")

  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: cors }
    )
  }

  const expert = await withPlatformAdminContext(async (tx: Tx) => {
    const [row] = await tx
      .select({
        id: main.expertProfiles.id,
        orgId: main.expertProfiles.orgId,
        invoicingProvider: main.expertProfiles.invoicingProvider,
        invoicingSetupStatus: main.expertProfiles.invoicingSetupStatus,
      })
      .from(main.expertProfiles)
      .where(eq(main.expertProfiles.userId, session.user.id))
      .limit(1)
    return row ?? null
  })

  if (!expert) {
    return NextResponse.json(
      { error: "no-expert-profile" },
      { status: 404, headers: cors }
    )
  }

  if (
    expert.invoicingSetupStatus === "not_started" ||
    !expert.invoicingProvider
  ) {
    return NextResponse.json(
      {
        provider: null,
        setupStatus: expert.invoicingSetupStatus,
        adapterStatus: null,
      },
      { headers: cors }
    )
  }

  let adapterStatus = null
  if (
    expert.invoicingSetupStatus === "connected" &&
    expert.invoicingProvider !== "manual"
  ) {
    const cred = await withOrgContext(expert.orgId, async (tx: Tx) => {
      const [row] = await tx
        .select()
        .from(main.expertIntegrationCredentials)
        .where(
          and(
            eq(main.expertIntegrationCredentials.expertProfileId, expert.id),
            eq(
              main.expertIntegrationCredentials.provider,
              expert.invoicingProvider!
            ),
            isNull(main.expertIntegrationCredentials.deletedAt)
          )
        )
        .limit(1)
      return row ?? null
    })

    if (cred) {
      try {
        const adapter = getAdapter(
          expert.invoicingProvider as InvoicingProviderSlug
        )
        adapterStatus = await adapter.status({
          vaultRef: cred.vaultRef,
          metadata: cred.metadata ?? undefined,
        })
      } catch (err) {
        adapterStatus = {
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  }

  return NextResponse.json(
    {
      provider: expert.invoicingProvider,
      setupStatus: expert.invoicingSetupStatus,
      adapterStatus,
    },
    { headers: cors }
  )
}
