import { corsHeaders } from "@/lib/cors"
import { authorizeInternalWorkflow } from "@/lib/internal-workflow"
import { secureJson } from "@/lib/security-headers"
import type { RoutePolicy } from "@/lib/route-policy"
import { reportedJob } from "@/lib/reported-job"
import { publishPasses } from "@/lib/publish-domain-events"
import { runJobAgain, runJobAt, whichRun } from "@/lib/run-job-at"

export const ROUTE_POLICY = {
  auth: "internal",
  rateLimit: false,
  botId: false,
} as const satisfies RoutePolicy

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** 20 passes of 25: what one run publishes before it asks for another. */
const PASSES_OF_A_RUN = 20

export const POST = reportedJob(
  "domain-events-publisher",
  async (request: Request) => {
    const headers = corsHeaders(request, "POST, OPTIONS")
    const denied = await authorizeInternalWorkflow(request)
    if (denied) return denied

    try {
      // As many passes as a run can reasonably make: a backlog is not
      // left at 25 an hour.
      const { more, ...result } = await publishPasses(PASSES_OF_A_RUN)
      const { again, fromTick } = await whichRun(request)
      if (more) {
        await runJobAt("domain-events-publisher", new Date())
      } else if (result.failed > 0 && !fromTick) {
        // A delivery that failed is due again in a minute or two, and
        // this job's own schedule is hourly: ask for the run that tries
        // again. Not after the tick's own run: the next tick is that.
        await runJobAgain("domain-events-publisher", again)
      }
      return secureJson({ ok: true, ...result }, { status: 200, headers })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return secureJson(
        { ok: false, error: "internal", message },
        { status: 500, headers }
      )
    }
  }
)

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
