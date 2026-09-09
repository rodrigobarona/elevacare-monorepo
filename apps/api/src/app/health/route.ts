import { NextResponse } from "next/server"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "public",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "eleva-api",
    zone: "/api",
    timestamp: new Date().toISOString(),
  })
}
