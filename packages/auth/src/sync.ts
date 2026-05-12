import { eq, lt, and, isNull } from "drizzle-orm"
import { db, main } from "@eleva/db"

/**
 * WorkOS Events API data sync functions.
 *
 * These are the SINGLE WRITE PATH for WorkOS data entering the Eleva DB.
 * Called by the QStash-triggered poller and by the onboarding fast-path.
 *
 * Design invariants:
 * - Idempotent: safe to call multiple times with the same event data
 * - Stale-safe: compares updated_at to skip older events (WorkOS best practice)
 * - No side effects: pure DB operations, no emails or 3rd-party calls
 */

export const SYNC_EVENTS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "organization_membership.created",
  "organization_membership.updated",
  "organization_membership.deleted",
] as const

export type SyncEventType = (typeof SYNC_EVENTS)[number]

/**
 * Dispatches a single WorkOS event to the appropriate sync function.
 * Used by the QStash-triggered polling route.
 */
export async function processWorkOSEvent(event: {
  event: string
  data: unknown
}): Promise<void> {
  switch (event.event) {
    case "user.created":
    case "user.updated":
      await syncUser(event.data as WorkOSUserEventData)
      break
    case "user.deleted":
      await softDeleteUser((event.data as WorkOSUserEventData).id)
      break
    case "organization.created":
    case "organization.updated":
      await syncOrganization(event.data as WorkOSOrganizationEventData)
      break
    case "organization.deleted":
      await softDeleteOrganization(
        (event.data as WorkOSOrganizationEventData).id
      )
      break
    case "organization_membership.created":
    case "organization_membership.updated":
      await syncMembership(event.data as WorkOSMembershipEventData)
      break
    case "organization_membership.deleted":
      await deleteMembership(event.data as WorkOSMembershipEventData)
      break
  }
}

export interface WorkOSUserEventData {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  email_verified: boolean
  profile_picture_url: string | null
  created_at: string
  updated_at: string
}

export interface WorkOSOrganizationEventData {
  id: string
  name: string
  external_id: string | null
  created_at: string
  updated_at: string
}

export interface WorkOSMembershipEventData {
  id: string
  user_id: string
  organization_id: string
  status: "active" | "pending"
  role: { slug: string }
  roles: Array<{ slug: string }>
  created_at: string
  updated_at: string
}

function buildDisplayName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  return email
}

export async function syncUser(data: WorkOSUserEventData): Promise<void> {
  const eventUpdatedAt = new Date(data.updated_at)
  const displayName = buildDisplayName(
    data.first_name,
    data.last_name,
    data.email
  )

  await db()
    .insert(main.users)
    .values({
      workosUserId: data.id,
      email: data.email,
      displayName,
      updatedAt: eventUpdatedAt,
    })
    .onConflictDoUpdate({
      target: main.users.workosUserId,
      set: {
        email: data.email,
        displayName,
        updatedAt: eventUpdatedAt,
      },
      where: lt(main.users.updatedAt, eventUpdatedAt),
    })
}

export async function softDeleteUser(workosUserId: string): Promise<void> {
  await db()
    .update(main.users)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(main.users.workosUserId, workosUserId),
        isNull(main.users.deletedAt)
      )
    )
}

export async function syncOrganization(
  data: WorkOSOrganizationEventData
): Promise<void> {
  const eventUpdatedAt = new Date(data.updated_at)

  await db()
    .insert(main.organizations)
    .values({
      workosOrgId: data.id,
      type: "personal",
      displayName: data.name,
      updatedAt: eventUpdatedAt,
    })
    .onConflictDoUpdate({
      target: main.organizations.workosOrgId,
      set: {
        displayName: data.name,
        updatedAt: eventUpdatedAt,
      },
      where: lt(main.organizations.updatedAt, eventUpdatedAt),
    })
}

export async function softDeleteOrganization(
  workosOrgId: string
): Promise<void> {
  await db()
    .update(main.organizations)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(main.organizations.workosOrgId, workosOrgId),
        isNull(main.organizations.deletedAt)
      )
    )
}

export async function syncMembership(
  data: WorkOSMembershipEventData
): Promise<void> {
  const [user] = await db()
    .select({ id: main.users.id })
    .from(main.users)
    .where(eq(main.users.workosUserId, data.user_id))
    .limit(1)

  const [org] = await db()
    .select({ id: main.organizations.id })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, data.organization_id))
    .limit(1)

  if (!user || !org) return

  const workosRole = data.role?.slug === "admin" ? "admin" : "member"
  const status = data.status === "active" ? "active" : "active"
  const eventUpdatedAt = new Date(data.updated_at)

  await db()
    .insert(main.memberships)
    .values({
      userId: user.id,
      orgId: org.id,
      workosRole: workosRole as "admin" | "member",
      status,
      updatedAt: eventUpdatedAt,
    })
    .onConflictDoUpdate({
      target: [main.memberships.userId, main.memberships.orgId],
      set: {
        workosRole: workosRole as "admin" | "member",
        status,
        updatedAt: eventUpdatedAt,
      },
      where: lt(main.memberships.updatedAt, eventUpdatedAt),
    })
}

export async function deleteMembership(
  data: Pick<WorkOSMembershipEventData, "user_id" | "organization_id">
): Promise<void> {
  const [user] = await db()
    .select({ id: main.users.id })
    .from(main.users)
    .where(eq(main.users.workosUserId, data.user_id))
    .limit(1)

  const [org] = await db()
    .select({ id: main.organizations.id })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, data.organization_id))
    .limit(1)

  if (!user || !org) return

  await db()
    .delete(main.memberships)
    .where(
      and(
        eq(main.memberships.userId, user.id),
        eq(main.memberships.orgId, org.id)
      )
    )
}
