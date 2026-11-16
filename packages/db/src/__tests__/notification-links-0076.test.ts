import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import { withPlatformAdminContext } from "../context"
import { readPreparedMigrations } from "../migrate/journal"
import { user } from "../schema/auth/index"
import { notifications } from "../schema/main/notifications"

/**
 * Runs migration 0076 against real rows on the PR's Neon branch: every old
 * link shape is rewritten for every owner, query strings survive, links
 * that are already namespaced or public stay as they are, and a second run
 * changes nothing (ADR-026 slice 4).
 */
const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

const CASES: ReadonlyArray<
  readonly [before: string | null, after: string | null]
> = [
  ["/fixture-pro/team/crm", "/expert/fixture-pro/crm"],
  ["/fixture-pro/team", "/expert/fixture-pro"],
  ["/fixture-pro/team?tab=due", "/expert/fixture-pro?tab=due"],
  ["/space-0123456789ab/sessions/b1", "/space/sessions/b1"],
  ["/space-0123456789ab", "/space"],
  ["/fixture-clinic/admin/notifications", "/team/fixture-clinic/notifications"],
  ["/fixture-lecturer/academy", "/academy/fixture-lecturer"],
  // Already namespaced, fixed routes, public addresses and no link at all.
  ["/expert/fixture-pro/crm", "/expert/fixture-pro/crm"],
  ["/team/fixture-clinic/admin", "/team/fixture-clinic/admin"],
  ["/academy/fixture-lecturer/academy", "/academy/fixture-lecturer/academy"],
  ["/account/team", "/account/team"],
  ["/fixture-pro", "/fixture-pro"],
  ["/teamwork/crm", "/teamwork/crm"],
  [null, null],
]

function migration0076(): string {
  const folder = resolve(import.meta.dirname, "../migrations/main")
  const migration = readPreparedMigrations(folder).find(
    (m) => m.tag === "0076_namespaced_notification_links"
  )
  const [statement] = migration?.statements ?? []
  if (!statement) throw new Error("0076 not found")
  return statement
}

describe.skipIf(!enabled || !databaseUrl)(
  "0076 namespaced notification links",
  () => {
    const owners = [randomUUID(), randomUUID()]
    const rows = CASES.map(([before, after], i) => ({
      id: randomUUID(),
      userId: owners[i % owners.length]!,
      before,
      after,
    }))

    beforeAll(async () => {
      await db()
        .insert(user)
        .values(
          owners.map((id) => ({
            id,
            name: "Links 0076",
            email: `links-0076-${id}@example.test`,
          }))
        )
      // Insert like production does: the worker context, no RETURNING.
      await withPlatformAdminContext(async (tx) =>
        tx.insert(notifications).values(
          rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            kind: "auth.verify_email",
            title: "Links",
            body: "links",
            href: r.before,
          }))
        )
      )
    })

    afterAll(async () => {
      await db().delete(user).where(inArray(user.id, owners))
    })

    async function hrefs(): Promise<Map<string, string | null>> {
      // The migration role (neondb_owner) bypasses RLS, as in the migration.
      const found = await db()
        .select({ id: notifications.id, href: notifications.href })
        .from(notifications)
        .where(
          inArray(
            notifications.id,
            rows.map((r) => r.id)
          )
        )
      return new Map(found.map((r) => [r.id, r.href]))
    }

    it(
      "rewrites every old shape for every owner, and only those",
      { timeout: 30_000 },
      async () => {
        await db().execute(sql.raw(migration0076()))
        const after = await hrefs()
        for (const r of rows) {
          expect(after.get(r.id), String(r.before)).toBe(r.after)
        }
      }
    )

    it("changes nothing on a second run", { timeout: 30_000 }, async () => {
      const first = await hrefs()
      await db().execute(sql.raw(migration0076()))
      expect(await hrefs()).toEqual(first)
    })
  }
)
