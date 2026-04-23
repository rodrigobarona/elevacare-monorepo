import { NextResponse } from "next/server"
import { drainAuditOutbox } from "@eleva/workflows"

/**
 * HTTP trigger for the audit outbox drainer. Called by:
 *   - QStash schedule (every 30s in staging/prod) \u2014 wiring lands with
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
  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  if (secret) {
    const header = request.headers.get("authorization") ?? ""
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  try {
    const result = await drainAuditOutbox()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
