"use server"

import { redirect } from "next/navigation"
import { switchToOrganization } from "@workos-inc/authkit-nextjs"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import { gatewayUrl } from "./gateway-url"

function resolveReturnPath(value: string | undefined): string {
  if (!value) return "/dashboard"
  return sanitizeReturnTo(value) ?? "/dashboard"
}

/**
 * Switches the WorkOS session to `organizationId`, then redirects through
 * the gateway to the target org home (multi-zone safe in dev).
 */
export async function switchOrganization(
  organizationId: string,
  returnTo?: string
): Promise<void> {
  const path = resolveReturnPath(returnTo)

  await switchToOrganization(organizationId, {
    returnTo: path,
    revalidationStrategy: "none",
  })

  redirect(gatewayUrl(path))
}
