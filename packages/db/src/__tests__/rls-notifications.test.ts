import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import { withPlatformAdminContext, withUserContext } from "../context"
import { user } from "../schema/auth/index"
import { notifications } from "../schema/main/notifications"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

describe.skipIf(!enabled || !databaseUrl)("rls notifications inbox", () => {
  const userA = randomUUID()
  const userB = randomUUID()

  beforeAll(async () => {
    const pool = new Pool({ connectionString: databaseUrl })
    const client = await pool.connect()
    try {
      await provisionRlsTestRole(client)
    } finally {
      client.release()
      await pool.end()
    }
    await db()
      .insert(user)
      .values([
        { id: userA, name: "RLS A", email: `rls-a-${userA}@example.test` },
        { id: userB, name: "RLS B", email: `rls-b-${userB}@example.test` },
      ])
  })

  afterAll(async () => {
    await db()
      .delete(user)
      .where(inArray(user.id, [userA, userB]))
  })

  it(
    "service inserts; members read and mark read only their own rows",
    { timeout: 30_000 },
    async () => {
      const rowA = randomUUID()
      // RETURNING would need the owner-only SELECT policy, as in production.
      await withPlatformAdminContext(async (tx) =>
        tx.insert(notifications).values([
          { id: rowA, userId: userA, kind: "test", title: "A", body: "a" },
          { userId: userB, kind: "test", title: "B", body: "b" },
        ])
      )

      const visibleToA = await withUserContext(userA, async (tx) =>
        tx
          .select({ userId: notifications.userId })
          .from(notifications)
          .where(inArray(notifications.userId, [userA, userB]))
      )
      expect(visibleToA.map((row) => row.userId)).toEqual([userA])

      const updatedByB = await withUserContext(userB, async (tx) =>
        tx
          .update(notifications)
          .set({ readAt: new Date() })
          .where(eq(notifications.id, rowA))
          .returning({ id: notifications.id })
      )
      expect(updatedByB).toHaveLength(0)

      const updatedByA = await withUserContext(userA, async (tx) =>
        tx
          .update(notifications)
          .set({ readAt: new Date() })
          .where(eq(notifications.id, rowA))
          .returning({ id: notifications.id })
      )
      expect(updatedByA).toEqual([{ id: rowA }])

      await expect(
        withUserContext(userA, async (tx) =>
          tx
            .insert(notifications)
            .values({ userId: userA, kind: "test", title: "x", body: "x" })
        )
      ).rejects.toThrow()
    }
  )
})
