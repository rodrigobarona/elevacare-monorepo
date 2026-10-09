export type JoinGrantQuery =
  | { status: "ok"; grant: string }
  | { status: "missing" }
  | { status: "invalid" }

export function parseJoinGrantQuery(
  value: string | string[] | undefined
): JoinGrantQuery {
  if (Array.isArray(value)) {
    if (value.length !== 1) return { status: "invalid" }
    return parseJoinGrantQuery(value[0])
  }
  if (typeof value !== "string") return { status: "missing" }
  const grant = value.trim()
  if (!grant) return { status: "missing" }
  return { status: "ok", grant }
}
