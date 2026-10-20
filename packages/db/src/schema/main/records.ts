import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  primaryKey,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, orgIdColumn, pkColumn, updatedAt } from "./shared"
import { organization, user } from "../auth"
import { bookings } from "./bookings"

/**
 * Session / clinical record kinds. Live `transcript` and unpublished
 * `internal_report` are Phase 10.1 (Daily Deepgram, recording off).
 * Published `report` stays 10.2. Cloud recording stays 16.8.
 */
export const RECORD_KINDS = [
  "intake",
  "note",
  "transcript",
  "ai_draft",
  "internal_report",
  "report",
  "document_ref",
] as const

export type RecordKind = (typeof RECORD_KINDS)[number]

export const recordKindEnum = pgEnum("record_kind", RECORD_KINDS)

/**
 * Encrypted member-history artifacts for a booking (or standalone).
 * Ciphertext in `title_encrypted` / `body_encrypted` via `@eleva/encryption`.
 * Author-only reads now (D-11 working pre-launch). Clinic share is Phase 11.
 */
export const records = pgTable(
  "records",
  {
    id: pkColumn(),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    memberUserId: uuid("member_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    kind: recordKindEnum("kind").notNull(),
    titleEncrypted: text("title_encrypted").notNull(),
    bodyEncrypted: text("body_encrypted").notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    orgIdx: index("records_org_idx").on(t.orgId),
    memberIdx: index("records_member_idx").on(t.memberUserId),
    bookingIdx: index("records_booking_idx").on(t.bookingId),
    bookingKindUidx: uniqueIndex("records_booking_kind_uidx")
      .on(t.bookingId, t.kind)
      .where(sql`${t.bookingId} IS NOT NULL`),
    authorSelectPolicy: pgPolicy("records_author_select", {
      for: "select",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        AND created_by::text = current_setting('eleva.user_id', true)`,
    }),
    authorInsertPolicy: pgPolicy("records_author_insert", {
      for: "insert",
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)
        AND created_by::text = current_setting('eleva.user_id', true)`,
    }),
    authorUpdatePolicy: pgPolicy("records_author_update", {
      for: "update",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        AND created_by::text = current_setting('eleva.user_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)
        AND created_by::text = current_setting('eleva.user_id', true)`,
    }),
    authorDeletePolicy: pgPolicy("records_author_delete", {
      for: "delete",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        AND created_by::text = current_setting('eleva.user_id', true)`,
    }),
    clinicSharedReadPolicy: pgPolicy("records_clinic_shared_read", {
      for: "select",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        AND kind <> 'internal_report'
        AND member_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM auth.organization o
          WHERE o.id = records.org_id AND o.clinic_shared_records = true
        )
        AND EXISTS (
          SELECT 1 FROM expert_profiles ep
          WHERE ep.org_id = records.org_id
            AND ep.user_id::text = current_setting('eleva.user_id', true)
        )
        AND NOT EXISTS (
          SELECT 1 FROM record_access_optouts opt
          WHERE opt.member_user_id = records.member_user_id
            AND opt.org_id = records.org_id
        )`,
    }),
    memberPublishedReadPolicy: pgPolicy("records_member_published_read", {
      for: "select",
      using: sql`published_at IS NOT NULL
        AND member_user_id::text = current_setting('eleva.user_id', true)`,
    }),
  })
)

/**
 * Member opt-out of clinic-shared records. Table exists so D-11 RLS
 * compiles; UI is Phase 11.
 */
export const recordAccessOptouts = pgTable(
  "record_access_optouts",
  {
    memberUserId: uuid("member_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orgId: orgIdColumn().references(() => organization.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (t) => ({
    pk: primaryKey({
      name: "record_access_optouts_pk",
      columns: [t.memberUserId, t.orgId],
    }),
    orgIdx: index("record_access_optouts_org_idx").on(t.orgId),
    memberPolicy: pgPolicy("record_access_optouts_member", {
      using: sql`member_user_id::text = current_setting('eleva.user_id', true)`,
      withCheck: sql`member_user_id::text = current_setting('eleva.user_id', true)`,
    }),
    orgReadPolicy: pgPolicy("record_access_optouts_org_read", {
      for: "select",
      using: sql`org_id::text = current_setting('eleva.org_id', true)`,
    }),
  })
)

export type RecordRow = typeof records.$inferSelect
export type RecordAccessOptout = typeof recordAccessOptouts.$inferSelect
