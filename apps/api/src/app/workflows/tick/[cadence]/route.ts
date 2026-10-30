import { corsHeaders } from "@/lib/cors"
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
 * POST /workflows/tick/{cadence}
 *
 * One QStash schedule per cadence instead of one per job: the plan's
 * schedule quota (10) is smaller than the number of recurring jobs. Each
 * job keeps its own route (manual runs, tests); a tick calls those
 * handlers in-process, in parallel, so one failing job never blocks the
 * others. Every job is idempotent, so a QStash retry of the whole tick is
 * safe. Authz: Bearer `WORKFLOWS_DRAIN_SECRET` or a QStash signature.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cadence: string }> }
) {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const denied = await authorizeInternalWorkflow(request)
  if (denied) return denied

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

  const results: Record<string, { status: number; body?: unknown }> = {}
  let failed = 0
  settled.forEach((outcome, index) => {
    const name = jobs[index]![0]
    if (outcome.status === "fulfilled") {
      results[name] = outcome.value
      if (outcome.value.status >= 400) failed += 1
    } else {
      results[name] = { status: 500 }
      failed += 1
    }
  })

  // 500 lets QStash record the tick as failed; each job reports its own
  // errors to Sentry from its handler.
  return secureJson(
    { ok: failed === 0, cadence, failed, results },
    { status: failed === 0 ? 200 : 500, headers }
  )
}

export async function OPTIONS(request: Request) {
  return internalWorkflowOptions(request)
}
