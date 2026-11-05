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

export function orgUpdateViolation(
  update: Record<string, unknown>
): string | null {
  return Object.hasOwn(update, "type")
    ? "An organization's type cannot be changed."
    : null
}
