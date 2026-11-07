import { env } from "@eleva/config/env"
import { captureException } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import { bearerMatches } from "@/lib/internal-auth"
import {
  authorizeInternalWorkflow,
  internalWorkflowOptions,
} from "@/lib/internal-workflow"
import { secureJson } from "@/lib/security-headers"
import { isWorkflowTickCadence, WORKFLOW_TICKS } from "@/lib/workflow-ticks"
import type { RoutePolicy } from "@/lib/route-policy"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

/**
 * GET|POST /workflows/tick/{cadence}
 *
 * One schedule per cadence instead of one per job. Each job keeps its own
 * route (manual runs, tests); a tick calls those handlers in-process, in
 * parallel, so one failing job never blocks the others. Every job is
 * idempotent, so a retry of the whole tick is safe.
 *
 * GET is Vercel Cron (`apps/api/vercel.json`), which sends
 * `Authorization: Bearer ${CRON_SECRET}`. Ticks run on Vercel Cron, not
 * QStash: a minute tick alone is 1,440 messages a day, more than the
 * QStash daily allowance. POST (Bearer `WORKFLOWS_DRAIN_SECRET` or a
 * QStash signature) stays for manual runs.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

type TickContext = { params: Promise<{ cadence: string }> }

export async function GET(request: Request, context: TickContext) {
  // Fails closed when CRON_SECRET is unset.
  if (!bearerMatches(request.headers.get("authorization"), env().CRON_SECRET)) {
    return secureJson(
      { error: "unauthorized" },
      { status: 401, headers: corsHeaders(request, "GET, POST, OPTIONS") }
    )
  }
  return runTick(request, context)
}

export async function POST(request: Request, context: TickContext) {
  const denied = await authorizeInternalWorkflow(request)
  if (denied) return denied
  return runTick(request, context)
}

async function runTick(request: Request, { params }: TickContext) {
  const headers = corsHeaders(request, "GET, POST, OPTIONS")
  const { cadence } = await params
  if (!isWorkflowTickCadence(cadence)) {
    return secureJson({ error: "not_found" }, { status: 404, headers })
  }

  const jobs = Object.entries(WORKFLOW_TICKS[cadence])
  const settled = await Promise.allSettled(
    jobs.map(async ([name, run]) => {
      const inner = new Request(new URL(`/workflows/${name}`, request.url), {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.WORKFLOWS_DRAIN_SECRET}`,
          "content-type": "application/json",
        },
        body: "{}",
      })
      const response = await run(inner)
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as unknown,
      }
    })
  )

  const results: Record<
    string,
    { status: number; body?: unknown; error?: string }
  > = {}
  let failed = 0
  settled.forEach((outcome, index) => {
    const name = jobs[index]![0]
    if (outcome.status === "fulfilled") {
      results[name] = outcome.value
      if (outcome.value.status >= 400) failed += 1
    } else {
      void captureException(outcome.reason, { probe: "workflow-tick", name })
      results[name] = { status: 500, error: "job_threw" }
      failed += 1
    }
  })

  // 500 records the tick as failed in the cron log; jobs that answer report
  // their own errors to Sentry, jobs that throw are reported above.
  return secureJson(
    { ok: failed === 0, cadence, failed, results },
    { status: failed === 0 ? 200 : 500, headers }
  )
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
