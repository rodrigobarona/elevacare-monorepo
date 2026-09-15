import { retryExpertInvoice } from "@eleva/accounting"
import { corsHeaders } from "@/lib/cors"
import type { RoutePolicy } from "@/lib/route-policy"
import { handleExpertInvoiceAction } from "../handle-action"

export const ROUTE_POLICY = {
  auth: "session",
  rateLimit: true,
  botId: true,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  return handleExpertInvoiceAction(request, params, retryExpertInvoice)
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
