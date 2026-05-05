import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getSession } from "@eleva/auth"
import { getAdapter, type InvoicingProviderSlug } from "@eleva/accounting"
import { db, main } from "@eleva/db"
import { env } from "@eleva/config/env"

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
    headers: corsHeaders(request),
  })
}

export async function GET(request: Request) {
  const cors = corsHeaders(request)

  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: cors }
    )
  }

  const [expert] = await db()
    .select({
      id: main.expertProfiles.id,
      invoicingProvider: main.expertProfiles.invoicingProvider,
      invoicingSetupStatus: main.expertProfiles.invoicingSetupStatus,
    })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.userId, session.user.id))
    .limit(1)

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
    const [cred] = await db()
      .select()
      .from(main.expertIntegrationCredentials)
      .where(
        and(
          eq(main.expertIntegrationCredentials.expertProfileId, expert.id),
          eq(
            main.expertIntegrationCredentials.provider,
            expert.invoicingProvider
          ),
          isNull(main.expertIntegrationCredentials.deletedAt)
        )
      )
      .limit(1)

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

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? ""
  const allowOrigin = matchAllowedOrigin(origin)

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, content-type, x-correlation-id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin
  }
  return headers
}

function matchAllowedOrigin(origin: string): string | null {
  if (!origin) return null
  const e = env()
  const explicit = (e.APP_URL ?? "").replace(/\/$/, "")
  if (explicit && origin === explicit) return origin
  const url = safeUrl(origin)
  if (!url) return null
  if (
    e.NODE_ENV === "development" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    return origin
  }
  if (url.hostname.endsWith(".preview.eleva.care")) return origin
  return null
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}
