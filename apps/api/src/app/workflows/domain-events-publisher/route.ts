import { Receiver } from "@upstash/qstash"
import { publishPendingDomainEvents } from "@eleva/workflows/domain-events"
import { defaultDomainEventSubscribers } from "@eleva/workflows/subscribers"
import { corsHeaders } from "@/lib/cors"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const authorized = await authorizePublisher(request)
  if (!authorized) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }

  try {
    const result = await publishPendingDomainEvents({
      subscribers: defaultDomainEventSubscribers(),
    })
    return secureJson({ ok: true, ...result }, { status: 200, headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return secureJson(
      { ok: false, error: "internal", message },
      { status: 500, headers }
    )
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}

async function authorizePublisher(request: Request): Promise<boolean> {
  const signature = request.headers.get("upstash-signature")
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY
  const next = process.env.QSTASH_NEXT_SIGNING_KEY
  if (signature && current && next) {
    const receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next,
    })
    const body = await request.text()
    try {
      return await receiver.verify({
        signature,
        body,
      })
    } catch {
      return false
    }
  }

  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}
