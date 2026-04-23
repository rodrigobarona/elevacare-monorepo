import { and, eq } from "drizzle-orm"
import { db, main } from "@eleva/db"
import { withAudit } from "@eleva/audit"

/**
 * First-sign-in hook: ensure the given WorkOS user has an Eleva
 * `users` row AND a personal org + admin membership. Idempotent
 * (matches on workosUserId / workosOrgId) so repeated invocations
 * during sign-in retries are safe.
 *
 * WorkOS createOrganization is the caller's responsibility (kept out
 * of this package so the auth SDK surface can fully mock); this
 * function only mirrors the WorkOS ids into Eleva's DB.
 *
 * All writes funnel through withAudit so the outbox drainer records
 * user.created + org.created + membership.created events.
 */

export interface EnsurePersonalOrgInput {
  workosUserId: string
  workosOrgId: string
  email: string
  displayName?: string | null
}

export async function ensurePersonalOrg(
  input: EnsurePersonalOrgInput
): Promise<{ userId: string; orgId: string }> {
  // Idempotent upsert of users first (outside withOrgContext because
  // the user table is not tenant-scoped).
  const [existingUser] = await db()
    .select({ id: main.users.id })
    .from(main.users)
    .where(eq(main.users.workosUserId, input.workosUserId))
    .limit(1)

  let userId = existingUser?.id
  if (!userId) {
    const [inserted] = await db()
      .insert(main.users)
      .values({
        workosUserId: input.workosUserId,
        email: input.email,
        displayName: input.displayName ?? null,
      })
      .returning({ id: main.users.id })
    userId = inserted!.id
  }

  // Idempotent upsert of the personal org.
  const [existingOrg] = await db()
    .select({ id: main.organizations.id })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, input.workosOrgId))
    .limit(1)

  if (existingOrg) {
    // Ensure membership exists (handles case: org already provisioned
    // by an earlier run that crashed before membership insert).
    const [existingMembership] = await db()
      .select({ id: main.memberships.id })
      .from(main.memberships)
      .where(
        and(
          eq(main.memberships.userId, userId),
          eq(main.memberships.orgId, existingOrg.id)
        )
      )
      .limit(1)
    if (!existingMembership) {
      await withAudit(
        { orgId: existingOrg.id, actorUserId: userId },
        async (tx, ctx) => {
          await tx.insert(main.memberships).values({
            userId,
            orgId: existingOrg.id,
            workosRole: "admin",
            status: "active",
          })
          await ctx.emit({
            entity: "membership",
            action: "created",
            entityId: null,
            payload: { orgId: existingOrg.id, userId, role: "admin" },
          })
        }
      )
    }
    return { userId, orgId: existingOrg.id }
  }

  const orgId = crypto.randomUUID()
  await withAudit({ orgId, actorUserId: userId }, async (tx, ctx) => {
    await tx.insert(main.organizations).values({
      id: orgId,
      workosOrgId: input.workosOrgId,
      type: "personal",
      displayName: input.displayName ?? input.email,
    })
    await tx.insert(main.memberships).values({
      userId,
      orgId,
      workosRole: "admin",
      status: "active",
    })
    await ctx.emit({
      entity: "organization",
      action: "created",
      entityId: orgId,
      payload: { type: "personal", workosOrgId: input.workosOrgId },
    })
  })

  return { userId, orgId }
}
