import { eq, lt, and, isNull } from "drizzle-orm"
import { db, main } from "@eleva/db"
import { withAudit } from "@eleva/audit"

/**
 * WorkOS Events API data sync functions.
 *
 * These are the SINGLE WRITE PATH for WorkOS data entering the Eleva DB.
 * Called by the QStash-triggered poller and by the onboarding fast-path.
 *
 * IDs-only architecture: NO PII (email, names) is written to the DB.
 * WorkOS is the SSOT for identity data. The DB only stores opaque IDs
 * and Eleva-specific metadata (org type, role, status, onboarding flag).
 *
 * Design invariants:
 * - Idempotent: safe to call multiple times with the same event data
 * - Stale-safe: compares updated_at to skip older events (WorkOS best practice)
 * - No side effects: pure DB operations, no emails or 3rd-party calls
 *
 * Full event catalog: https://workos.com/docs/events
 * To add new events, update SYNC_EVENTS + processWorkOSEvent below,
 * add a matching sync function, and create a DB migration if needed.
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

export type ExternalIdWriteBack =
  | { type: "user"; workosId: string; dbId: string }
  | { type: "organization"; workosId: string; dbId: string }

/**
 * Dispatches a single WorkOS event to the appropriate sync function.
 * Returns write-back hints so the caller can set WorkOS external_id
 * without this module importing the WorkOS SDK.
 */
export async function processWorkOSEvent(event: {
  event: string
  data: unknown
}): Promise<ExternalIdWriteBack | null> {
  switch (event.event) {
    case "user.created":
    case "user.updated": {
      const workosId = (event.data as WorkOSUserEventData).id
      const dbId = await syncUser(workosId)
      return dbId ? { type: "user", workosId, dbId } : null
    }
    case "user.deleted":
      await softDeleteUser((event.data as WorkOSUserEventData).id)
      return null
    case "organization.created":
    case "organization.updated": {
      const data = event.data as WorkOSOrganizationEventData
      const dbId = await syncOrganization(data)
      return dbId ? { type: "organization", workosId: data.id, dbId } : null
    }
    case "organization.deleted":
      await softDeleteOrganization(
        (event.data as WorkOSOrganizationEventData).id
      )
      return null
    case "organization_membership.created":
    case "organization_membership.updated":
      await syncMembership(event.data as WorkOSMembershipEventData)
      return null
    case "organization_membership.deleted":
      await deleteMembership(event.data as WorkOSMembershipEventData)
      return null
    default:
      return null
  }
}

export interface WorkOSUserEventData {
  id: string
  createdAt?: string
  updatedAt?: string
}

export interface WorkOSOrganizationEventData {
  id: string
  createdAt?: string
  updatedAt?: string
}

export interface WorkOSMembershipEventData {
  id: string
  userId: string
  organizationId: string
  status: "active" | "pending"
  role: { slug: string }
  roles: Array<{ slug: string }>
  createdAt?: string
  updatedAt?: string
}

function safeDate(
  primary: string | undefined | null,
  fallback?: string | undefined | null
): Date {
  if (primary) {
    const d = new Date(primary)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (fallback) {
    const d = new Date(fallback)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

export async function syncUser(workosUserId: string): Promise<string> {
  const [row] = await db()
    .insert(main.users)
    .values({ workosUserId })
    .onConflictDoUpdate({
      target: main.users.workosUserId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: main.users.id })

  return row!.id
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
): Promise<string> {
  const [row] = await db()
    .insert(main.organizations)
    .values({
      workosOrgId: data.id,
      type: "personal",
    })
    .onConflictDoUpdate({
      target: main.organizations.workosOrgId,
      set: { updatedAt: new Date() },
    })
    .returning({ id: main.organizations.id })

  return row!.id
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
    .where(eq(main.users.workosUserId, data.userId))
    .limit(1)

  const [org] = await db()
    .select({ id: main.organizations.id })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, data.organizationId))
    .limit(1)

  if (!user || !org) return

  const workosRole = data.role?.slug === "admin" ? "admin" : "member"
  const eventUpdatedAt = safeDate(data.updatedAt, data.createdAt)

  await withAudit({ orgId: org.id, actorUserId: null }, async (tx, ctx) => {
    const [existing] = await tx
      .select({ id: main.memberships.id })
      .from(main.memberships)
      .where(
        and(
          eq(main.memberships.userId, user.id),
          eq(main.memberships.orgId, org.id)
        )
      )
      .limit(1)

    const [row] = await tx
      .insert(main.memberships)
      .values({
        userId: user.id,
        orgId: org.id,
        workosRole: workosRole as "admin" | "member",
        status: "active",
        updatedAt: eventUpdatedAt,
      })
      .onConflictDoUpdate({
        target: [main.memberships.userId, main.memberships.orgId],
        set: {
          workosRole: workosRole as "admin" | "member",
          status: "active",
          updatedAt: eventUpdatedAt,
        },
        where: lt(main.memberships.updatedAt, eventUpdatedAt),
      })
      .returning({ id: main.memberships.id })

    await ctx.emit({
      entity: "membership",
      action: existing ? "synced" : "created",
      entityId: row?.id ?? existing?.id ?? null,
      payload: {
        userId: user.id,
        orgId: org.id,
        role: workosRole,
        source: "workos_sync",
      },
    })
  })
}

export async function deleteMembership(
  data: Pick<WorkOSMembershipEventData, "userId" | "organizationId">
): Promise<void> {
  const [user] = await db()
    .select({ id: main.users.id })
    .from(main.users)
    .where(eq(main.users.workosUserId, data.userId))
    .limit(1)

  const [org] = await db()
    .select({ id: main.organizations.id })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, data.organizationId))
    .limit(1)

  if (!user || !org) return

  await withAudit({ orgId: org.id, actorUserId: null }, async (tx, ctx) => {
    const [deleted] = await tx
      .delete(main.memberships)
      .where(
        and(
          eq(main.memberships.userId, user.id),
          eq(main.memberships.orgId, org.id)
        )
      )
      .returning({ id: main.memberships.id })
    await ctx.emit({
      entity: "membership",
      action: "removed",
      entityId: deleted?.id ?? null,
      payload: {
        userId: user.id,
        orgId: org.id,
        source: "workos_sync",
      },
    })
  })
}
