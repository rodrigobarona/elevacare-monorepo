import { NextResponse } from "next/server"

import { pingAuditDb, pingMainDb } from "@eleva/db"
import { requireCronSecret } from "@eleva/config/env"
import { heartbeat } from "@eleva/observability"

/**
 * Keep-alive cron for the Neon main + audit databases.
 *
 * Why it exists: Neon's serverless compute autosuspends after a few
 * minutes of inactivity. On preview branches and low-traffic prod
 * windows the first request after suspend pays a 1-3s cold-start.
 * A single daily ping is enough to keep the compute warm without
 * any meaningful cost (Neon doesn't bill cold compute).
 *
 * Triggered by Vercel Cron (apps/api/vercel.json), which delivers
 * `Authorization: Bearer ${CRON_SECRET}` on every invocation. The
 * handler:
 *   1. Validates the bearer token (strict equality, fail-closed if
 *      CRON_SECRET is unset).
 *   2. Issues `SELECT 1` against both DATABASE_URL and
 *      AUDIT_DATABASE_URL via the @neondatabase/serverless HTTP
 *      driver. Today both URLs share one Neon endpoint, so this is
 *      mildly redundant; pinging both keeps the cron correct if/when
 *      audit moves to its own compute.
 *   3. Optionally pings BetterStack via @eleva/observability
 *      `heartbeat()` so the on-call dashboard surfaces missed runs.
 *
 * Returns 200 when both pings succeed, 500 when either fails. The
 * detail body is intentionally small (no stack traces) — anyone with
 * the secret can reach this route.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

interface CheckResult {
  ok: boolean
  durationMs: number
  error?: string
}

async function timed<T>(fn: () => Promise<T>): Promise<CheckResult> {
  const startedAt = Date.now()
  try {
    await fn()
    return { ok: true, durationMs: Date.now() - startedAt }
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function GET(request: Request): Promise<Response> {
  let secret: string
  try {
    secret = requireCronSecret().CRON_SECRET
  } catch (err) {
    console.error("[cron/keep-alive] CRON_SECRET not configured", err)
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

  const startedAt = Date.now()
  const [main, audit] = await Promise.all([
    timed(() => pingMainDb()),
    timed(() => pingAuditDb()),
  ])

  // Heartbeat is best-effort: never fail the cron because BetterStack
  // is unreachable. The helper itself swallows errors.
  if (main.ok && audit.ok) {
    await heartbeat("keep-alive")
  }

  const allOk = main.ok && audit.ok
  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      checks: { main, audit },
    },
    {
      status: allOk ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
