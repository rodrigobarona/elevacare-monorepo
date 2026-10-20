import { EmptyRequestSchema } from "@eleva/api-client"
import { secureJson } from "@/lib/security-headers"

/**
 * Action POSTs take no input. Accept an absent body or `{}`; reject any
 * other payload with 422 so callers learn that extra fields are ignored.
 */
export async function rejectUnexpectedBody(
  request: Request,
  headers: Record<string, string>
): Promise<Response | null> {
  const raw = (await request.text().catch(() => "")).trim()
  if (raw === "") return null

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return secureJson(
      { error: "validation", message: "body must be empty or {}" },
      { status: 422, headers }
    )
  }
  const parsed = EmptyRequestSchema.safeParse(json)
  if (parsed.success) return null
  return secureJson(
    { error: "validation", issues: parsed.error.issues },
    { status: 422, headers }
  )
}
