/**
 * Phase 10.2c CRM API evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_CRM_SMOKE=1; loopback + approved test DB only.
 * Seeded fisiomota expert: lead + member contact, follow-up lifecycle.
 */
import { neon } from "@neondatabase/serverless"
import { expect, test } from "@playwright/test"
import { apiUrl, authHeaders } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_CRM_SMOKE === "1"

type ContactItem = {
  id: string | null
  source: "member" | "guest" | "lead"
  memberUserId: string | null
  lifecycleStage: string
}

test.describe("Phase 10.2c — CRM API loopback", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_CRM_SMOKE=1 to run the CRM smoke")
  test.skip(isNonLoopbackE2eTarget(), "CRM smoke must stay on loopback only")
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let cookie = ""
  const created: string[] = []

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    cookie = await expertSession(request)
  })

  test.afterAll(async () => {
    if (created.length === 0) return
    const sql = neon(process.env.DATABASE_URL!)
    await sql`DELETE FROM crm_contacts WHERE id = ANY(${created}::uuid[])`
  })

  test("rejects unauthenticated callers", async ({ request }) => {
    const res = await request.get(`${apiUrl}/crm/contacts`, {
      headers: authHeaders(),
    })
    expect(res.status()).toBe(401)
  })

  test("lead: create, change stage, follow-up done once", async ({
    request,
  }) => {
    const headers = authHeaders(cookie)
    const lead = await request.post(`${apiUrl}/crm/contacts`, {
      headers,
      data: {
        name: "CRM Smoke Lead",
        email: "crm-smoke-lead@example.test",
        phone: "+351 900 000 000",
      },
    })
    expect(lead.status()).toBe(201)
    const contact = (await lead.json()) as { id: string; email: string }
    created.push(contact.id)
    expect(contact.email).toBe("crm-smoke-lead@example.test")

    const staged = await request.patch(`${apiUrl}/crm/contacts/${contact.id}`, {
      headers,
      data: { lifecycleStage: "active", tags: ["smoke"] },
    })
    expect(staged.status()).toBe(200)
    expect(((await staged.json()) as ContactItem).lifecycleStage).toBe("active")

    const due = new Date(Date.now() + 86_400_000).toISOString()
    const followUp = await request.post(`${apiUrl}/crm/follow-ups`, {
      headers,
      data: { contactId: contact.id, dueAt: due, kind: "call", note: "Ring" },
    })
    expect(followUp.status()).toBe(201)
    const { id: followUpId } = (await followUp.json()) as { id: string }

    const open = await request.get(`${apiUrl}/crm/follow-ups`, { headers })
    expect(open.status()).toBe(200)
    const openIds = (
      (await open.json()) as { followUps: { id: string }[] }
    ).followUps.map((f) => f.id)
    expect(openIds).toContain(followUpId)

    const withBody = await request.post(
      `${apiUrl}/crm/follow-ups/${followUpId}/done`,
      { headers, data: { force: true } }
    )
    expect(withBody.status()).toBe(422)

    for (let i = 0; i < 2; i++) {
      const done = await request.post(
        `${apiUrl}/crm/follow-ups/${followUpId}/done`,
        { headers }
      )
      expect(done.status()).toBe(200)
      expect(
        ((await done.json()) as { doneAt: string | null }).doneAt
      ).toBeTruthy()
    }

    const after = await request.get(`${apiUrl}/crm/follow-ups`, { headers })
    const afterIds = (
      (await after.json()) as { followUps: { id: string }[] }
    ).followUps.map((f) => f.id)
    expect(afterIds).not.toContain(followUpId)
  })

  test("member: upsert row, identity edits refused", async ({ request }) => {
    const headers = authHeaders(cookie)
    const list = await request.get(`${apiUrl}/crm/contacts`, { headers })
    expect(list.status()).toBe(200)
    const member = (
      (await list.json()) as { contacts: ContactItem[] }
    ).contacts.find((c) => c.source === "member" && c.id === null)
    test.skip(!member, "needs a fisiomota member with no CRM row")

    const upsert = await request.post(`${apiUrl}/crm/contacts`, {
      headers,
      data: { memberUserId: member!.memberUserId, lifecycleStage: "dormant" },
    })
    expect(upsert.status()).toBe(201)
    const row = (await upsert.json()) as { id: string; lifecycleStage: string }
    created.push(row.id)
    expect(row.lifecycleStage).toBe("dormant")

    const rename = await request.patch(`${apiUrl}/crm/contacts/${row.id}`, {
      headers,
      data: { name: "Not allowed" },
    })
    expect(rename.status()).toBe(409)

    const stranger = await request.post(`${apiUrl}/crm/contacts`, {
      headers,
      data: { memberUserId: "00000000-0000-4000-8000-000000000000" },
    })
    expect(stranger.status()).toBe(404)
  })
})
