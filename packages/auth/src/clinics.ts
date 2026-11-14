import { and, desc, eq, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { main, withOrgContext, type Tx } from "@eleva/db"
import type {
  ClinicBillingAddress,
  ClinicProfile,
  ClinicVerification,
} from "@eleva/db/schema"

/**
 * Clinic (team org) profile and verification filing — Phase 11.1.
 *
 * The public profile is tenant-editable. The legal name and NIF live only
 * on `clinic_verifications`; a clinic is verified while an `approved` row
 * exists (decision log 2026-11-14). Staff decisions are Phase 12.
 */

export type ClinicErrorCode =
  | "CLINIC_NOT_FOUND"
  | "VERIFICATION_LOCKED"
  | "INVALID_TAX_ID"

export class ClinicError extends Error {
  constructor(readonly code: ClinicErrorCode) {
    super(code)
    this.name = "ClinicError"
  }
}

const CLINIC_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/

/**
 * The clinic's public slug: the org slug when it fits the clinic slug rule
 * (3–30 lowercase letters, digits and single hyphens), otherwise a short
 * id-based fallback the clinic can change later.
 */
export function clinicSlugFor(orgSlug: string, orgId: string): string {
  if (CLINIC_SLUG.test(orgSlug) && !orgSlug.includes("--")) return orgSlug
  return `clinic-${orgId.replace(/-/g, "").slice(0, 12)}`
}

/** "PT 515 001 708" → "PT515001708". Throws INVALID_TAX_ID when malformed. */
export function normalizeClinicTaxId(raw: string): string {
  const value = raw.replace(/[\s.-]/g, "").toUpperCase()
  if (!/^[A-Z0-9]{8,32}$/.test(value)) {
    throw new ClinicError("INVALID_TAX_ID")
  }
  return value
}

/** Creates the clinic's profile row for a new team org. Idempotent. */
export async function provisionClinicProfile(input: {
  orgId: string
  orgSlug: string
  name: string
  actorUserId: string
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const inserted = await tx
        .insert(main.clinicProfiles)
        .values({
          orgId: input.orgId,
          slug: clinicSlugFor(input.orgSlug, input.orgId),
          displayName: input.name,
        })
        .onConflictDoNothing()
        .returning({ id: main.clinicProfiles.id })
      await ctx.emit({
        entity: "team",
        action: "created",
        entityId: input.orgId,
        payload: { profileCreated: inserted.length > 0 },
      })
    }
  )
}

export type ClinicProfilePatch = {
  displayName?: string
  description?: string | null
  websiteUrl?: string | null
  countryCode?: string | null
  billingAddress?: ClinicBillingAddress
  specialties?: string[]
}

export type ClinicVerificationView = Pick<
  ClinicVerification,
  "id" | "status" | "legalName" | "taxId" | "submittedAt" | "reviewedAt"
> & { reason: string | null }

export type ClinicSummary = {
  profile: ClinicProfile
  /** The open filing if any, else the latest decided one. */
  verification: ClinicVerificationView | null
  /** An approved filing exists. */
  verified: boolean
}

async function loadProfile(tx: Tx, orgId: string): Promise<ClinicProfile> {
  const [profile] = await tx
    .select()
    .from(main.clinicProfiles)
    .where(eq(main.clinicProfiles.orgId, orgId))
    .limit(1)
  if (!profile) throw new ClinicError("CLINIC_NOT_FOUND")
  return profile
}

async function loadVerification(
  tx: Tx,
  orgId: string
): Promise<{ current: ClinicVerificationView | null; verified: boolean }> {
  const rows = await tx
    .select({
      id: main.clinicVerifications.id,
      status: main.clinicVerifications.status,
      legalName: main.clinicVerifications.legalName,
      taxId: main.clinicVerifications.taxId,
      submittedAt: main.clinicVerifications.submittedAt,
      reviewedAt: main.clinicVerifications.reviewedAt,
      reason: main.clinicVerifications.reason,
    })
    .from(main.clinicVerifications)
    .where(eq(main.clinicVerifications.orgId, orgId))
    .orderBy(desc(main.clinicVerifications.submittedAt))
  const open = rows.find(
    (row) => row.status === "pending" || row.status === "needs_changes"
  )
  return {
    current: open ?? rows[0] ?? null,
    verified: rows.some((row) => row.status === "approved"),
  }
}

export async function getClinicSummary(orgId: string): Promise<ClinicSummary> {
  return withOrgContext(orgId, async (tx) => {
    const profile = await loadProfile(tx, orgId)
    const { current, verified } = await loadVerification(tx, orgId)
    return { profile, verification: current, verified }
  })
}

export async function updateClinicProfile(input: {
  orgId: string
  actorUserId: string
  patch: ClinicProfilePatch
}): Promise<ClinicSummary> {
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await loadProfile(tx, input.orgId)
      const [profile] = await tx
        .update(main.clinicProfiles)
        .set({ ...input.patch, updatedAt: new Date() })
        .where(eq(main.clinicProfiles.orgId, input.orgId))
        .returning()
      await ctx.emit({
        entity: "team",
        action: "updated",
        entityId: input.orgId,
        payload: { fields: Object.keys(input.patch) },
      })
      const { current, verified } = await loadVerification(tx, input.orgId)
      return { profile: profile!, verification: current, verified }
    }
  )
}

/**
 * Files the clinic's legal name and NIF for staff review, or refiles the
 * open filing. A clinic that is already verified can file a new identity;
 * it stays verified under the approved one until staff decide.
 */
export async function fileClinicVerification(input: {
  orgId: string
  actorUserId: string
  legalName: string
  taxId: string
}): Promise<ClinicSummary> {
  const taxId = normalizeClinicTaxId(input.taxId)
  const legalName = input.legalName.trim()
  return withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      const profile = await loadProfile(tx, input.orgId)
      const [open] = await tx
        .select({
          id: main.clinicVerifications.id,
          status: main.clinicVerifications.status,
        })
        .from(main.clinicVerifications)
        .where(
          and(
            eq(main.clinicVerifications.orgId, input.orgId),
            inArray(main.clinicVerifications.status, [
              "pending",
              "needs_changes",
            ])
          )
        )
        .limit(1)
      let id: string
      if (open) {
        const [row] = await tx
          .update(main.clinicVerifications)
          .set({
            status: "pending",
            legalName,
            taxId,
            reason: null,
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(main.clinicVerifications.id, open.id))
          .returning({ id: main.clinicVerifications.id })
        if (!row) throw new ClinicError("VERIFICATION_LOCKED")
        id = row.id
      } else {
        const [row] = await tx
          .insert(main.clinicVerifications)
          .values({ orgId: input.orgId, legalName, taxId })
          .returning({ id: main.clinicVerifications.id })
        id = row!.id
      }
      await ctx.emit({
        entity: "clinic_verification",
        action: "submitted",
        entityId: id,
        payload: { refiled: Boolean(open) },
      })
      const { current, verified } = await loadVerification(tx, input.orgId)
      return { profile, verification: current, verified }
    }
  )
}
