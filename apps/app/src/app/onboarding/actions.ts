"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WorkOS } from "@workos-inc/node"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { db, main } from "@eleva/db"
import { cookieName, isLocale } from "@eleva/config/i18n"

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
 * Also syncs the user's locale preference to WorkOS for cross-device
 * persistence and localized emails.
 *
 * No PII is stored — only opaque WorkOS IDs and Eleva metadata.
 * The QStash poller will also process these events idempotently
 * within 5 min (no-op since we already wrote the rows).
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

  const org = await workos.organizations.createOrganization({
    name: spaceName,
  })

  await workos.userManagement.createOrganizationMembership({
    userId: user.id,
    organizationId: org.id,
    roleSlug: "admin",
  })

  const jar = await cookies()
  const currentLocale = jar.get(cookieName)?.value
  const locale =
    currentLocale && isLocale(currentLocale) ? currentLocale : undefined

  const { dbUserId, dbOrgId } = await db().transaction(async (tx) => {
    const [upsertedUser] = await tx
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

    const userId = upsertedUser!.id

    const [upsertedOrg] = await tx
      .insert(main.organizations)
      .values({
        workosOrgId: org.id,
        type: "personal",
      })
      .onConflictDoUpdate({
        target: main.organizations.workosOrgId,
        set: { updatedAt: new Date() },
      })
      .returning({ id: main.organizations.id })

    const orgId = upsertedOrg!.id

    await tx
      .insert(main.memberships)
      .values({
        userId,
        orgId,
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

    return { dbUserId: userId, dbOrgId: orgId }
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

    const { dbUserId, dbOrgId } = await db().transaction(async (tx) => {
      const [upsertedUser] = await tx
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

      const userId = upsertedUser!.id

      const [upsertedOrg] = await tx
        .insert(main.organizations)
        .values({
          workosOrgId: membership.organizationId,
          type: "personal",
        })
        .onConflictDoUpdate({
          target: main.organizations.workosOrgId,
          set: { updatedAt: new Date() },
        })
        .returning({ id: main.organizations.id })

      const orgId = upsertedOrg!.id

      const role = membership.role?.slug === "admin" ? "admin" : "member"

      await tx
        .insert(main.memberships)
        .values({
          userId,
          orgId,
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

      return { dbUserId: userId, dbOrgId: orgId }
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
      }),
    ])

    return { hasMembership: true }
  }

  return { hasMembership: false }
}
