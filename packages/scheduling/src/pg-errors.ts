/** Drizzle wraps driver errors, so the Postgres code can sit on a `cause`. */
function hasPgCode(err: unknown, pgCode: string): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === pgCode
    ) {
      return true
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined
  }
  return false
}

/** Postgres `exclusion_violation` (for example `slot_reservations_no_overlap`). */
export function isExclusionViolation(err: unknown): boolean {
  return hasPgCode(err, "23P01")
}

export function isUniqueViolation(err: unknown): boolean {
  return hasPgCode(err, "23505")
}
