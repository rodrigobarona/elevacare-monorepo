import { Client } from "@upstash/qstash"

export async function publishWorkflowJob(
  path: string,
  body: Record<string, unknown>
): Promise<"published" | "inline"> {
  const token = process.env.QSTASH_TOKEN
  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  const apiBase = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ""
  ).replace(/\/+$/, "")

  if (!token || !secret || !apiBase || apiBase.includes("localhost")) {
    return "inline"
  }

  const destination = `${apiBase}${path.startsWith("/") ? path : `/${path}`}`
  let parsed: URL
  try {
    parsed = new URL(destination)
  } catch {
    throw new Error("workflow destination is not a valid URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("workflow destination must use https")
  }

  const client = new Client({ token })
  await client.publishJSON({
    url: destination,
    body,
    headers: { Authorization: `Bearer ${secret}` },
  })
  return "published"
}

export function authorizeWorkflowSecret(request: Request): boolean {
  const secret = process.env.WORKFLOWS_DRAIN_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}
