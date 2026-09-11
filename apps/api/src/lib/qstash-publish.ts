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

  const client = new Client({ token })
  await client.publishJSON({
    url: `${apiBase}${path.startsWith("/") ? path : `/${path}`}`,
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
