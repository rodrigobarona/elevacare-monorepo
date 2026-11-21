import { and, desc, eq, inArray } from "drizzle-orm"
import { withAudit } from "@eleva/audit"
import { normalizeClinicTaxId as normalizeClinicTaxIdOrNull } from "@eleva/config/clinic-verification"
import {
  auth,
  isUniqueViolation,
  main,
  withOrgContext,
  withPlatformAdminContext,
  type Tx,
} from "@eleva/db"
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
  | "VERIFICATION_UNCHANGED"
  | "INVALID_TAX_ID"

export class ClinicError extends Error {
  constructor(readonly code: ClinicErrorCode) {
    super(code)
    this.name = "ClinicError"
  }
}

/** 3–30 lowercase letters, digits and single hyphens. */
const CLINIC_SLUG = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

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
  const value = normalizeClinicTaxIdOrNull(raw)
  if (value === null) throw new ClinicError("INVALID_TAX_ID")
  return value
}

async function hasProfile(orgId: string): Promise<boolean> {
  const rows = await withOrgContext(orgId, (tx) =>
    tx
      .select({ id: main.clinicProfiles.id })
      .from(main.clinicProfiles)
      .where(eq(main.clinicProfiles.orgId, orgId))
      .limit(1)
  )
  return rows.length > 0
}

async function insertProfile(input: {
  orgId: string
  slug: string
  name: string
  actorUserId: string
}): Promise<void> {
  await withAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (tx, ctx) => {
      await tx.insert(main.clinicProfiles).values({
        orgId: input.orgId,
        slug: input.slug,
        displayName: input.name,
      })
      await ctx.emit({
        entity: "team",
        action: "created",
        entityId: input.orgId,
        payload: { slug: input.slug },
      })
    }
  )
}

/**
 * Creates the clinic's profile row for a team org. Idempotent: one profile
 * per org (unique `org_id`). When the org slug is already another clinic's
 * public slug, it falls back to the id-based slug.
 */
export async function provisionClinicProfile(input: {
  orgId: string
  orgSlug: string
  name: string
  actorUserId: string
}): Promise<void> {
  if (await hasProfile(input.orgId)) return
  const preferred = clinicSlugFor(input.orgSlug, input.orgId)
  const fallback = clinicSlugFor("", input.orgId)
  for (const slug of preferred === fallback
    ? [preferred]
    : [preferred, fallback]) {
    try {
      await insertProfile({ ...input, slug })
      return
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Created meanwhile for this org (unique org_id): done.
      if (await hasProfile(input.orgId)) return
      // Otherwise the slug belongs to another clinic: try the fallback.
    }
  }
  throw new ClinicError("CLINIC_NOT_FOUND")
}

/**
 * A team org whose profile creation failed (or predates Phase 11) gets it
 * on first read, so the clinic admin is never stuck.
 */
async function repairMissingProfile(
  orgId: string,
  actorUserId: string
): Promise<boolean> {
  const [org] = await withPlatformAdminContext((tx) =>
    tx
      .select({
        slug: auth.organization.slug,
        name: auth.organization.name,
        type: auth.organization.type,
      })
      .from(auth.organization)
      .where(eq(auth.organization.id, orgId))
      .limit(1)
  )
  if (!org || org.type !== "team") return false
  await provisionClinicProfile({
    orgId,
    orgSlug: org.slug,
    name: org.name,
    actorUserId,
  })
  return true
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

export async function getClinicSummary(
  orgId: string,
  actorUserId: string
): Promise<ClinicSummary> {
  const read = () =>
    withOrgContext(orgId, async (tx) => {
      const profile = await loadProfile(tx, orgId)
      const { current, verified } = await loadVerification(tx, orgId)
      return { profile, verification: current, verified }
    })
  try {
    return await read()
  } catch (err) {
    if (!(err instanceof ClinicError) || err.code !== "CLINIC_NOT_FOUND") {
      throw err
    }
    if (!(await repairMissingProfile(orgId, actorUserId))) throw err
    return read()
  }
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
          legalName: main.clinicVerifications.legalName,
          taxId: main.clinicVerifications.taxId,
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
        // The same details again change nothing for staff, and would only
        // send the filing to the back of the queue (it is checked oldest
        // first) and make a decision in progress answer "changed".
        if (open.legalName === legalName && open.taxId === taxId) {
          throw new ClinicError("VERIFICATION_UNCHANGED")
        }
        const [row] = await tx
          .update(main.clinicVerifications)
          .set({
            status: "pending",
            legalName,
            taxId,
            reason: null,
            // A filing sent back was stamped by staff: it is undecided again.
            reviewerUserId: null,
            reviewedAt: null,
            checklist: {},
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          // Still as it was read: a staff decision that landed meanwhile
          // (approved, rejected or sent back) is never overwritten. The
          // clinic gets VERIFICATION_LOCKED, reloads and sees it.
          .where(
            and(
              eq(main.clinicVerifications.id, open.id),
              eq(main.clinicVerifications.status, open.status)
            )
          )
          .returning({ id: main.clinicVerifications.id })
        if (!row) throw new ClinicError("VERIFICATION_LOCKED")
        id = row.id
      } else {
        // Two filings at once: the one-open-row-per-org index lets one win;
        // the other gets VERIFICATION_LOCKED (409) and can refile.
        const [row] = await tx
          .insert(main.clinicVerifications)
          .values({ orgId: input.orgId, legalName, taxId })
          .returning({ id: main.clinicVerifications.id })
          .catch((err: unknown) => {
            if (isUniqueViolation(err)) {
              throw new ClinicError("VERIFICATION_LOCKED")
            }
            throw err
          })
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
