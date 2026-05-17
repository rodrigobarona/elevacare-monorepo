"use server"

import { getSignInUrl } from "@workos-inc/authkit-nextjs"

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
    returnTo: returnTo ?? "/",
  })

  return { redirectUrl: url }
}
