import { eq } from "drizzle-orm"
import { db } from "../client"
import { users } from "../schema/main/users"

export async function getUserAvatarUrl(userId: string): Promise<string | null> {
  const [row] = await db()
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.avatarUrl ?? null
}

export async function updateUserAvatarUrl(
  userId: string,
  avatarUrl: string | null
): Promise<void> {
  await db()
    .update(users)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(users.id, userId))
}
