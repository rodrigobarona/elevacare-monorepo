"use server"

import { getSignInUrl } from "@workos-inc/authkit-nextjs"

/** Reject absolute URLs, protocol-relative URLs, and scheme-bearing paths. */
function sanitizeReturnTo(value: string | undefined): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/^\/.*:/.test(value)
  ) {
    return value
  }
  return "/"
}

/**
 * Generates a sign-in URL that targets a specific organization.
 * When the user authenticates via this URL, their session will be
 * scoped to the target organization.
 *
 * Returns `{ redirectUrl }` for the client to navigate to.
 */
export async function switchOrganization(
  organizationId: string,
  returnTo?: string
): Promise<{ redirectUrl: string }> {
  const url = await getSignInUrl({
    organizationId,
    returnTo: sanitizeReturnTo(returnTo),
  })

  return { redirectUrl: url }
}
