"use server"

import { redirect } from "next/navigation"
import { WorkOS } from "@workos-inc/node"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { db, main } from "@eleva/db"

type ActionResult = { ok: true } | { ok: false; error: string }

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
 * user, and fast-path writes all records to the Eleva DB for immediate
 * UX. The QStash poller will also process these events idempotently
 * within 5 min (no-op since we already wrote the rows).
 */
export async function createWorkspace(
  formData: FormData
): Promise<ActionResult> {
  const { user } = await withAuth({ ensureSignedIn: true })
  const workspaceName = (formData.get("workspaceName") as string)?.trim()

  if (!workspaceName || workspaceName.length < 2) {
    return { ok: false, error: "Workspace name must be at least 2 characters" }
  }

  const workos = getWorkOS()

  const org = await workos.organizations.createOrganization({
    name: workspaceName,
  })

  await workos.userManagement.createOrganizationMembership({
    userId: user.id,
    organizationId: org.id,
    roleSlug: "admin",
  })

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

  await db().transaction(async (tx) => {
    const [upsertedUser] = await tx
      .insert(main.users)
      .values({
        workosUserId: user.id,
        email: user.email!,
        displayName,
        completedOnboarding: true,
      })
      .onConflictDoUpdate({
        target: main.users.workosUserId,
        set: {
          email: user.email!,
          displayName,
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
        displayName: workspaceName,
      })
      .onConflictDoUpdate({
        target: main.organizations.workosOrgId,
        set: {
          displayName: workspaceName,
          updatedAt: new Date(),
        },
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
  })

  redirect("/auth-redirect")
}

/**
 * Checks if the current user already has a WorkOS org membership
 * (e.g. they were invited). If so, fast-path writes to DB and skips
 * the workspace creation step.
 */
export async function checkExistingMembership(): Promise<{
  hasMembership: boolean
}> {
  const { user } = await withAuth({ ensureSignedIn: true })
  const workos = getWorkOS()

  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: user.id,
    limit: 1,
  })

  if (memberships.data.length > 0) {
    const membership = memberships.data[0]!
    const orgData = await workos.organizations.getOrganization(
      membership.organizationId
    )

    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

    await db().transaction(async (tx) => {
      const [upsertedUser] = await tx
        .insert(main.users)
        .values({
          workosUserId: user.id,
          email: user.email!,
          displayName,
          completedOnboarding: true,
        })
        .onConflictDoUpdate({
          target: main.users.workosUserId,
          set: {
            email: user.email!,
            displayName,
            completedOnboarding: true,
            updatedAt: new Date(),
          },
        })
        .returning({ id: main.users.id })

      const userId = upsertedUser!.id

      const [upsertedOrg] = await tx
        .insert(main.organizations)
        .values({
          workosOrgId: orgData.id,
          type: "personal",
          displayName: orgData.name,
        })
        .onConflictDoUpdate({
          target: main.organizations.workosOrgId,
          set: {
            displayName: orgData.name,
            updatedAt: new Date(),
          },
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
    })

    return { hasMembership: true }
  }

  return { hasMembership: false }
}
