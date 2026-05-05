import { sql } from "drizzle-orm"
import { timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * Column helpers reused across every tenant-scoped table.
 *
 * Every tenant-scoped table MUST include org_id + the RLS policy defined
 * in src/rls/apply-rls.ts. See ADR-003.
 */

export const pkColumn = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`)

export const orgIdColumn = () => uuid("org_id").notNull()

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`)

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`)

export const deletedAt = () =>
  timestamp("deleted_at", { withTimezone: true, mode: "date" })

/**
 * JSONB shape for fields localized per Eleva's launch locale set.
 * `en` is required (default locale); PT and ES are optional.
 */
export type LocalizedText = {
  en: string
  pt?: string
  es?: string
}
