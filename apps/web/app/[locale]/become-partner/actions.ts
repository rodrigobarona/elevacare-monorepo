"use server"

import { revalidatePath } from "next/cache"

import {
  checkPublicSlugAvailability,
  main,
  type SlugAvailability,
} from "@eleva/db"
import { withAudit } from "@eleva/audit"
import { getSession, UnauthorizedError } from "@eleva/auth"
import { validateUsername } from "@eleva/config/reserved-usernames"

import {
  becomePartnerSubmissionSchema,
  type BecomePartnerSubmissionInput,
} from "@/lib/become-partner/schema"

export interface UsernameCheckResult {
  username: string
  status: SlugAvailability
}

/**
 * Public availability check used by the username picker. Format is
 * validated client-side already; we re-validate here as defence in
 * depth before touching the database.
 */
export async function checkUsernameAction(
  raw: string
): Promise<UsernameCheckResult> {
  const username = String(raw ?? "")
    .trim()
    .toLowerCase()

  const formatErr = validateUsername(username)
  if (formatErr === "reserved") {
    return { username, status: { available: false, reason: "reserved" } }
  }
  if (formatErr) {
    return { username, status: { available: false, reason: "format-invalid" } }
  }

  const status = await checkPublicSlugAvailability(username)
  return { username, status }
}

export type SubmitApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; error: "validation"; issues: string[] }
  | { ok: false; error: "username-taken"; reason: SlugAvailability["reason"] }
  | { ok: false; error: "auth" }
  | { ok: false; error: "duplicate-application" }
  | { ok: false; error: "internal" }

/**
 * Submit a Become-Partner application. Requires an authenticated user.
 *
 * Steps:
 *   1. Load session — applicant must be signed in.
 *   2. Zod-parse the payload (defence in depth; client validates too).
 *   3. Final username availability check (race-tolerant; the partial
 *      unique index guarantees only one pending application per
 *      applicant exists).
 *   4. Insert the row inside withAudit so audit_outbox commits in the
 *      same transaction.
 */
export async function submitApplicationAction(
  input: BecomePartnerSubmissionInput
): Promise<SubmitApplicationResult> {
  let session
  try {
    session = await getSession()
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "auth" }
    return { ok: false, error: "internal" }
  }
  if (!session) return { ok: false, error: "auth" }

  const parsed = becomePartnerSubmissionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      issues: parsed.error.issues.map((i) => i.message),
    }
  }
  const data = parsed.data

  const availability = await checkPublicSlugAvailability(data.username)
  if (!availability.available) {
    return {
      ok: false,
      error: "username-taken",
      reason: availability.reason,
    }
  }

  try {
    const applicationId = await withAudit(
      {
        orgId: session.orgId,
        actorUserId: session.user.workosUserId,
      },
      async (tx, ctx) => {
        const inserted = await tx
          .insert(main.becomePartnerApplications)
          .values({
            applicantUserId: session.user.id,
            applicantOrgId: session.orgId,
            type: data.type,
            usernameRequested: data.username,
            displayName: data.displayName,
            bio: data.bio || null,
            nif: data.nif || null,
            licenseNumber: data.licenseNumber || null,
            licenseScope: data.licenseScope || null,
            practiceCountries: data.practiceCountries,
            languages: data.languages,
            categorySlugs: data.categorySlugs,
            documents: data.documents.map((d) => ({
              kind: d.kind,
              name: d.name,
              url: d.url,
              size: d.size,
              contentType: d.contentType,
              uploadedAt: d.uploadedAt,
            })),
            status: "submitted",
          })
          .returning({ id: main.becomePartnerApplications.id })

        const id = inserted[0]!.id
        await ctx.emit({
          entity: "become_partner_application",
          action: "submitted",
          entityId: id,
          payload: {
            type: data.type,
            usernameRequested: data.username,
            categorySlugs: data.categorySlugs,
            documentCount: data.documents.length,
          },
        })
        return id
      }
    )

    revalidatePath("/[locale]/become-partner", "page")
    return { ok: true, applicationId }
  } catch (err) {
    // The partial unique index `become_partner_applications_one_pending`
    // surfaces 23505 from Postgres when the applicant already has a
    // submitted/under-review row. Surface that as a user-friendly error.
    if (isPgUniqueViolation(err)) {
      return { ok: false, error: "duplicate-application" }
    }
    console.error("submitApplicationAction failed", err)
    return { ok: false, error: "internal" }
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const code = (err as { code?: unknown }).code
  return code === "23505"
}
