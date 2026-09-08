/** True when Better Auth sign-out failed because there is no session. */
export function isAlreadySignedOut(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const record = err as {
    status?: unknown
    body?: { code?: unknown }
    message?: unknown
  }
  if (record.status === 401) return true
  const code = record.body?.code
  if (code === "UNAUTHORIZED" || code === "FAILED_TO_GET_SESSION") return true
  return (
    typeof record.message === "string" &&
    /unauthorized|failed to get session/i.test(record.message)
  )
}
