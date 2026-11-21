import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { auth, db, main } from "@eleva/db"
import {
  ClinicReviewError,
  decideClinicVerification,
  getClinicVerificationReview,
  listClinicVerificationQueue,
} from "../clinic-review"
import { fileClinicVerification } from "../clinics"

/**
 * Staff review of a clinic's legal identity on the PR's Neon branch
 * (Phase 12): the queue, the review, each decision with its audit row, and
 * the guards. Runs with ELEVA_DB_INTEGRATION=1 in
 * neon-branch-migrate-and-rls, as the app's own database role.
 */
const enabled =
  process.env.ELEVA_DB_INTEGRATION === "1" &&
  process.env.ELEVA_RLS_INTEGRATION !== "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

const CHECKS = { legal_entity_checked: true, tax_id_checked: true } as const

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (err) {
    if (err instanceof ClinicReviewError) return err
    throw err
  }
  throw new Error("expected a ClinicReviewError")
}

describe.skipIf(!enabled || !databaseUrl)(
  "clinic verification review",
  { timeout: 120_000 },
  () => {
    const clinicId = randomUUID()
    const owner = randomUUID()
    const staff = randomUUID()
    const suffix = clinicId.slice(0, 8)

    async function file(legalName: string, taxId: string) {
      const summary = await fileClinicVerification({
        orgId: clinicId,
        actorUserId: owner,
        legalName,
        taxId,
      })
      const [row] = await db()
        .select({
          id: main.clinicVerifications.id,
          submittedAt: main.clinicVerifications.submittedAt,
        })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.id, summary.verification!.id))
      return row!
    }

    async function auditActions() {
      const rows = await db()
        .select({ action: main.auditOutbox.action })
        .from(main.auditOutbox)
        .where(eq(main.auditOutbox.orgId, clinicId))
      return rows.map((row) => row.action)
    }

    beforeAll(async () => {
      await db()
        .insert(auth.user)
        .values([
          {
            id: owner,
            name: "Clinic Owner",
            email: `owner-${suffix}@example.test`,
          },
          {
            id: staff,
            name: "Staff Reviewer",
            email: `staff-${suffix}@example.test`,
          },
        ])
      await db()
        .insert(auth.organization)
        .values({
          id: clinicId,
          name: "Review clinic",
          slug: `review-${suffix}`,
          type: "team",
        })
      await db()
        .insert(auth.member)
        .values({ organizationId: clinicId, userId: owner, role: "owner" })
      await db()
        .insert(main.clinicProfiles)
        .values({
          orgId: clinicId,
          slug: `review-${suffix}`,
          displayName: "Review Clinic",
          countryCode: "PT",
          billingAddress: { city: "Lisboa", country: "PT" },
        })
    })

    afterAll(async () => {
      await db()
        .delete(main.auditOutbox)
        .where(eq(main.auditOutbox.orgId, clinicId))
      // Approved filings keep their reviewer (RESTRICT): filings go first.
      await db()
        .delete(main.clinicVerifications)
        .where(eq(main.clinicVerifications.orgId, clinicId))
      await db()
        .delete(auth.organization)
        .where(eq(auth.organization.id, clinicId))
      await db()
        .delete(auth.user)
        .where(inArray(auth.user.id, [owner, staff]))
    })

    it("queues a pending filing and shows staff what to check", async () => {
      const filing = await file("Review Clinic, Lda", "PT 515 001 708")
      const queue = await listClinicVerificationQueue()
      expect(queue.find((row) => row.orgId === clinicId)).toMatchObject({
        verificationId: filing.id,
        clinicName: "Review Clinic",
        legalName: "Review Clinic, Lda",
        status: "pending",
        verified: false,
      })
      const review = await getClinicVerificationReview(filing.id)
      expect(review).toMatchObject({
        verification: { taxId: "PT515001708", status: "pending" },
        clinic: { displayName: "Review Clinic", countryCode: "PT" },
        owner: { name: "Clinic Owner" },
        people: 1,
        verified: false,
        history: [],
      })
      expect(await getClinicVerificationReview(randomUUID())).toBeNull()
    })

    it("refuses a member of the clinic, a stale view and an unknown filing", async () => {
      const [filing] = await db()
        .select({
          id: main.clinicVerifications.id,
          submittedAt: main.clinicVerifications.submittedAt,
        })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.orgId, clinicId))
      const decision = { decision: "approve", checklist: CHECKS } as const
      expect(
        (
          await refusal(
            decideClinicVerification({
              verificationId: filing!.id,
              submittedAt: filing!.submittedAt,
              actorUserId: owner,
              decision,
            })
          )
        ).code
      ).toBe("SELF_REVIEW")
      expect(
        (
          await refusal(
            decideClinicVerification({
              verificationId: filing!.id,
              submittedAt: new Date(filing!.submittedAt.getTime() - 1000),
              actorUserId: staff,
              decision,
            })
          )
        ).code
      ).toBe("VERIFICATION_CHANGED")
      expect(
        (
          await refusal(
            decideClinicVerification({
              verificationId: randomUUID(),
              submittedAt: filing!.submittedAt,
              actorUserId: staff,
              decision,
            })
          )
        ).code
      ).toBe("VERIFICATION_NOT_FOUND")
      // Nothing was decided.
      expect(await auditActions()).not.toContain("clinic_verification.approved")
    })

    it("asks for changes with a reason; the clinic files again", async () => {
      const [filing] = await db()
        .select({
          id: main.clinicVerifications.id,
          submittedAt: main.clinicVerifications.submittedAt,
        })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.orgId, clinicId))
      const result = await decideClinicVerification({
        verificationId: filing!.id,
        submittedAt: filing!.submittedAt,
        actorUserId: staff,
        decision: {
          decision: "needs_changes",
          reason: "The legal name does not match the register.",
        },
      })
      expect(result).toEqual({ status: "needs_changes", verified: false })
      // Sent back: it waits on the clinic and cannot be decided again.
      expect(
        (
          await refusal(
            decideClinicVerification({
              verificationId: filing!.id,
              submittedAt: filing!.submittedAt,
              actorUserId: staff,
              decision: { decision: "approve", checklist: CHECKS },
            })
          )
        ).code
      ).toBe("VERIFICATION_ALREADY_DECIDED")
      expect(await auditActions()).toContain(
        "clinic_verification.changes_requested"
      )
    })

    it("approves the refiled identity: the clinic is verified", async () => {
      const refiled = await file("Review Clinic Unipessoal, Lda", "515001708")
      const result = await decideClinicVerification({
        verificationId: refiled.id,
        submittedAt: refiled.submittedAt,
        actorUserId: staff,
        decision: { decision: "approve", checklist: CHECKS },
      })
      expect(result).toEqual({ status: "approved", verified: true })
      const [row] = await db()
        .select({
          reviewerUserId: main.clinicVerifications.reviewerUserId,
          reviewedAt: main.clinicVerifications.reviewedAt,
          checklist: main.clinicVerifications.checklist,
        })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.id, refiled.id))
      expect(row).toMatchObject({ reviewerUserId: staff, checklist: CHECKS })
      expect(row!.reviewedAt).toBeInstanceOf(Date)
      expect(await auditActions()).toContain("clinic_verification.approved")
      // Decided filings leave the queue.
      const queue = await listClinicVerificationQueue()
      expect(queue.find((row) => row.orgId === clinicId)).toBeUndefined()
    })

    it("keeps the clinic verified when a later filing is rejected", async () => {
      const later = await file("Another Name, Lda", "PT515001708")
      expect(
        (await listClinicVerificationQueue()).find(
          (row) => row.orgId === clinicId
        )
      ).toMatchObject({ status: "pending", verified: true })
      const result = await decideClinicVerification({
        verificationId: later.id,
        submittedAt: later.submittedAt,
        actorUserId: staff,
        decision: { decision: "reject", reason: "Not the registered name." },
      })
      expect(result).toEqual({ status: "rejected", verified: true })
      const review = await getClinicVerificationReview(later.id)
      expect(review?.verified).toBe(true)
      expect(review?.verification.reason).toBe("Not the registered name.")
      expect(review?.history.map((filing) => filing.status)).toEqual([
        "approved",
      ])
      expect(await auditActions()).toContain("clinic_verification.rejected")
    })
  }
)
