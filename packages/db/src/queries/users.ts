import { eq } from "drizzle-orm"
import { withPlatformAdminContext, type Tx } from "../context"
import { user } from "../schema/auth"

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
