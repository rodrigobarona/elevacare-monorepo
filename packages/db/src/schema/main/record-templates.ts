import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organization, user } from "../auth"

export const RECORD_TEMPLATE_KINDS = [
  "note",
  "report",
  "consultation",
  "message",
] as const

export type RecordTemplateKind = (typeof RECORD_TEMPLATE_KINDS)[number]

export const recordTemplateKindEnum = pgEnum(
  "record_template_kind",
  RECORD_TEMPLATE_KINDS
)

/**
 * Reusable note/report skeletons per expert org. Not PHI: bodies carry
 * `{{member.firstName}}`-style placeholders and pass the template PHI
 * scrubber before any write, so they are stored in clear.
 */
export const recordTemplates = pgTable(
  "record_templates",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    kind: recordTemplateKindEnum("kind").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isDefault: boolean("is_default").notNull().default(false),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgKindIdx: index("record_templates_org_kind_idx").on(t.orgId, t.kind),
    defaultIdx: uniqueIndex("record_templates_default_uidx")
      .on(t.orgId, t.kind, t.locale)
      .where(sql`is_default = true AND archived_at IS NULL`),
    tenantPolicy: pgPolicy("record_templates_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type RecordTemplateRow = typeof recordTemplates.$inferSelect
