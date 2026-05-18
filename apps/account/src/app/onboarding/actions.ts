"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getWorkOS } from "@eleva/auth/server"
import { completeOnboarding } from "@eleva/auth"
import { cookieName, isLocale } from "@eleva/config/i18n"

type ActionResult = { ok: true } | { ok: false; errorKey: string }

/**
 * Creates a personal organization in WorkOS, a membership linking the
 * user, and provisions rows in the Eleva DB via @eleva/auth.
 */
export async function createSpace(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { user } = await withAuth({ ensureSignedIn: true })
  const spaceName = (formData.get("spaceName") as string)?.trim()

  if (!spaceName || spaceName.length < 2) {
    return { ok: false, errorKey: "errorMinLength" }
  }

  const workos = getWorkOS()

  const org = await workos.organizations.createOrganization({ name: spaceName })

  await workos.userManagement.createOrganizationMembership({
    userId: user.id,
    organizationId: org.id,
    roleSlug: "admin",
  })

  const jar = await cookies()
  const currentLocale = jar.get(cookieName)?.value
  const locale =
    currentLocale && isLocale(currentLocale) ? currentLocale : undefined

  const result = await completeOnboarding({
    workosUserId: user.id,
    workosOrgId: org.id,
    orgName: spaceName,
    role: "admin",
    orgType: "personal",
  })

  await Promise.allSettled([
    workos.userManagement.updateUser({
      userId: user.id,
      externalId: result.userId,
      ...(locale && { locale }),
    }),
    workos.organizations.updateOrganization({
      organization: org.id,
      externalId: result.orgId,
      metadata: { slug: result.slug },
    }),
  ])

  redirect("/dashboard")
}

/**
 * Checks if the current user already has a WorkOS org membership
 * (e.g. they were invited). If so, provisions rows in the Eleva DB
 * and skips the space creation step.
 */
export async function checkExistingMembership(): Promise<{
  hasMembership: boolean
}> {
  const { user } = await withAuth({ ensureSignedIn: true })
  const workos = getWorkOS()

  const jar = await cookies()
  const currentLocale = jar.get(cookieName)?.value
  const locale =
    currentLocale && isLocale(currentLocale) ? currentLocale : undefined

  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: user.id,
    limit: 1,
  })

  if (memberships.data.length > 0) {
    const membership = memberships.data[0]!

    const workosOrg = await workos.organizations.getOrganization(
      membership.organizationId
    )
    const role = membership.role?.slug === "admin" ? "admin" : "member"

    const result = await completeOnboarding({
      workosUserId: user.id,
      workosOrgId: membership.organizationId,
      orgName: workosOrg.name,
      role: role as "admin" | "member",
      orgType: "personal",
    })

    await Promise.allSettled([
      workos.userManagement.updateUser({
        userId: user.id,
        externalId: result.userId,
        ...(locale && { locale }),
      }),
      workos.organizations.updateOrganization({
        organization: membership.organizationId,
        externalId: result.orgId,
        metadata: { slug: result.slug },
      }),
    ])

    return { hasMembership: true }
  }

  return { hasMembership: false }
}
