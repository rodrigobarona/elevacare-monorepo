import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import {
  createdAt,
  deletedAt,
  orgIdColumn,
  pkColumn,
  updatedAt,
} from "./shared"
import { expertProfiles, invoicingProviderEnum } from "./expert-profiles"

/**
 * Per-expert OAuth credentials for Tier 2 invoicing adapters
 * (TOConline, Moloni, etc. — see ADR-013).
 *
 * The actual access/refresh tokens NEVER live in this table; they
 * are encrypted via @eleva/encryption.encryptOAuthToken and the
 * resulting Vault ref is stored in `vaultRef`. On revoke we call
 * `revokeOAuthToken(vaultRef)`.
 *
 * RLS: tenant-scoped by org_id (mirrors expert_profiles.org_id).
 *
 * Status lifecycle:
 *   pending      -> OAuth flow initiated, waiting for callback
 *   active       -> token in Vault, ready to issue invoices
 *   expired      -> refresh failed; expert needs to reconnect
 *   revoked      -> expert disconnected or admin revoked
 */

export const credentialStatusEnum = pgEnum("credential_status", [
  "pending",
  "active",
  "expired",
  "revoked",
])

export const expertIntegrationCredentials = pgTable(
  "expert_integration_credentials",
  {
    id: pkColumn(),
    orgId: orgIdColumn(),
    expertProfileId: uuid("expert_profile_id")
      .notNull()
      .references(() => expertProfiles.id, { onDelete: "cascade" }),

    /** Adapter slug — must match a registered adapter in @eleva/accounting. */
    provider: invoicingProviderEnum("provider").notNull(),

    /** WorkOS Vault reference (e.g., "vault:eleva-care:oauth/toconline/<userId>"). */
    vaultRef: varchar("vault_ref", { length: 255 }).notNull(),

    /**
     * Adapter-specific identifiers — provider customer ID, tenant ID,
     * series prefix, etc. Never tokens. Inspectable in admin UI.
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    status: credentialStatusEnum("status").notNull().default("pending"),

    connectedAt: timestamp("connected_at", {
      withTimezone: true,
      mode: "date",
    }),

    /**
     * Expiry of the active token (informational; refresh logic
     * relies on the Vault payload). Drives the "reconnect needed"
     * banner in expert UI.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),

    /** Last refresh attempt timestamp. */
    lastRefreshAt: timestamp("last_refresh_at", {
      withTimezone: true,
      mode: "date",
    }),

    /** Last error reason (machine-readable code from adapter). */
    lastErrorCode: varchar("last_error_code", { length: 64 }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => ({
    /** One active credential per expert per provider. */
    expertProviderUnique: uniqueIndex(
      "expert_integration_credentials_expert_provider_unique"
    ).on(t.expertProfileId, t.provider),
    expertIdx: index("expert_integration_credentials_expert_idx").on(
      t.expertProfileId
    ),
    statusIdx: index("expert_integration_credentials_status_idx").on(t.status),
  })
)

export type ExpertIntegrationCredential =
  typeof expertIntegrationCredentials.$inferSelect
export type NewExpertIntegrationCredential =
  typeof expertIntegrationCredentials.$inferInsert
export type CredentialStatus = (typeof credentialStatusEnum.enumValues)[number]
