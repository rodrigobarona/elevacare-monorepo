import { and, eq } from "drizzle-orm"
import { withPlatformAdminContext, type Tx } from "../context"
import { member, user } from "../schema/auth"

function assertSelfAvatarAccess(userId: string, actorUserId: string): void {
  if (actorUserId !== userId) {
    throw new Error("avatar access is self-only")
  }
}

/**
 * Identity-scoped avatar read. `auth.user` is not tenant-owned, so this
 * uses platform-admin context after proving the caller is the subject.
 */
export async function getUserAvatarUrl(
  userId: string,
  actorUserId: string
): Promise<string | null> {
  assertSelfAvatarAccess(userId, actorUserId)
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    return row?.image ?? null
  })
}

/**
 * Identity-scoped avatar write. Callers must pass the authenticated user
 * as `actorUserId`; org membership is not a substitute (avatars are
 * user-owned, not tenant-owned).
 */
export async function getAuthUserRole(userId: string): Promise<string | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    return row?.role ?? null
  })
}

/**
 * Whether the person is still a member of the org. Someone removed from a
 * clinic keeps their user row and past bookings, but no longer the clinic's
 * access, so expert-side checks pair the booking's expert with this.
 */
export async function isOrgMember(
  userId: string,
  orgId: string
): Promise<boolean> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
      .limit(1)
    return Boolean(row)
  })
}

/**
 * The rule for expert-side access to one booking: the person is the
 * booking's expert AND still a member of the booking's org. Someone removed
 * from a clinic keeps their user row and past bookings, but loses that
 * clinic's records, documents and calls. SSOT for `@eleva/records` and the
 * video workflows; member and guest access never goes through it.
 */
export async function isActiveBookingExpert(
  booking: { orgId: string; expertUserId: string | null },
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId || !booking.expertUserId || userId !== booking.expertUserId) {
    return false
  }
  return isOrgMember(userId, booking.orgId)
}

export async function updateUserAvatarUrl(
  userId: string,
  avatarUrl: string | null,
  actorUserId: string,
  txOpt?: Tx
): Promise<void> {
  assertSelfAvatarAccess(userId, actorUserId)
  const run = async (tx: Tx) => {
    await tx
      .update(user)
      .set({ image: avatarUrl, updatedAt: new Date() })
      .where(eq(user.id, userId))
  }
  if (txOpt) return run(txOpt)
  return withPlatformAdminContext(run)
}
