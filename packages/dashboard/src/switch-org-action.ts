"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { switchToOrganization } from "@workos-inc/authkit-nextjs"
import { refreshWorkOSSession } from "@eleva/auth/server"
import { sanitizeReturnTo } from "@eleva/auth/return-to"
import {
  LAST_ACTIVE_ORG_COOKIE,
  RESERVED_SLUGS,
  isOrgSlugShape,
} from "@eleva/config/routing"
import { gatewayUrl } from "./gateway-url"

function resolveReturnPath(value: string | undefined): string {
  if (!value) return "/dashboard"
  return sanitizeReturnTo(value) ?? "/dashboard"
}

function orgSlugFromPath(path: string): string | undefined {
  const slug = path.split("/").filter(Boolean)[0]
  if (!slug || RESERVED_SLUGS.has(slug) || !isOrgSlugShape(slug)) {
    return undefined
  }
  return slug
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

  await refreshWorkOSSession()

  const targetSlug = orgSlugFromPath(path)
  if (targetSlug) {
    const cookieStore = await cookies()
    cookieStore.set(LAST_ACTIVE_ORG_COOKIE, targetSlug, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
    })
  }

  redirect(gatewayUrl(path))
}
