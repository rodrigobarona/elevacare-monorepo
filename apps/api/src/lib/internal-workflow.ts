import { captureException } from "@eleva/observability"
import { corsHeaders } from "@/lib/cors"
import { secureJson } from "@/lib/security-headers"

export async function runInternalWorkflow(
  request: Request,
  run: () => Promise<Record<string, unknown>>
): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  if (!secret) {
    return secureJson(
      {
        error: "server_misconfiguration",
        message: "WORKFLOWS_DRAIN_SECRET is required",
      },
      { status: 500, headers }
    )
  }
  const authHeader = request.headers.get("authorization") ?? ""
  if (authHeader !== `Bearer ${secret}`) {
    return secureJson({ error: "unauthorized" }, { status: 401, headers })
  }
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
