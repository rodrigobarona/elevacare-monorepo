/** Postgres `exclusion_violation` (e.g. `slot_reservations_no_overlap`). */
export function isExclusionViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "23P01"
  )
}
