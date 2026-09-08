import {
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createdAt, orgIdColumn, pkColumn } from "./shared"

/**
 * Envelope-encryption key registry (used in Phase 3). org_id will gain a
 * NOT VALID FK to auth.organization.id in the Phase 2.1 expand migration.
 */
export const orgDataKeys = pgTable(
  "org_data_keys",
  {
    id: pkColumn(),
    orgId: orgIdColumn(),
    keyVersion: integer("key_version").notNull(),
    kekVersion: text("kek_version").notNull(),
    wrappedDek: text("wrapped_dek").notNull(),
    createdAt: createdAt(),
    retiredAt: timestamp("retired_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    uniqueIndex("org_data_keys_org_version_uidx").on(t.orgId, t.keyVersion),
    uniqueIndex("org_data_keys_one_active_uidx")
      .on(t.orgId)
      .where(sql`retired_at IS NULL`),
    pgPolicy("org_data_keys_tenant_isolation", {
      for: "all",
      to: "public",
      using: sql`org_id = current_setting('eleva.org_id', true)::uuid`,
      withCheck: sql`org_id = current_setting('eleva.org_id', true)::uuid`,
    }),
  ]
)
