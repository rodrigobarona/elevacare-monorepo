/**
 * Phase 11.2 team evidence — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_TEAM_API=1; loopback + approved test DB only. Needs the
 * team app on :3004 (E2E_TEAM_URL) next to the API and the account app.
 * The seeded expert creates a clinic, then on the Team page invites the
 * demo member, sends the invitation again and withdraws it; the member
 * joins through a second invitation and is removed. Screenshots go to the
 * design-audit captures when E2E_DESIGN_CAPTURE=1.
 */
import { mkdirSync } from "node:fs"
import { neon } from "@neondatabase/serverless"
import { expect, test, type Browser, type Page } from "@playwright/test"
import { apiUrl, authHeaders } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import { sessionFromMagicLink } from "./helpers/cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_TEAM_API === "1"
const teamUrl = process.env.E2E_TEAM_URL ?? "http://localhost:3004"
const MEMBER_EMAIL = "member.demo@example.test"
const CLINIC_NAME = "Clínica Lumen"
const CAPTURE_DIR = process.env.E2E_DESIGN_CAPTURE
  ? `docs/eleva-v3/design-audit/captures/${process.env.DESIGN_CAPTURE_LABEL ?? "team-members"}/11-team`
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
      return { name: name!, value: rest.join("="), url: teamUrl }
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

