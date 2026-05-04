import {
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, pkColumn, updatedAt } from "./shared"

/**
 * Public taxonomy of expert categories (Nutrition, Psychology,
 * Physiotherapy, etc.). Drives the marketplace explorer
 * (/[locale]/experts/[category]) and the category filter on profile
 * search.
 *
 * Multilingual fields stored as JSONB keyed by locale. Locale set is
 * locked to {en, pt, es} for v3; the column shape stays open for
 * additional locales without a migration.
 *
 * NOT tenant-scoped (taxonomy is platform-wide). Mutations restricted
 * to `usernames:reserve` capability holders via @eleva/audit.
 */
export const expertCategories = pgTable(
  "expert_categories",
  {
    id: pkColumn(),
    slug: varchar("slug", { length: 64 }).notNull(),
    displayName: jsonb("display_name").$type<LocalizedString>().notNull(),
    description: jsonb("description").$type<LocalizedString>(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugIdx: uniqueIndex("expert_categories_slug_idx").on(t.slug),
  })
)

/** Locale-keyed display strings. Only en/pt/es required at launch. */
export interface LocalizedString {
  en: string
  pt: string
  es: string
  [locale: string]: string | undefined
}

export type ExpertCategory = typeof expertCategories.$inferSelect
export type NewExpertCategory = typeof expertCategories.$inferInsert
