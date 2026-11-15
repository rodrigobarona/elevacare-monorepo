/**
 * Phase 11.1c invitation evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_TEAM_API=1; loopback + approved test DB only.
 * The seeded expert creates a clinic and invites the demo member; the
 * member opens /accept-invitation and joins. Wrong-account and unavailable
 * states are checked too. Screenshots go to the design-audit captures
 * when E2E_DESIGN_CAPTURE=1.
 */
import { mkdirSync } from "node:fs"
import { neon } from "@neondatabase/serverless"
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test"
import { accountUrl, apiUrl, authHeaders } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import { sessionFromMagicLink } from "./helpers/cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_TEAM_API === "1"
const MEMBER_EMAIL = "member.demo@example.test"
const CAPTURE_DIR = process.env.E2E_DESIGN_CAPTURE
  ? `docs/eleva-v3/design-audit/captures/${process.env.DESIGN_CAPTURE_LABEL ?? "team-invitation"}/11-team`
  : null

async function pageWithSession(
  browser: Browser,
  cookie: string,
  mobile = false
): Promise<Page> {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
    isMobile: mobile,
    locale: "en-GB",
    reducedMotion: "reduce",
  })
  // Local cookies are host-only on localhost, shared across ports.
  await context.addCookies(
    cookie.split("; ").map((pair) => {
      const [name, ...rest] = pair.split("=")
      return { name: name!, value: rest.join("="), url: accountUrl }
    })
  )
  return context.newPage()
}

async function shot(page: Page, name: string): Promise<void> {
  if (!CAPTURE_DIR) return
  mkdirSync(CAPTURE_DIR, { recursive: true })
  const reject = page.getByRole("button", { name: /reject optional/i })
  if (await reject.isVisible().catch(() => false)) await reject.click()
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
  await page.screenshot({ path: `${CAPTURE_DIR}/${name}.jpg`, quality: 85 })
}

async function invite(
  request: APIRequestContext,
  cookie: string,
  organizationId: string
): Promise<string> {
  const res = await request.post(`${apiUrl}/auth/organization/invite-member`, {
    headers: authHeaders(cookie),
    data: { email: MEMBER_EMAIL, role: "member", organizationId },
  })
  expect(res.status(), await res.text()).toBe(200)
  const body = (await res.json()) as {
    id?: string
    invitation?: { id: string }
  }
  const id = body.id ?? body.invitation?.id
  expect(id).toBeTruthy()
  return id!
}

test.describe("Phase 11.1c — accept a clinic invitation", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_TEAM_API=1 to run the invitation smoke")
  test.skip(isNonLoopbackE2eTarget(), "Invitation smoke stays on loopback")
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let expertCookie = ""
  let teamId = ""

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    expertCookie = await expertSession(request)
    const created = await request.post(`${apiUrl}/organizations`, {
      headers: authHeaders(expertCookie),
      data: { name: "Clínica Lumen", type: "team" },
    })
    expect(created.status(), await created.text()).toBe(201)
    teamId = ((await created.json()) as { orgId: string }).orgId
  })

  test.afterAll(async () => {
    if (!teamId) return
    const sql = neon(process.env.DATABASE_URL!)
    await sql`DELETE FROM auth.organization WHERE id = ${teamId}::uuid`
  })

  test("the invited member joins; other accounts and stale links are told why", async ({
    browser,
    request,
  }) => {
    const invitationId = await invite(request, expertCookie, teamId)
    const memberCookie = await sessionFromMagicLink(request, MEMBER_EMAIL)
    const link = `${accountUrl}/accept-invitation?id=${invitationId}`

    for (const mobile of [false, true]) {
      // Wrong account: the expert opens the member's invitation.
      const wrong = await pageWithSession(browser, expertCookie, mobile)
      await wrong.goto(link)
      await expect(wrong.getByTestId("invitation-heading")).toHaveAttribute(
        "data-state",
        "wrong-account",
        { timeout: 30_000 }
      )
      // Nothing about the invitation leaks to another account.
      await expect(wrong.getByTestId("invitation")).not.toContainText(
        "Clínica Lumen"
      )
      await expect(wrong.getByTestId("invitation")).not.toContainText(
        MEMBER_EMAIL
      )
      await shot(wrong, `03-wrong-account.${mobile ? "mobile" : "desktop"}`)
      await wrong.context().close()

      // Unavailable: a link that no longer exists.
      const stale = await pageWithSession(browser, memberCookie, mobile)
      await stale.goto(
        `${accountUrl}/accept-invitation?id=00000000-0000-4000-8000-000000000000`
      )
      await expect(stale.getByTestId("invitation-heading")).toHaveAttribute(
        "data-state",
        "unavailable",
        { timeout: 30_000 }
      )
      await shot(stale, `04-unavailable.${mobile ? "mobile" : "desktop"}`)
      await stale.context().close()
    }

    // Phone: the invitation shown, then declined (just as clear as joining).
    const phone = await pageWithSession(browser, memberCookie, true)
    await phone.goto(link)
    await expect(phone.getByTestId("invitation-heading")).toHaveAttribute(
      "data-state",
      "ready",
      { timeout: 30_000 }
    )
    await expect(phone.getByTestId("invitation")).toContainText("Clínica Lumen")
    await shot(phone, "01-invited.mobile")
    await phone.getByTestId("invitation-decline").click()
    await expect(phone.getByTestId("invitation-heading")).toHaveAttribute(
      "data-state",
      "declined"
    )
    await shot(phone, "05-declined.mobile")
    await phone.context().close()

    // Desktop: a fresh invitation, accepted.
    const secondId = await invite(request, expertCookie, teamId)
    const desk = await pageWithSession(browser, memberCookie, false)
    await desk.goto(`${accountUrl}/accept-invitation?id=${secondId}`)
    await expect(desk.getByTestId("invitation-heading")).toHaveAttribute(
      "data-state",
      "ready",
      { timeout: 30_000 }
    )
    await shot(desk, "01-invited.desktop")
    await desk.getByTestId("invitation-accept").click()
    await expect(desk.getByTestId("invitation-heading")).toHaveAttribute(
      "data-state",
      "accepted",
      { timeout: 30_000 }
    )
    await shot(desk, "02-joined.desktop")
    await desk.context().close()

    const sql = neon(process.env.DATABASE_URL!)
    const members = (await sql`
      SELECT m.role FROM auth.member m
      JOIN auth."user" u ON u.id = m.user_id
      WHERE m.organization_id = ${teamId}::uuid AND lower(u.email) = ${MEMBER_EMAIL}
    `) as { role: string }[]
    expect(members.map((m) => m.role)).toEqual(["member"])

    // Both answers are audited (the outbox drains to audit_events).
    const audit = (await sql`
      SELECT action FROM audit_outbox
      WHERE org_id = ${teamId}::uuid
        AND action IN ('membership.created', 'invitation.rejected')
    `) as { action: string }[]
    expect(audit.map((row) => row.action).sort()).toEqual([
      "invitation.rejected",
      "membership.created",
    ])
  })
})
