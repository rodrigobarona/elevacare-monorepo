import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { createdAt, deletedAt, orgIdColumn, pkColumn } from "./shared"
import { organization, user } from "../auth"
import { bookings } from "./bookings"

export const SESSION_DOCUMENT_SCOPES = ["expert_only", "shared"] as const

export type SessionDocumentScope = (typeof SESSION_DOCUMENT_SCOPES)[number]

export const sessionDocumentScopeEnum = pgEnum(
  "session_document_scope",
  SESSION_DOCUMENT_SCOPES
)

/**
 * Private-blob documents on a booking's member history.
 * Metadata (original filename) is envelope-encrypted. Bytes live in
 * the private Vercel Blob store, never the public one.
 */
export const sessionDocuments = pgTable(
  "session_documents",
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
    blobPathname: text("blob_pathname").notNull(),
    blobUrl: text("blob_url").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    metadataEncrypted: text("metadata_encrypted").notNull(),
    scope: sessionDocumentScopeEnum("scope").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    orgIdx: index("session_documents_org_idx").on(t.orgId),
    memberIdx: index("session_documents_member_idx").on(t.memberUserId),
    bookingIdx: index("session_documents_booking_idx").on(t.bookingId),
    pathnameUidx: uniqueIndex("session_documents_blob_pathname_uidx").on(
      t.blobPathname
    ),
    authorSelectPolicy: pgPolicy("session_documents_author_select", {
      for: "select",
      using: sql`deleted_at IS NULL
        AND org_id::text = current_setting('eleva.org_id', true)
        AND (
          uploaded_by::text = current_setting('eleva.user_id', true)
          OR EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = session_documents.booking_id
              AND b.expert_user_id::text = current_setting('eleva.user_id', true)
          )
        )`,
    }),
    authorInsertPolicy: pgPolicy("session_documents_author_insert", {
      for: "insert",
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)
        AND uploaded_by::text = current_setting('eleva.user_id', true)`,
    }),
    authorUpdatePolicy: pgPolicy("session_documents_author_update", {
      for: "update",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        AND uploaded_by::text = current_setting('eleva.user_id', true)`,
      withCheck: sql`org_id::text = current_setting('eleva.org_id', true)
        AND uploaded_by::text = current_setting('eleva.user_id', true)`,
    }),
    authorDeletePolicy: pgPolicy("session_documents_author_delete", {
      for: "delete",
      using: sql`org_id::text = current_setting('eleva.org_id', true)
        AND uploaded_by::text = current_setting('eleva.user_id', true)`,
    }),
    clinicSharedReadPolicy: pgPolicy("session_documents_clinic_shared_read", {
      for: "select",
      using: sql`deleted_at IS NULL
        AND org_id::text = current_setting('eleva.org_id', true)
        AND member_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM auth.organization o
          WHERE o.id = session_documents.org_id AND o.clinic_shared_records = true
        )
        AND EXISTS (
          SELECT 1 FROM expert_profiles ep
          WHERE ep.org_id = session_documents.org_id
            AND ep.user_id::text = current_setting('eleva.user_id', true)
        )
        AND NOT EXISTS (
          SELECT 1 FROM record_access_optouts opt
          WHERE opt.member_user_id = session_documents.member_user_id
            AND opt.org_id = session_documents.org_id
        )`,
    }),
    memberSharedReadPolicy: pgPolicy("session_documents_member_shared_read", {
      for: "select",
      using: sql`deleted_at IS NULL
        AND scope = 'shared'
        AND member_user_id::text = current_setting('eleva.user_id', true)`,
    }),
  })
)

export type SessionDocumentRow = typeof sessionDocuments.$inferSelect
