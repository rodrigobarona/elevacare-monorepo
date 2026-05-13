"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WorkOS } from "@workos-inc/node"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { db, main, findExistingOrgSlugs } from "@eleva/db"
import { cookieName, isLocale } from "@eleva/config/i18n"
import { generateUniqueOrgSlug } from "@eleva/config/slug"

type ActionResult = { ok: true } | { ok: false; errorKey: string }

let _workos: WorkOS | null = null
function getWorkOS(): WorkOS {
  if (!_workos) {
    const key = process.env.WORKOS_API_KEY
    if (!key) throw new Error("WORKOS_API_KEY is required")
    _workos = new WorkOS(key)
  }
  return _workos
}

/**
 * Creates a personal organization in WorkOS, a membership linking the
 * user, and fast-path writes IDs to the Eleva DB for immediate UX.
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

  const [org, slug] = await Promise.all([
    workos.organizations.createOrganization({ name: spaceName }),
    generateUniqueOrgSlug(spaceName, findExistingOrgSlugs),
  ])

  await workos.userManagement.createOrganizationMembership({
    userId: user.id,
    organizationId: org.id,
    roleSlug: "admin",
  })

  const jar = await cookies()
  const currentLocale = jar.get(cookieName)?.value
  const locale =
    currentLocale && isLocale(currentLocale) ? currentLocale : undefined

  const d = db()

  const [upsertedUser] = await d
    .insert(main.users)
    .values({
      workosUserId: user.id,
      completedOnboarding: true,
    })
    .onConflictDoUpdate({
      target: main.users.workosUserId,
      set: {
        completedOnboarding: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: main.users.id })

  const dbUserId = upsertedUser!.id

  const [upsertedOrg] = await d
    .insert(main.organizations)
    .values({
      workosOrgId: org.id,
      type: "personal",
      slug,
    })
    .onConflictDoUpdate({
      target: main.organizations.workosOrgId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: main.organizations.id })

  const dbOrgId = upsertedOrg!.id

  await d
    .insert(main.memberships)
    .values({
      userId: dbUserId,
      orgId: dbOrgId,
      workosRole: "admin",
      status: "active",
    })
    .onConflictDoUpdate({
      target: [main.memberships.userId, main.memberships.orgId],
      set: {
        workosRole: "admin",
        status: "active",
        updatedAt: new Date(),
      },
    })

  await Promise.allSettled([
    workos.userManagement.updateUser({
      userId: user.id,
      externalId: dbUserId,
      ...(locale && { locale }),
    }),
    workos.organizations.updateOrganization({
      organization: org.id,
      externalId: dbOrgId,
      metadata: { slug },
    }),
  ])

  redirect("/auth-redirect")
}

/**
 * Checks if the current user already has a WorkOS org membership
 * (e.g. they were invited). If so, fast-path writes IDs to DB and
 * skips the space creation step.
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
    const slug = await generateUniqueOrgSlug(
      workosOrg.name,
      findExistingOrgSlugs
    )

    const d = db()

    const [upsertedUser] = await d
      .insert(main.users)
      .values({
        workosUserId: user.id,
        completedOnboarding: true,
      })
      .onConflictDoUpdate({
        target: main.users.workosUserId,
        set: {
          completedOnboarding: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: main.users.id })

    const dbUserId = upsertedUser!.id

    const [upsertedOrg] = await d
      .insert(main.organizations)
      .values({
        workosOrgId: membership.organizationId,
        type: "personal",
        slug,
      })
      .onConflictDoUpdate({
        target: main.organizations.workosOrgId,
        set: { updatedAt: new Date() },
      })
      .returning({ id: main.organizations.id, slug: main.organizations.slug })

    const dbOrgId = upsertedOrg!.id

    const role = membership.role?.slug === "admin" ? "admin" : "member"

    await d
      .insert(main.memberships)
      .values({
        userId: dbUserId,
        orgId: dbOrgId,
        workosRole: role as "admin" | "member",
        status: "active",
      })
      .onConflictDoUpdate({
        target: [main.memberships.userId, main.memberships.orgId],
        set: {
          workosRole: role as "admin" | "member",
          status: "active",
          updatedAt: new Date(),
        },
      })

    await Promise.allSettled([
      workos.userManagement.updateUser({
        userId: user.id,
        externalId: dbUserId,
        ...(locale && { locale }),
      }),
      workos.organizations.updateOrganization({
        organization: membership.organizationId,
        externalId: dbOrgId,
        metadata: { slug: upsertedOrg!.slug ?? slug },
      }),
    ])

    return { hasMembership: true }
  }

  return { hasMembership: false }
}
