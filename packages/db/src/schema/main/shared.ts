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

/**
 * Rich-text JSONB contract (ADR-023 / Phase 4B). Plate JSON lives under `json`;
 * `html` and `text` are server-derived. Full Zod schemas live in `@eleva/editor`
 * so `platejs` stays inside that package boundary.
 *
 * Structural typing only here — do not import `platejs` into `@eleva/db`.
 */
export type LocalizedRichTextEntry = {
  json: unknown
  html: string
  text: string
  source: "human" | "ai_draft"
}

export type LocalizedRichText = Partial<{
  en: LocalizedRichTextEntry
  pt: LocalizedRichTextEntry
  es: LocalizedRichTextEntry
}>
