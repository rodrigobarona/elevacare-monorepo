import { captureException } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import { isAuthorizedWorkflowCall } from "@/lib/internal-auth"
import { secureJson } from "@/lib/security-headers"

export async function authorizeInternalWorkflow(
  request: Request
): Promise<Response | null> {
  const headers = corsHeaders(request, "POST, OPTIONS")
  if (!process.env.WORKFLOWS_DRAIN_SECRET) {
    return secureJson(
      {
        error: "server_misconfiguration",
        message: "WORKFLOWS_DRAIN_SECRET is required",
      },
      { status: 500, headers }
    )
  }
  if (!(await isAuthorizedWorkflowCall(request))) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }
  return null
}

export async function runInternalWorkflow(
  request: Request,
  run: () => Promise<Record<string, unknown>>
): Promise<Response> {
  const denied = await authorizeInternalWorkflow(request)
  if (denied) return denied
  return executeInternalWorkflow(request, run)
}

/** For handlers that already called `authorizeInternalWorkflow` and read the body. */
export async function executeInternalWorkflow(
  request: Request,
  run: () => Promise<Record<string, unknown>>
): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")
  try {
    const result = await run()
    return secureJson({ ...result, ok: true }, { status: 200, headers })
  } catch (err) {
    void captureException(err, { probe: "internal-workflow" })
    return secureJson(
      { ok: false, error: "internal" },
      { status: 500, headers }
    )
  }
}

export function internalWorkflowOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "POST, OPTIONS"),
  })
}