test.describe("Phase 11.2 — the clinic's Team page", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_TEAM_API=1 to run the team smoke")
  test.skip(isNonLoopbackE2eTarget(), "Team smoke stays on loopback")
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let expertCookie = ""
  let teamId = ""
  let teamSlug = ""

  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    const team = await request.get(teamUrl).catch(() => null)
    test.skip(!team, "needs the team app on :3004")
    expertCookie = await expertSession(request)
    const created = await request.post(`${apiUrl}/organizations`, {
      headers: authHeaders(expertCookie),
      data: { name: CLINIC_NAME, type: "team" },
    })
    expect(created.status(), await created.text()).toBe(201)
    const body = (await created.json()) as { orgId: string; slug: string }
    teamId = body.orgId
    teamSlug = body.slug
  })

  test.afterAll(async () => {
    if (!teamId) return
    const sql = neon(process.env.DATABASE_URL!)
    await sql`DELETE FROM auth.organization WHERE id = ${teamId}::uuid`
  })

  test("invite, send again, withdraw; a member joins and is removed", async ({
    browser,
    request,
  }) => {
    test.setTimeout(240_000)
    const membersUrl = `${teamUrl}/team/${teamSlug}/members`
    const sql = neon(process.env.DATABASE_URL!)

    const page = await pageWithSession(browser, expertCookie)
    await page.goto(membersUrl)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team", {
      timeout: 60_000,
    })
    // The owner is listed, marked as you, and cannot be removed.
    const people = page.getByTestId("team-people")
    await expect(people).toContainText("Owner")
    await expect(people).toContainText("(you)")
    await expect(people.getByRole("button", { name: /remove/i })).toHaveCount(0)
    await shot(page, "06-team-owner-only.desktop")

    // An address that is not an email is refused in the dialog.
    await page.getByTestId("team-invite-open").click()
    await expect(
      page.getByRole("heading", { name: `Invite someone to ${CLINIC_NAME}` })
    ).toBeVisible()
    await page.getByTestId("team-invite-email").fill("not-an-email")
    await page.getByTestId("team-invite-send").click()
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Enter a valid email address." })
    ).toBeVisible()
    await page.getByTestId("team-invite-email").fill(MEMBER_EMAIL)
    await shot(page, "07-team-invite-dialog.desktop")
    await page.getByTestId("team-invite-send").click()

    const invited = page.getByTestId("team-invitations")
    await expect(invited).toContainText(MEMBER_EMAIL, { timeout: 30_000 })
    await expect(invited).toContainText("valid until")
    await expect(
      page.getByRole("heading", { name: "1 invitation waiting" })
    ).toBeVisible()
    await shot(page, "08-team-invited.desktop")

    const [first] = (await sql`
      SELECT id, expires_at FROM auth.invitation
      WHERE organization_id = ${teamId}::uuid AND status = 'pending'
    `) as { id: string; expires_at: string }[]
    expect(first).toBeTruthy()
    const days =
      (new Date(first!.expires_at).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThanOrEqual(7)

    // Sending again renews the same invitation instead of adding one.
    await page
      .getByRole("button", {
        name: `Send the invitation to ${MEMBER_EMAIL} again`,
      })
      .click()
    await expect(
      page.getByText(`Invitation sent again to ${MEMBER_EMAIL}.`)
    ).toBeVisible({ timeout: 30_000 })
    const pending = (await sql`
      SELECT id FROM auth.invitation
      WHERE organization_id = ${teamId}::uuid AND status = 'pending'
    `) as { id: string }[]
    expect(pending.map((row) => row.id)).toEqual([first!.id])

    // Withdrawn: the row goes and the link stops working.
    await page
      .getByRole("button", {
        name: `Withdraw the invitation to ${MEMBER_EMAIL}`,
      })
      .click()
    await expect(page.getByText(MEMBER_EMAIL)).toHaveCount(0, {
      timeout: 30_000,
    })

    // A second invitation, accepted by the member.
    const again = await request.post(`${apiUrl}/teams/${teamId}/invitations`, {
      headers: { ...authHeaders(expertCookie), "x-eleva-org": teamSlug },
      data: { email: MEMBER_EMAIL, role: "member" },
    })
    expect(again.status(), await again.text()).toBe(201)
    const secondId = ((await again.json()) as { invitation: { id: string } })
      .invitation.id
    expect(secondId).not.toBe(first!.id)
    const memberCookie = await sessionFromMagicLink(request, MEMBER_EMAIL)
    const accepted = await request.post(
      `${apiUrl}/auth/organization/accept-invitation`,
      {
        headers: authHeaders(memberCookie),
        data: { invitationId: secondId },
      }
    )
    expect(accepted.status(), await accepted.text()).toBe(200)

    await page.reload()
    await expect(page.getByRole("heading", { name: "2 people" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(people).toContainText("No published service yet")
    await shot(page, "09-team-two-people.desktop")

    const phone = await pageWithSession(browser, expertCookie, true)
    await phone.goto(membersUrl)
    await expect(phone.getByRole("heading", { name: "2 people" })).toBeVisible({
      timeout: 60_000,
    })
    await shot(phone, "09-team-two-people.mobile")
    await phone.context().close()

    // Removed: she loses the clinic, and the list says so.
    await page
      .getByRole("button", { name: /^Remove .* from the team$/ })
      .click()
    await expect(
      page.getByRole("heading", { name: new RegExp(`from ${CLINIC_NAME}\\?$`) })
    ).toBeVisible()
    await shot(page, "10-team-remove-dialog.desktop")
    await page.getByTestId("team-member-remove-confirm").click()
    await expect(page.getByRole("heading", { name: "1 person" })).toBeVisible({
      timeout: 30_000,
    })
    await page.context().close()

    const members = (await sql`
      SELECT role FROM auth.member WHERE organization_id = ${teamId}::uuid
    `) as { role: string }[]
    expect(members.map((m) => m.role)).toEqual(["owner"])

    // Every step left its audit row.
    const audit = (await sql`
      SELECT action, count(*)::int AS n FROM audit_outbox
      WHERE org_id = ${teamId}::uuid
        AND action IN ('invitation.invited', 'invitation.revoked', 'membership.removed')
      GROUP BY action ORDER BY action
    `) as { action: string; n: number }[]
    expect(audit).toEqual([
      { action: "invitation.invited", n: 3 },
      { action: "invitation.revoked", n: 1 },
      { action: "membership.removed", n: 1 },
    ])
  })
})
