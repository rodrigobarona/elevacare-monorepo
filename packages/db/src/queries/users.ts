import { eq } from "drizzle-orm"
import { withPlatformAdminContext, type Tx } from "../context"
import { user } from "../schema/auth"

export async function getUserAvatarUrl(userId: string): Promise<string | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    return row?.image ?? null
  })
}

export async function updateUserAvatarUrl(
  userId: string,
  avatarUrl: string | null,
  txOpt?: Tx
): Promise<void> {
  const run = async (tx: Tx) => {
    await tx
      .update(user)
      .set({ image: avatarUrl, updatedAt: new Date() })
      .where(eq(user.id, userId))
  }
  if (txOpt) return run(txOpt)
  return withPlatformAdminContext(run)
}
