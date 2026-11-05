import { APIError } from "better-auth/api"

/**
 * `staff` org membership grants platform capabilities (deriveProductLabel),
 * so no request path — HTTP or server-side `auth.api` — may create one or
 * change an existing org's type. Staff orgs are provisioned by an operator
 * directly in the database.
 */
export function assertCreatableOrgType(organization: Record<string, unknown>) {
  if (organization.type === "staff") {
    throw new APIError("FORBIDDEN", {
      message: "Staff organizations cannot be created through the API.",
    })
  }
}

export function assertOrgTypeUnchanged(update: Record<string, unknown>) {
  if (Object.hasOwn(update, "type")) {
    throw new APIError("FORBIDDEN", {
      message: "An organization's type cannot be changed.",
    })
  }
}
