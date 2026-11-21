import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import { withOrgContext, withPlatformAdminContext } from "../context"
import { organization, user } from "../schema/auth/index"
import { clinicVerifications } from "../schema/main/index"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

/**
 * Clinic verification filings under row-level security: a clinic files and
 * refiles its own, never decides it, and never sees another clinic's; staff
 * (platform_admin) decide.
 */
describe.skipIf(!enabled || !databaseUrl)(
  "rls-clinic-verifications",
  { timeout: 60_000 },
  () => {
    const clinicA = randomUUID()
    const clinicB = randomUUID()
    const staff = randomUUID()
    const filing = randomUUID()

    const status = async () => {
      const [row] = await withPlatformAdminContext((tx) =>
        tx
          .select({
            status: clinicVerifications.status,
            reviewerUserId: clinicVerifications.reviewerUserId,
            reviewedAt: clinicVerifications.reviewedAt,
          })
          .from(clinicVerifications)
          .where(eq(clinicVerifications.id, filing))
      )
      return row
    }

    beforeAll(async () => {
      const pool = new Pool({ connectionString: databaseUrl })
      const client = await pool.connect()
      try {
        await provisionRlsTestRole(client)
      } finally {
        client.release()
        await pool.end()
      }
      await db()
        .insert(user)
        .values({
          id: staff,
          name: "RLS clinic staff",
          email: `rls-clinic-${staff}@example.test`,
        })
      await db()
        .insert(organization)
        .values(
          [clinicA, clinicB].map((id) => ({
            id,
            name: `RLS clinic ${id.slice(0, 6)}`,
            slug: `rls-clinic-${id}`,
            type: "team",
          }))
        )
    })

    afterAll(async () => {
      // An approved filing keeps its reviewer (RESTRICT): filings go first.
      await db()
        .delete(clinicVerifications)
        .where(inArray(clinicVerifications.orgId, [clinicA, clinicB]))
      await db()
        .delete(organization)
        .where(inArray(organization.id, [clinicA, clinicB]))
      await db().delete(user).where(eq(user.id, staff))
    })

    it("lets a clinic file its own identity, and only its own", async () => {
      await withOrgContext(clinicA, (tx) =>
        tx.insert(clinicVerifications).values({
          id: filing,
          orgId: clinicA,
          legalName: "RLS Clinic, Lda",
          taxId: "PT515001708",
        })
      )
      await expect(
        withOrgContext(clinicB, (tx) =>
          tx.insert(clinicVerifications).values({
            orgId: clinicA,
            legalName: "Someone else, Lda",
            taxId: "PT509442013",
          })
        )
      ).rejects.toThrow()
      const seenByB = await withOrgContext(clinicB, (tx) =>
        tx
          .select({ id: clinicVerifications.id })
          .from(clinicVerifications)
          .where(eq(clinicVerifications.id, filing))
      )
      expect(seenByB).toHaveLength(0)
    })

    it("never lets a clinic decide its own filing", async () => {
      // The update either changes no row or is refused: it never approves.
      await withOrgContext(clinicA, (tx) =>
        tx
          .update(clinicVerifications)
          .set({
            status: "approved",
            reviewerUserId: staff,
            reviewedAt: new Date(),
            checklist: { legal_entity_checked: true, tax_id_checked: true },
          })
          .where(eq(clinicVerifications.id, filing))
      ).catch(() => undefined)
      expect((await status())?.status).toBe("pending")
    })

    it("lets staff send it back, and the clinic refile it as undecided", async () => {
      await withPlatformAdminContext((tx) =>
        tx
          .update(clinicVerifications)
          .set({
            status: "needs_changes",
            reason: "The legal name does not match the register.",
            reviewerUserId: staff,
            reviewedAt: new Date(),
          })
          .where(eq(clinicVerifications.id, filing))
      )
      // A refile that keeps the staff stamp is not a pending filing.
      await expect(
        withOrgContext(clinicA, (tx) =>
          tx
            .update(clinicVerifications)
            .set({ status: "pending", reason: null })
            .where(eq(clinicVerifications.id, filing))
        )
      ).rejects.toThrow()
      await withOrgContext(clinicA, (tx) =>
        tx
          .update(clinicVerifications)
          .set({
            status: "pending",
            legalName: "RLS Clinic Unipessoal, Lda",
            reason: null,
            reviewerUserId: null,
            reviewedAt: null,
            checklist: {},
          })
          .where(eq(clinicVerifications.id, filing))
      )
      expect(await status()).toEqual({
        status: "pending",
        reviewerUserId: null,
        reviewedAt: null,
      })
    })

    it("lets staff approve with both checks", async () => {
      await withPlatformAdminContext((tx) =>
        tx
          .update(clinicVerifications)
          .set({
            status: "approved",
            reviewerUserId: staff,
            reviewedAt: new Date(),
            checklist: { legal_entity_checked: true, tax_id_checked: true },
          })
          .where(eq(clinicVerifications.id, filing))
      )
      expect((await status())?.status).toBe("approved")
      // A decided filing is out of the clinic's reach.
      await withOrgContext(clinicA, (tx) =>
        tx
          .update(clinicVerifications)
          .set({ legalName: "Changed after approval, Lda" })
          .where(eq(clinicVerifications.id, filing))
      ).catch(() => undefined)
      const [row] = await withPlatformAdminContext((tx) =>
        tx
          .select({ legalName: clinicVerifications.legalName })
          .from(clinicVerifications)
          .where(eq(clinicVerifications.id, filing))
      )
      expect(row?.legalName).toBe("RLS Clinic Unipessoal, Lda")
    })
  }
)
