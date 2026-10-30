import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Pool } from "@neondatabase/serverless"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "../client"
import { withOrgContext, withPlatformAdminContext } from "../context"
import { organization, user } from "../schema/auth/index"
import { becomePartnerApplications, expertProfiles } from "../schema/main/index"
import { provisionRlsTestRole } from "./rls-test-role"

const enabled = process.env.ELEVA_RLS_INTEGRATION === "1"
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED

const LICENCE = {
  professionalBody: "ordem_psicologos",
  licenceNumber: "12345",
  ersRegistrationNumber: "E123456",
}

/** Licence verification queue: tenant isolation + staff (platform_admin) reads. */
describe.skipIf(!enabled || !databaseUrl)(
  "rls-partner-applications",
  { timeout: 60_000 },
  () => {
    const orgA = randomUUID()
    const orgB = randomUUID()
    const expertA = randomUUID()
    const expertB = randomUUID()
    const staff = randomUUID()
    const profileA = randomUUID()
    const profileB = randomUUID()
    const applicationA = randomUUID()

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
        .values(
          [expertA, expertB, staff].map((id) => ({
            id,
            name: `RLS partner ${id.slice(0, 6)}`,
            email: `rls-partner-${id}@example.test`,
          }))
        )
      await db()
        .insert(organization)
        .values([
          {
            id: orgA,
            name: "RLS partner A",
            slug: `rls-partner-a-${orgA}`,
            type: "expert",
          },
          {
            id: orgB,
            name: "RLS partner B",
            slug: `rls-partner-b-${orgB}`,
            type: "expert",
          },
        ])
      await withOrgContext(orgA, async (tx) => {
        await tx.insert(expertProfiles).values({
          id: profileA,
          orgId: orgA,
          userId: expertA,
          username: `rlsp${orgA.slice(0, 8)}`,
          displayName: "RLS Partner A",
          status: "approved",
        })
        await tx.insert(becomePartnerApplications).values({
          id: applicationA,
          orgId: orgA,
          expertProfileId: profileA,
          ...LICENCE,
        })
      })
      await withOrgContext(orgB, (tx) =>
        tx.insert(expertProfiles).values({
          id: profileB,
          orgId: orgB,
          userId: expertB,
          username: `rlsp${orgB.slice(0, 8)}`,
          displayName: "RLS Partner B",
          status: "approved",
        })
      )
    })

    afterAll(async () => {
      await db()
        .delete(organization)
        .where(inArray(organization.id, [orgA, orgB]))
      await db()
        .delete(user)
        .where(inArray(user.id, [expertA, expertB, staff]))
    })

    it("hides another org's application", async () => {
      const own = await withOrgContext(orgA, (tx) =>
        tx
          .select({ id: becomePartnerApplications.id })
          .from(becomePartnerApplications)
      )
      expect(own.map((row) => row.id)).toEqual([applicationA])

      const other = await withOrgContext(orgB, (tx) =>
        tx
          .select({ id: becomePartnerApplications.id })
          .from(becomePartnerApplications)
          .where(eq(becomePartnerApplications.id, applicationA))
      )
      expect(other).toHaveLength(0)
    })

    it("refuses writes into another org", async () => {
      await expect(
        withOrgContext(orgB, (tx) =>
          tx.insert(becomePartnerApplications).values({
            orgId: orgA,
            expertProfileId: profileA,
            ...LICENCE,
          })
        )
      ).rejects.toThrow()

      const updated = await withOrgContext(orgB, (tx) =>
        tx
          .update(becomePartnerApplications)
          .set({ reason: "cross-tenant" })
          .where(eq(becomePartnerApplications.id, applicationA))
          .returning({ id: becomePartnerApplications.id })
      )
      expect(updated).toHaveLength(0)
    })

    it("refuses a profile from another org", async () => {
      await expect(
        withOrgContext(orgA, (tx) =>
          tx.insert(becomePartnerApplications).values({
            orgId: orgA,
            expertProfileId: profileB,
            ...LICENCE,
          })
        )
      ).rejects.toThrow()
    })

    it("allows one open application per profile", async () => {
      await expect(
        withOrgContext(orgA, (tx) =>
          tx.insert(becomePartnerApplications).values({
            orgId: orgA,
            expertProfileId: profileA,
            ...LICENCE,
          })
        )
      ).rejects.toThrow()
    })

    it("lets staff read the queue across orgs", async () => {
      const rows = await withPlatformAdminContext((tx) =>
        tx
          .select({ id: becomePartnerApplications.id })
          .from(becomePartnerApplications)
          .where(eq(becomePartnerApplications.id, applicationA))
      )
      expect(rows).toHaveLength(1)
    })

    it("never lets the expert org decide its own application", async () => {
      const decided = await withOrgContext(orgA, (tx) =>
        tx
          .update(becomePartnerApplications)
          .set({ status: "rejected", reason: "self-decided" })
          .where(eq(becomePartnerApplications.id, applicationA))
          .returning({ id: becomePartnerApplications.id })
      ).catch(() => "refused" as const)
      expect(decided).toBe("refused")

      const resubmitted = await withOrgContext(orgA, (tx) =>
        tx
          .update(becomePartnerApplications)
          .set({ licenceNumber: "12346", status: "pending" })
          .where(eq(becomePartnerApplications.id, applicationA))
          .returning({ id: becomePartnerApplications.id })
      )
      expect(resubmitted).toHaveLength(1)
    })

    it("freezes decided applications for the expert org", async () => {
      const decided = randomUUID()
      await withPlatformAdminContext((tx) =>
        tx.insert(becomePartnerApplications).values({
          id: decided,
          orgId: orgB,
          expertProfileId: profileB,
          ...LICENCE,
          status: "rejected",
          reason: "licence not found",
          reviewerUserId: staff,
          reviewedAt: new Date(),
        })
      )

      const reopened = await withOrgContext(orgB, (tx) =>
        tx
          .update(becomePartnerApplications)
          .set({ status: "pending", reviewerUserId: null, reviewedAt: null })
          .where(eq(becomePartnerApplications.id, decided))
          .returning({ id: becomePartnerApplications.id })
      )
      expect(reopened).toHaveLength(0)

      const deleted = await withOrgContext(orgB, (tx) =>
        tx
          .delete(becomePartnerApplications)
          .where(eq(becomePartnerApplications.id, decided))
          .returning({ id: becomePartnerApplications.id })
      )
      expect(deleted).toHaveLength(0)

      await withPlatformAdminContext((tx) =>
        tx
          .delete(becomePartnerApplications)
          .where(eq(becomePartnerApplications.id, decided))
      )
    })

    it("refuses an approval without a complete verification", async () => {
      await expect(
        withPlatformAdminContext((tx) =>
          tx
            .update(becomePartnerApplications)
            .set({
              status: "approved",
              reviewerUserId: staff,
              reviewedAt: new Date(),
              checklist: { register_checked: true },
            })
            .where(eq(becomePartnerApplications.id, applicationA))
        )
      ).rejects.toThrow()

      const approved = await withPlatformAdminContext((tx) =>
        tx
          .update(becomePartnerApplications)
          .set({
            status: "approved",
            reviewerUserId: staff,
            reviewedAt: new Date(),
            checklist: {
              register_checked: true,
              name_matches: true,
              ers_checked: true,
            },
          })
          .where(eq(becomePartnerApplications.id, applicationA))
          .returning({ status: becomePartnerApplications.status })
      )
      expect(approved).toEqual([{ status: "approved" }])
    })

    it("refuses needs_changes without a reason", async () => {
      await expect(
        withPlatformAdminContext((tx) =>
          tx.insert(becomePartnerApplications).values({
            orgId: orgB,
            expertProfileId: profileB,
            ...LICENCE,
            status: "needs_changes",
          })
        )
      ).rejects.toThrow()
    })
  }
)
