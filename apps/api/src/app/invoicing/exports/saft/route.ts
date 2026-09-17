import {
  ExportSaftQuerySchema,
  ExportSaftResponseSchema,
} from "@eleva/api-client"
import {
  SAFT_SIGNED_URL_TTL_SECONDS,
  buildSaftCsv,
  buildSaftDownloadUrl,
  buildSaftXmlSkeleton,
  isSaftExportError,
  listSaftExportRows,
  saftBlobPathname,
  saftMonthRange,
} from "@eleva/accounting"
import { createZipBuffer } from "@eleva/compliance"
import { uploadPrivateBlob } from "@eleva/storage"
import { createHash } from "node:crypto"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function apiBaseUrl(request: Request): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    new URL(request.url).origin
  ).replace(/\/+$/, "")
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, "GET, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:invoicing_manage")
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  const url = new URL(request.url)
  const query = ExportSaftQuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
  })
  if (!query.success) {
    return secureJson(
      { error: "validation", issues: query.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const { rows, truncated } = await listSaftExportRows({
      orgId: session.orgId,
      month: query.data.month,
    })
    const encoder = new TextEncoder()
    const csv = buildSaftCsv(rows, { truncated })
    const xml = buildSaftXmlSkeleton({
      month: query.data.month,
      rows,
      truncated,
      generatedAt: saftMonthRange(query.data.month).end,
    })
    const zip = createZipBuffer([
      {
        name: `eleva-invoices-${query.data.month}.csv`,
        data: encoder.encode(csv),
      },
      {
        name: `eleva-saft-${query.data.month}.xml`,
        data: encoder.encode(xml),
      },
    ])
    const contentHash = createHash("sha256")
      .update(zip)
      .digest("hex")
      .slice(0, 16)
    const uploaded = await uploadPrivateBlob({
      pathname: saftBlobPathname(session.orgId, query.data.month, contentHash),
      body: zip,
      contentType: "application/zip",
      overwrite: true,
    })
    const expiresAt = new Date(Date.now() + SAFT_SIGNED_URL_TTL_SECONDS * 1000)
    const downloadUrl = buildSaftDownloadUrl({
      apiBaseUrl: apiBaseUrl(request),
      orgId: session.orgId,
      month: query.data.month,
      pathname: uploaded.pathname,
      expiresAt,
    })

    return secureJson(
      ExportSaftResponseSchema.parse({
        month: query.data.month,
        invoiceCount: rows.length,
        truncated,
        expiresAt: expiresAt.toISOString(),
        downloadUrl,
      }),
      { status: 200, headers }
    )
  } catch (err) {
    if (isSaftExportError(err)) {
      return secureJson(
        { error: "validation" },
        { status: err.status, headers }
      )
    }
    console.error("[invoicing/exports/saft] unexpected error", err)
    return secureJson({ error: "internal" }, { status: 500, headers })
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
