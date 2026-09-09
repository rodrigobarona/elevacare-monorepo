import { GET as handleGet, POST as handlePost } from "@eleva/auth/server/auth"
import type { RoutePolicy } from "@/lib/route-policy"

// Better Auth owns sign-in, refresh, and callback throttling. Wrapping this
// catch-all with BotID or applyRateLimit would break session refresh, M2M, and e2e.
export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = handleGet
export const POST = handlePost

export function OPTIONS(request: Request) {
  return handleGet(request)
}
