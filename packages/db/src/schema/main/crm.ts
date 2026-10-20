import { sql } from "drizzle-orm"
import {
  index,
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

export const CRM_LIFECYCLE_STAGES = [
  "lead",
  "active",
  "dormant",
  "churned",
] as const

export type CrmLifecycleStage = (typeof CRM_LIFECYCLE_STAGES)[number]

export const crmLifecycleStageEnum = pgEnum(
  "crm_lifecycle_stage",
  CRM_LIFECYCLE_STAGES
)

export const CRM_FOLLOW_UP_KINDS = ["call", "message", "review"] as const

export type CrmFollowUpKind = (typeof CRM_FOLLOW_UP_KINDS)[number]

export const crmFollowUpKindEnum = pgEnum(
  "crm_follow_up_kind",
  CRM_FOLLOW_UP_KINDS
)

/**
 * An expert org's relationship row for one person: a member who booked
 * (`member_user_id`) or a manual lead. Session history is read from
 * bookings, not copied here. Email and phone are ciphertext
 * (`@eleva/encryption`); account deletion removes member rows.
 */
export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    memberUserId: uuid("member_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 200 }),
    emailEncrypted: text("email_encrypted"),
    phoneEncrypted: text("phone_encrypted"),
    lifecycleStage: crmLifecycleStageEnum("lifecycle_stage")
      .notNull()
      .default("lead"),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdBy: uuid("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgStageIdx: index("crm_contacts_org_stage_idx").on(
      t.orgId,
      t.lifecycleStage
    ),
    memberUidx: uniqueIndex("crm_contacts_org_member_uidx")
      .on(t.orgId, t.memberUserId)
      .where(sql`member_user_id IS NOT NULL`),
    tenantPolicy: pgPolicy("crm_contacts_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type CrmContactRow = typeof crmContacts.$inferSelect

/** A dated to-do on a contact. `note_encrypted` may hold PHI. */
export const crmFollowUps = pgTable(
  "crm_follow_ups",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => crmContacts.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    kind: crmFollowUpKindEnum("kind").notNull(),
    noteEncrypted: text("note_encrypted"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    /** Set by the due-reminder job so each follow-up notifies once. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgOpenDueIdx: index("crm_follow_ups_org_open_due_idx")
      .on(t.orgId, t.dueAt)
      .where(sql`done_at IS NULL`),
    contactIdx: index("crm_follow_ups_contact_idx").on(t.contactId),
    tenantPolicy: pgPolicy("crm_follow_ups_tenant_isolation", {
      using: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true'`,
    }),
  })
)

export type CrmFollowUpRow = typeof crmFollowUps.$inferSelect
