import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { auth, db, main } from "@eleva/db"
import {
  ClinicReviewError,
  decideClinicVerification,
  getClinicVerificationReview,
  listClinicVerificationQueue,
} from "../clinic-review"
import { ClinicError, fileClinicVerification } from "../clinics"

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
    const staffOrgId = randomUUID()
    const owner = randomUUID()
    const staff = randomUUID()
    const suffix = clinicId.slice(0, 8)
    const viewer = { actorUserId: staff, orgId: staffOrgId }

    /** This clinic's row in the queue, on whichever page it is. */
    async function inQueue() {
      const first = await listClinicVerificationQueue({ page: 1, viewer })
      for (let page = 1; page <= first.pages; page += 1) {
        const { items } =
          page === 1
            ? first
            : await listClinicVerificationQueue({ page, viewer })
        const row = items.find((item) => item.orgId === clinicId)
        if (row) return row
      }
      return undefined
    }

    /** The records of queue reads, kept under the staff workspace. */
    async function queueReads() {
      return db()
        .select({
          action: main.auditOutbox.action,
          entityId: main.auditOutbox.entityId,
          actorUserId: main.auditOutbox.actorUserId,
          payload: main.auditOutbox.payload,
        })
        .from(main.auditOutbox)
        .where(eq(main.auditOutbox.orgId, staffOrgId))
        .orderBy(main.auditOutbox.createdAt)
    }

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

    /** The notices queued for the clinic, each with its delivery. */
    async function notices() {
      return db()
        .select({
          type: main.domainEventsOutbox.type,
          payload: main.domainEventsOutbox.payload,
          subscriberId: main.domainEventDeliveries.subscriberId,
          deliveryStatus: main.domainEventDeliveries.status,
        })
        .from(main.domainEventsOutbox)
        .innerJoin(
          main.domainEventDeliveries,
          eq(main.domainEventDeliveries.eventId, main.domainEventsOutbox.id)
        )
        .where(eq(main.domainEventsOutbox.orgId, clinicId))
        .orderBy(main.domainEventsOutbox.createdAt)
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
        .values([
          {
            id: clinicId,
            name: "Review clinic",
            slug: `review-${suffix}`,
            type: "team",
          },
          {
            id: staffOrgId,
            name: "Review staff",
            slug: `review-staff-${suffix}`,
            type: "staff",
          },
        ])
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
        .where(inArray(main.auditOutbox.orgId, [clinicId, staffOrgId]))
      // Approved filings keep their reviewer (RESTRICT): filings go first.
      await db()
        .delete(main.clinicVerifications)
        .where(eq(main.clinicVerifications.orgId, clinicId))
      await db()
        .delete(auth.organization)
        .where(inArray(auth.organization.id, [clinicId, staffOrgId]))
      await db()
        .delete(auth.user)
        .where(inArray(auth.user.id, [owner, staff]))
    })

    it("returns one page of the queue, says where it sits, and records the read", async () => {
      const before = (await queueReads()).length
      const first = await listClinicVerificationQueue({ page: 1, viewer })
      expect(first.page).toBe(1)
      expect(first.pageSize).toBe(25)
      expect(first.items.length).toBeLessThanOrEqual(25)
      expect(first.items.length).toBe(Math.min(25, first.total))
      expect(first.pages).toBe(Math.max(1, Math.ceil(first.total / 25)))
      // A page past the end is the last page, never an empty one.
      const past = await listClinicVerificationQueue({ page: 9_999, viewer })
      expect(past.page).toBe(first.pages)
      // The same order every time: the same rows, in the same places.
      const again = await listClinicVerificationQueue({ page: 1, viewer })
      expect(again.items.map((row) => row.verificationId)).toEqual(
        first.items.map((row) => row.verificationId)
      )
      // Each read left a record: who, which page, how many, never a name.
      const reads = (await queueReads()).slice(before)
      expect(reads).toHaveLength(3)
      expect(reads[0]).toMatchObject({
        action: "clinic_verification.listed",
        entityId: null,
        actorUserId: staff,
        payload: {
          page: 1,
          pages: first.pages,
          shown: first.items.length,
          total: first.total,
        },
      })
      expect(reads[1]?.payload).toMatchObject({ page: first.pages })
      expect(JSON.stringify(reads)).not.toMatch(/Lda|Clinic/)
    })

    it("queues a pending filing and shows staff what to check", async () => {
      const filing = await file("Review Clinic, Lda", "PT 515 001 708")
      expect(await inQueue()).toMatchObject({
        verificationId: filing.id,
        clinicName: "Review Clinic",
        legalName: "Review Clinic, Lda",
        status: "pending",
        verified: false,
      })
      const review = await getClinicVerificationReview(filing.id, {
        actorUserId: staff,
      })
      expect(review).toMatchObject({
        verification: { taxId: "PT515001708", status: "pending" },
        clinic: { displayName: "Review Clinic", countryCode: "PT" },
        owner: { name: "Clinic Owner" },
        people: 1,
        verified: false,
        history: [],
      })
      expect(
        await getClinicVerificationReview(randomUUID(), { actorUserId: staff })
      ).toBeNull()
      // Opening the filing is recorded: who looked, at which filing, in
      // which state. An unknown filing shows nothing and records nothing.
      const opened = await db()
        .select({
          action: main.auditOutbox.action,
          entityId: main.auditOutbox.entityId,
          actorUserId: main.auditOutbox.actorUserId,
          payload: main.auditOutbox.payload,
        })
        .from(main.auditOutbox)
        .where(
          and(
            eq(main.auditOutbox.orgId, clinicId),
            eq(main.auditOutbox.action, "clinic_verification.opened")
          )
        )
      expect(opened).toEqual([
        {
          action: "clinic_verification.opened",
          entityId: filing.id,
          actorUserId: staff,
          payload: { status: "pending" },
        },
      ])
    })

    it("refuses the same details again, so the filing keeps its place", async () => {
      const read = async () => {
        const [row] = await db()
          .select({ submittedAt: main.clinicVerifications.submittedAt })
          .from(main.clinicVerifications)
          .where(eq(main.clinicVerifications.orgId, clinicId))
        return row!.submittedAt.getTime()
      }
      const before = await read()
      // Written another way, the same legal name and number.
      const again = await file(" Review Clinic, Lda ", "pt515.001.708").catch(
        (err: unknown) => err
      )
      expect(again).toBeInstanceOf(ClinicError)
      expect((again as ClinicError).code).toBe("VERIFICATION_UNCHANGED")
      // Staff check the oldest filing first: it did not move, and nothing
      // was written.
      expect(await read()).toBe(before)
      expect(
        (await auditActions()).filter(
          (action) => action === "clinic_verification.submitted"
        )
      ).toHaveLength(1)
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
      // The notice to the clinic is queued with the decision, once: the
      // refused second decision queued nothing.
      expect(await notices()).toEqual([
        {
          type: "clinic.needs_changes",
          payload: {
            verificationId: filing!.id,
            reason: "The legal name does not match the register.",
            verified: false,
          },
          subscriberId: "send-notification",
          deliveryStatus: "pending",
        },
      ])
    })

    it("lets the clinic send the same details again once staff asked for a change", async () => {
      // What staff asked for may be outside the two fields: the same legal
      // name and number are accepted, and the filing is undecided again.
      const again = await file("Review Clinic, Lda", "PT 515 001 708")
      const [row] = await db()
        .select({ status: main.clinicVerifications.status })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.id, again.id))
      expect(row?.status).toBe("pending")
    })

    it("approves the refiled identity: the clinic is verified", async () => {
      const refiled = await file("Review Clinic Unipessoal, Lda", "515001708")
      // Refiling makes it undecided again: the earlier staff stamp is gone.
      const [undecided] = await db()
        .select({
          status: main.clinicVerifications.status,
          reviewerUserId: main.clinicVerifications.reviewerUserId,
          reviewedAt: main.clinicVerifications.reviewedAt,
          reason: main.clinicVerifications.reason,
        })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.id, refiled.id))
      expect(undecided).toEqual({
        status: "pending",
        reviewerUserId: null,
        reviewedAt: null,
        reason: null,
      })
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
      expect((await notices()).at(-1)).toMatchObject({
        type: "clinic.verified",
        payload: { verificationId: refiled.id, reason: null, verified: true },
      })
      // Decided filings leave the queue.
      expect(await inQueue()).toBeUndefined()
    })

    it("keeps the clinic verified when a later filing is rejected", async () => {
      const later = await file("Another Name, Lda", "PT515001708")
      expect(await inQueue()).toMatchObject({
        status: "pending",
        verified: true,
      })
      const result = await decideClinicVerification({
        verificationId: later.id,
        submittedAt: later.submittedAt,
        actorUserId: staff,
        decision: { decision: "reject", reason: "Not the registered name." },
      })
      expect(result).toEqual({ status: "rejected", verified: true })
      const review = await getClinicVerificationReview(later.id, {
        actorUserId: staff,
      })
      expect(review?.verified).toBe(true)
      expect(review?.verification.reason).toBe("Not the registered name.")
      expect(review?.history.map((filing) => filing.status)).toEqual([
        "approved",
      ])
      expect(await auditActions()).toContain("clinic_verification.rejected")
      // The notice says the clinic stays verified.
      expect((await notices()).at(-1)).toMatchObject({
        type: "clinic.rejected",
        payload: { reason: "Not the registered name.", verified: true },
      })
      // Seen from the approved filing, the later one is not "earlier".
      const [approved] = await db()
        .select({ id: main.clinicVerifications.id })
        .from(main.clinicVerifications)
        .where(
          and(
            eq(main.clinicVerifications.orgId, clinicId),
            eq(main.clinicVerifications.status, "approved")
          )
        )
      const first = await getClinicVerificationReview(approved!.id, {
        actorUserId: staff,
      })
      expect(first?.history).toEqual([])
    })

    it("never lets a refile overwrite a decision that landed meanwhile", async () => {
      // The open filing is approved while the clinic is sending new details.
      const open = await file("Yet Another Name, Lda", "PT515001708")
      await decideClinicVerification({
        verificationId: open.id,
        submittedAt: open.submittedAt,
        actorUserId: staff,
        decision: { decision: "approve", checklist: CHECKS },
      })
      // A new filing is a new row; the approved one keeps its state.
      const next = await file("Fourth Name, Lda", "PT515001708")
      expect(next.id).not.toBe(open.id)
      const [kept] = await db()
        .select({ status: main.clinicVerifications.status })
        .from(main.clinicVerifications)
        .where(eq(main.clinicVerifications.id, open.id))
      expect(kept?.status).toBe("approved")
    })
  }
)
