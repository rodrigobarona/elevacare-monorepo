/**
 * Phase 11.1 clinic API evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_TEAM_API=1; loopback + approved test DB only.
 * The seeded expert creates a team org, switches to it, edits the clinic
 * profile and files its verification. The org is deleted afterwards.
 */
import { neon } from "@neondatabase/serverless"
import { expect, test, type APIResponse } from "@playwright/test"
import { apiUrl, authHeaders, sessionCookie } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_TEAM_API === "1"

/** Merge a response's Set-Cookie pairs into a Cookie header. */
function withCookies(cookie: string, response: APIResponse): string {
  const fresh = sessionCookie(response)
  if (!fresh) return cookie
  const jar = new Map<string, string>()
  for (const part of `${cookie}; ${fresh}`.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name) jar.set(name, rest.join("="))
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

test.describe("Phase 11.1 — clinic profile and verification API", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_TEAM_API=1 to run the clinic API smoke")
  test.skip(isNonLoopbackE2eTarget(), "Clinic smoke must stay on loopback only")
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let cookie = ""
  let previousOrgId: string | null = null
  let teamId = ""

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    cookie = await expertSession(request)
    const session = await request.get(
      `${apiUrl}/auth/get-session?disableCookieCache=true`,
      { headers: authHeaders(cookie) }
    )
    previousOrgId =
      (
        (await session.json()) as {
          session?: { activeOrganizationId?: string }
        }
      ).session?.activeOrganizationId ?? null
  })

  test.afterAll(async ({ request }) => {
    if (previousOrgId) {
      await request.post(`${apiUrl}/auth/organization/set-active`, {
        headers: authHeaders(cookie),
        data: { organizationId: previousOrgId },
      })
    }
    if (!teamId) return
    const sql = neon(process.env.DATABASE_URL!)
    await sql`DELETE FROM auth.organization WHERE id = ${teamId}::uuid`
  })

  test("a new team org gets a clinic profile; the admin edits and files it", async ({
    request,
  }) => {
    const created = await request.post(`${apiUrl}/organizations`, {
      headers: authHeaders(cookie),
      data: { name: `E2E Clinic ${Date.now()}`, type: "team" },
    })
    expect(created.status(), await created.text()).toBe(201)
    teamId = ((await created.json()) as { orgId: string }).orgId

    const switched = await request.post(
      `${apiUrl}/auth/organization/set-active`,
      {
        headers: authHeaders(cookie),
        data: { organizationId: teamId },
      }
    )
    expect(switched.status()).toBe(200)
    cookie = withCookies(cookie, switched)
    const headers = authHeaders(cookie)

    const team = await request.get(`${apiUrl}/teams/${teamId}`, { headers })
    expect(team.status(), await team.text()).toBe(200)
    const summary = (await team.json()) as {
      profile: { slug: string; payoutMode: string }
      verification: unknown
      verified: boolean
    }
    expect(summary.profile.slug).toMatch(/^[a-z0-9-]{3,30}$/)
    expect(summary.profile.payoutMode).toBe("expert")
    expect(summary.verification).toBeNull()
    expect(summary.verified).toBe(false)

    const edited = await request.patch(`${apiUrl}/teams/${teamId}`, {
      headers,
      data: {
        description: "Pelvic health and pregnancy care in Lisbon.",
        specialties: ["pelvic-health"],
        billingAddress: { city: "Lisboa", country: "PT" },
      },
    })
    expect(edited.status(), await edited.text()).toBe(200)
    expect(
      ((await edited.json()) as { profile: { specialties: string[] } }).profile
        .specialties
    ).toEqual(["pelvic-health"])

    // The legal identity is never a profile field.
    const identityOnProfile = await request.patch(`${apiUrl}/teams/${teamId}`, {
      headers,
      data: { legalName: "Sneaky Lda" },
    })
    expect(identityOnProfile.status()).toBe(422)

    const filed = await request.post(`${apiUrl}/teams/${teamId}/verification`, {
      headers,
      data: { legalName: "Clínica Exemplo, Lda", taxId: "PT 515 001 708" },
    })
    expect(filed.status(), await filed.text()).toBe(201)
    const first = (await filed.json()) as {
      verification: { id: string; status: string; taxId: string }
      verified: boolean
    }
    expect(first.verification.status).toBe("pending")
    expect(first.verification.taxId).toBe("PT515001708")
    expect(first.verified).toBe(false)

    const refiled = await request.post(
      `${apiUrl}/teams/${teamId}/verification`,
      {
        headers,
        data: { legalName: "Clínica Exemplo, Lda", taxId: "PT515001709" },
      }
    )
    expect(refiled.status()).toBe(201)
    const second = (await refiled.json()) as {
      verification: { id: string; taxId: string }
    }
    expect(second.verification.id).toBe(first.verification.id)
    expect(second.verification.taxId).toBe("PT515001709")

    const badTaxId = await request.post(
      `${apiUrl}/teams/${teamId}/verification`,
      { headers, data: { legalName: "Clínica Exemplo, Lda", taxId: "PT-12" } }
    )
    expect(badTaxId.status()).toBe(422)

    const otherTeam = await request.get(
      `${apiUrl}/teams/00000000-0000-4000-8000-000000000000`,
      { headers }
    )
    expect(otherTeam.status()).toBe(403)
  })
})
