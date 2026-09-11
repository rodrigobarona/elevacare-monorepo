import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const authSchema = pgSchema("auth")

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })

export const user = authSchema.table(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    role: text("role").notNull().default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamptz("ban_expires"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    timezone: text("timezone"),
    locale: text("locale"),
    /** App-owned. Only `scheduleAccountDeletion` writes this — not Better Auth input. */
    deletionScheduledAt: timestamptz("deletion_scheduled_at"),
  },
  (table) => [uniqueIndex("auth_user_email_uidx").on(table.email)]
)

export const session = authSchema.table(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid("active_organization_id"),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [
    uniqueIndex("auth_session_token_uidx").on(table.token),
    index("auth_session_user_idx").on(table.userId),
  ]
)

export const account = authSchema.table(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [index("auth_account_user_idx").on(table.userId)]
)

export const verification = authSchema.table(
  "verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").defaultNow(),
    updatedAt: timestamptz("updated_at").defaultNow(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)]
)

export const organization = authSchema.table(
  "organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    metadata: text("metadata"),
    type: text("type").notNull().default("personal"),
  },
  (table) => [uniqueIndex("auth_organization_slug_uidx").on(table.slug)]
)

export const member = authSchema.table(
  "member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_member_user_org_uidx").on(
      table.userId,
      table.organizationId
    ),
    index("auth_member_org_idx").on(table.organizationId),
  ]
)

export const invitation = authSchema.table(
  "invitation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_invitation_org_idx").on(table.organizationId)]
)

export const twoFactor = authSchema.table("twoFactor", {
  id: uuid("id").primaryKey().defaultRandom(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const passkey = authSchema.table(
  "passkey",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamptz("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [index("auth_passkey_user_idx").on(table.userId)]
)

export const jwks = authSchema.table("jwks", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  expiresAt: timestamptz("expires_at"),
  alg: text("alg"),
  crv: text("crv"),
})

export const apikey = authSchema.table(
  "apikey",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamptz("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamptz("last_request"),
    expiresAt: timestamptz("expires_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    permissions: text("permissions"),
    metadata: text("metadata"),
    referenceId: text("reference_id"),
  },
  (table) => [
    index("auth_apikey_user_idx").on(table.userId),
    index("auth_apikey_reference_idx").on(table.referenceId),
  ]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}))
