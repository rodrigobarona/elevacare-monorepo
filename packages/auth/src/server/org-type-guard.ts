/**
 * `staff` org membership grants platform capabilities (deriveProductLabel),
 * so no request path — HTTP or server-side `auth.api` — may create one or
 * change an existing org's type. Staff orgs are provisioned by an operator
 * directly in the database.
 */
export function orgCreateViolation(
  organization: Record<string, unknown>
): string | null {
  return organization.type === "staff"
    ? "Staff organizations cannot be created through the API."
    : null
}

/**
 * An org's slug is its public username and address (`/{slug}`,
 * `/expert/{slug}`, ADR-026). Changing it would break every link and free
 * the old name for someone else, so it is fixed once created; a closed
 * practice keeps holding it (ADR-026 decision 10).
 */
export function orgUpdateViolation(
  update: Record<string, unknown>
): string | null {
  if (Object.hasOwn(update, "type")) {
    return "An organization's type cannot be changed."
  }
  if (Object.hasOwn(update, "slug")) {
    return "An organization's address cannot be changed."
  }
  return null
}
