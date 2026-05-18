import { drainAuditOutbox } from "@eleva/workflows/drainers"
import { corsHeaders } from "@/lib/cors"
import { secureJson } from "@/lib/security-headers"

/**
 * HTTP trigger for the audit outbox drainer. Called by:
 *   - QStash schedule (every 30s in staging/prod) — wiring lands with
 *     infra/qstash in S4.
 *   - The operator dashboard "manual drain" button in S6.
 *   - CI integration test.
 *
 * Authz: bearer token that matches QSTASH_CURRENT_SIGNING_KEY or
 * QSTASH_NEXT_SIGNING_KEY once signing is enabled in S4. In S1 the
 * endpoint requires WORKFLOWS_DRAIN_SECRET so we can exercise it end
 * to end without pulling QStash in early.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")

  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  if (!secret) {
    return secureJson(
      {
        error: "server_misconfiguration",
        message: "WORKFLOWS_DRAIN_SECRET is required",
      },
      { status: 500, headers }
    )
  }
  const authHeader = request.headers.get("authorization") ?? ""
  if (authHeader !== `Bearer ${secret}`) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  try {
    const result = await drainAuditOutbox()
    return secureJson({ ok: true, ...result }, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
