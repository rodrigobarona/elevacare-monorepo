import { withPhiScope } from "@eleva/observability"
import type { RoutePolicy } from "@/lib/route-policy"
import { handleSetPublished, publishOptions } from "../set-published"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string; recordId: string }> }
) {
  return withPhiScope(() => handleSetPublished(request, params, true))
}

export function OPTIONS(request: Request) {
  return publishOptions(request)
}
