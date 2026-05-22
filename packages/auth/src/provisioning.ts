import { and, eq, isNull } from "drizzle-orm"
import { db, main, findExistingOrgSlugs } from "@eleva/db"
import { withAudit } from "@eleva/audit"
import { generateUniqueOrgSlug } from "@eleva/config/slug"

/**
 * Provisioning functions for users, organizations, and memberships.
 *
 * These are the canonical write path for identity provisioning in the
 * Eleva DB. Called by:
 *   - Onboarding fast-path (apps/account, apps/api)
 *   - WorkOS event sync (packages/auth/sync.ts)
 *   - API endpoints (apps/api)
 *
 * WorkOS createOrganization is the caller's responsibility (kept out
 * of this package so the auth SDK surface can fully mock); these
 * functions only mirror the WorkOS ids into Eleva's DB.
 *
 * All writes funnel through withAudit so the outbox drainer records
 * user.created + org.created + membership.created events.
 */

/**
 * Look up whether a WorkOS user already has a personal org in Eleva's DB.
 * Returns the existing org ids or null if the user has never been provisioned.
 */
export async function findExistingPersonalOrg(
  workosUserId: string
): Promise<{ workosOrgId: string; orgId: string } | null> {
  const [row] = await db()
    .select({
      workosOrgId: main.organizations.workosOrgId,
      orgId: main.organizations.id,
    })
    .from(main.users)
    .innerJoin(main.memberships, eq(main.memberships.userId, main.users.id))
    .innerJoin(
      main.organizations,
      eq(main.organizations.id, main.memberships.orgId)
    )
    .where(
      and(
        eq(main.users.workosUserId, workosUserId),
        eq(main.organizations.type, "personal"),
        isNull(main.organizations.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}

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
          const [row] = await tx
            .insert(main.memberships)
            .values({
              userId,
              orgId: existingOrg.id,
              workosRole: "admin",
              status: "active",
            })
            .returning({ id: main.memberships.id })
          await ctx.emit({
            entity: "membership",
            action: "created",
            entityId: row!.id,
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

// ---------------------------------------------------------------------------
// Granular provisioning functions for API-first / agentic use
// ---------------------------------------------------------------------------

export interface ProvisionUserInput {
  workosUserId: string
  completedOnboarding?: boolean
}

export interface ProvisionUserResult {
  userId: string
  created: boolean
}

/**
 * Upsert a user row keyed by WorkOS user ID.
 * Sets `completedOnboarding` when provided.
 */
export async function provisionUser(
  input: ProvisionUserInput
): Promise<ProvisionUserResult> {
  const [existing] = await db()
    .select({ id: main.users.id })
    .from(main.users)
    .where(eq(main.users.workosUserId, input.workosUserId))
    .limit(1)

  if (existing) {
    if (input.completedOnboarding) {
      await db()
        .update(main.users)
        .set({ completedOnboarding: true, updatedAt: new Date() })
        .where(eq(main.users.workosUserId, input.workosUserId))
    }
    return { userId: existing.id, created: false }
  }

  const [inserted] = await db()
    .insert(main.users)
    .values({
      workosUserId: input.workosUserId,
      ...(input.completedOnboarding && { completedOnboarding: true }),
    })
    .returning({ id: main.users.id })

  return { userId: inserted!.id, created: true }
}

export interface ProvisionOrganizationInput {
  workosOrgId: string
  name: string
  type?: "personal" | "expert" | "team" | "academy" | "staff"
  slug?: string
  actorUserId?: string | null
}

export interface ProvisionOrganizationResult {
  orgId: string
  slug: string
  created: boolean
}

/**
 * Upsert an organization row keyed by WorkOS org ID.
 * Generates a unique slug if one is not provided.
 */
export async function provisionOrganization(
  input: ProvisionOrganizationInput
): Promise<ProvisionOrganizationResult> {
  const slug =
    input.slug ??
    (await generateUniqueOrgSlug(input.name, findExistingOrgSlugs))
  const type = input.type ?? "personal"

  const [existing] = await db()
    .select({
      id: main.organizations.id,
      slug: main.organizations.slug,
      type: main.organizations.type,
    })
    .from(main.organizations)
    .where(eq(main.organizations.workosOrgId, input.workosOrgId))
    .limit(1)

  if (existing) {
    const existingSlug = existing.slug ?? slug
    const shouldUpdateType = existing.type !== type
    if (!existing.slug || shouldUpdateType) {
      await withAudit(
        { orgId: existing.id, actorUserId: input.actorUserId ?? null },
        async (tx, ctx) => {
          await tx
            .update(main.organizations)
            .set({
              slug: existingSlug,
              type,
              updatedAt: new Date(),
            })
            .where(eq(main.organizations.workosOrgId, input.workosOrgId))

          await ctx.emit({
            entity: "organization",
            action: "updated",
            entityId: existing.id,
            payload: {
              workosOrgId: input.workosOrgId,
              before: { type: existing.type, slug: existing.slug },
              after: { type, slug: existingSlug },
            },
          })
        }
      )
    }
    return { orgId: existing.id, slug: existingSlug, created: false }
  }

  const orgId = crypto.randomUUID()
  await withAudit(
    { orgId, actorUserId: input.actorUserId ?? null },
    async (tx, ctx) => {
      await tx
        .insert(main.organizations)
        .values({ id: orgId, workosOrgId: input.workosOrgId, type, slug })
      await ctx.emit({
        entity: "organization",
        action: "created",
        entityId: orgId,
        payload: { type, workosOrgId: input.workosOrgId, slug },
      })
    }
  )

  return { orgId, slug, created: true }
}

export interface ProvisionMembershipInput {
  userId: string
  orgId: string
  role: "admin" | "member"
  actorUserId?: string | null
}

/**
 * Upsert a membership row. Idempotent on (userId, orgId).
 */
export async function provisionMembership(
  input: ProvisionMembershipInput
): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId ?? null },
    async (tx, ctx) => {
      const [existing] = await tx
        .select({ id: main.memberships.id })
        .from(main.memberships)
        .where(
          and(
            eq(main.memberships.userId, input.userId),
            eq(main.memberships.orgId, input.orgId)
          )
        )
        .limit(1)

      const [row] = await tx
        .insert(main.memberships)
        .values({
          userId: input.userId,
          orgId: input.orgId,
          workosRole: input.role,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [main.memberships.userId, main.memberships.orgId],
          set: {
            workosRole: input.role,
            status: "active",
            updatedAt: new Date(),
          },
        })
        .returning({ id: main.memberships.id })

      await ctx.emit({
        entity: "membership",
        action: existing ? "updated" : "created",
        entityId: row!.id,
        payload: { userId: input.userId, orgId: input.orgId, role: input.role },
      })
    }
  )
}

export interface CompleteOnboardingInput {
  workosUserId: string
  workosOrgId: string
  orgName: string
  role: "admin" | "member"
  orgType?: "personal" | "expert" | "team" | "staff"
  actorUserId?: string | null
}

export interface CompleteOnboardingResult {
  userId: string
  orgId: string
  slug: string
}

/**
 * High-level onboarding orchestrator: provisions user + org + membership
 * in the Eleva DB. Does NOT call WorkOS (create org, create membership,
 * set externalId) -- that is the caller's responsibility.
 *
 * This is the function both Server Actions and API routes should call
 * for onboarding, eliminating the duplicated inline upsert logic.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<CompleteOnboardingResult> {
  const { userId } = await provisionUser({
    workosUserId: input.workosUserId,
    completedOnboarding: true,
  })

  const actorUserId = input.actorUserId ?? userId

  const { orgId, slug } = await provisionOrganization({
    workosOrgId: input.workosOrgId,
    name: input.orgName,
    type: input.orgType ?? "personal",
    actorUserId,
  })

  await provisionMembership({
    userId,
    orgId,
    role: input.role,
    actorUserId,
  })

  return { userId, orgId, slug }
}
