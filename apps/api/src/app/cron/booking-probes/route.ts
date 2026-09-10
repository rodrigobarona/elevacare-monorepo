import { NextResponse } from "next/server"

import { createPaymentIntentForReservation } from "@eleva/billing/server"
import { env, requireCronSecret } from "@eleva/config/env"
import { heartbeat, reportProbeFailure } from "@eleva/observability"
import type { RoutePolicy } from "@/lib/route-policy"
import {
  BOOKING_PROBE_FAKE_RESERVATION_ID,
  BOOKING_PROBE_FAKE_TOKEN,
  recoverIntentCheck,
  runBookingFunnelProbes,
} from "@/lib/booking-probes"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * Staging synthetic checks for the public booking funnel.
 *
 * Triggered daily at 06:15 UTC by Vercel Cron (`apps/api/vercel.json`).
 * Hobby runs each job once per day, sometime in 06:00–06:59 UTC (the
 * scheduled hour). Auth is `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Probes (no real reservation, no Stripe PaymentIntent):
 *   1. GET seeded `fisiomota/first-visit` slots
 *   2. POST `/payments/intent` with a fake reservation (404/422 healthy)
 *
 * Failures go to Sentry via `reportProbeFailure` (on-call). Success
 * pings BetterStack `heartbeat("booking-probes")`.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

function resolveProbeBaseUrl(request: Request): string | undefined {
  const configured = env().API_URL || env().NEXT_PUBLIC_API_URL
  if (configured) return configured.replace(/\/$/, "")
  try {
    return new URL(request.url).origin
  } catch {
    return undefined
  }
}

export async function GET(request: Request): Promise<Response> {
  let secret: string
  try {
    secret = requireCronSecret().CRON_SECRET
  } catch (err) {
    console.error("[cron/booking-probes] CRON_SECRET not configured", err)
    return NextResponse.json(
      { error: "cron-not-configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  const baseUrl = resolveProbeBaseUrl(request)
  if (!baseUrl) {
    return NextResponse.json(
      { error: "api-url-not-configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }

  const startedAt = Date.now()
  const report = await runBookingFunnelProbes({ baseUrl })
  const checks = await Promise.all(
    report.checks.map(async (check) => {
      if (check.name !== "intent" || !check.blockedByBotId) {
        return check
      }
      const domain = await createPaymentIntentForReservation({
        reservationId: BOOKING_PROBE_FAKE_RESERVATION_ID,
        reservationToken: BOOKING_PROBE_FAKE_TOKEN,
      })
      return recoverIntentCheck(check, domain.ok ? "created" : domain.error)
    })
  )
  const allOk = checks.every((check) => check.ok)

  if (allOk) {
    await heartbeat("booking-probes")
  } else {
    await reportProbeFailure(
      "booking-probes",
      new Error("booking funnel probe failed"),
      { checks }
    )
  }

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      checks,
    },
    {
      status: allOk ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
