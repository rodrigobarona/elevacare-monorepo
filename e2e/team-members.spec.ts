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
import { apiUrl, authHeaders, ORG_HEADER } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import { sessionFromMagicLink } from "./helpers/cancellation-policy-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isLoopbackUrl,
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
  // Never capture the loading skeleton: the page streams in under it.
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible" })
  const reject = page.getByRole("button", { name: /reject optional/i })
  if (await reject.isVisible().catch(() => false)) await reject.click()
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
  await page.screenshot({ path: `${CAPTURE_DIR}/${name}.jpg`, quality: 85 })
}

test.describe("Phase 11.2 — the clinic's Team page", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_TEAM_API=1 to run the team smoke")
  test.skip(
    isNonLoopbackE2eTarget() || !isLoopbackUrl(teamUrl),
    "Team smoke stays on loopback"
  )
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
    await sql`DELETE FROM bookings WHERE org_id = ${teamId}::uuid`
    await sql`DELETE FROM auth.organization WHERE id = ${teamId}::uuid`
  })

  test("invite, send again, withdraw; a member joins and is removed", async ({
    browser,
    request,
  }) => {
    test.setTimeout(300_000)
    const membersUrl = `${teamUrl}/team/${teamSlug}/members`
    const sql = neon(process.env.DATABASE_URL!)
    const pendingInvitations = async () =>
      (await sql`
        SELECT id, expires_at FROM auth.invitation
        WHERE organization_id = ${teamId}::uuid AND status = 'pending'
      `) as { id: string; expires_at: string }[]
    // Pretend the invitation was last sent `minutes` ago (or expired).
    const ageInvitation = async (id: string, minutes: number) =>
      sql`
        UPDATE auth.invitation
        SET expires_at = expires_at - make_interval(mins => ${minutes})
        WHERE id = ${id}::uuid
      `

    const page = await pageWithSession(browser, expertCookie)
    await page.goto(membersUrl)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team", {
      timeout: 60_000,
    })
    // The owner is listed, marked as you, and cannot be removed.
    const people = page.getByTestId("team-people")
    await expect(people).toContainText("Owner")
    await expect(people).toContainText("(you)")
    await expect(people.getByRole("button")).toHaveCount(0)
    await shot(page, "06-team-owner-only.desktop")

    // An address that is not an email is refused in the dialog.
    await page.getByTestId("team-invite-open").click()
    await expect(
      page.getByRole("heading", { name: `Invite someone to ${CLINIC_NAME}` })
    ).toBeVisible()
    await page.getByTestId("team-invite-email").fill("not-an-email")
    await page.getByTestId("team-invite-send").click()
    await expect(page.getByTestId("team-invite-error")).toHaveText(
      "Enter a valid email address."
    )
    await shot(page, "07-team-invite-error.desktop")
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

    const [first] = await pendingInvitations()
    expect(first).toBeTruthy()
    const days =
      (new Date(first!.expires_at).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThanOrEqual(7)

    // The same address is not emailed twice within a minute.
    const resend = page.getByTestId(`team-invitation-resend-${first!.id}`)
    await resend.click()
    await expect(
      page.getByText("You can send this invitation again in a minute.")
    ).toBeVisible({ timeout: 30_000 })

    // Later, sending again renews the same invitation instead of adding one.
    await ageInvitation(first!.id, 2)
    await resend.click()
    await expect(
      page.getByText(`Invitation sent again to ${MEMBER_EMAIL}.`)
    ).toBeVisible({ timeout: 30_000 })
    const renewed = await pendingInvitations()
    expect(renewed.map((row) => row.id)).toEqual([first!.id])
    expect(new Date(renewed[0]!.expires_at).getTime()).toBeGreaterThan(
      new Date(first!.expires_at).getTime() - 60_000
    )

    // An expired invitation says so, and can still be sent again.
    await ageInvitation(first!.id, 8 * 24 * 60)
    await page.reload()
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    })
    await expect(invited).toContainText("expired on", { timeout: 30_000 })
    await expect(invited).toContainText("Expired")
    await shot(page, "08-team-invitation-expired.desktop")

    const phone = await pageWithSession(browser, expertCookie, true)
    await phone.goto(membersUrl)
    await expect(
      phone.getByRole("heading", { name: "1 invitation waiting" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(phone.getByTestId("team-invitations")).toContainText(
      MEMBER_EMAIL
    )
    await shot(phone, "08-team-invitation-expired.mobile")
    await phone.getByTestId("team-invite-open").click()
    await expect(phone.getByTestId("team-invite-email")).toBeVisible()
    await shot(phone, "07-team-invite-dialog.mobile")
    await phone.context().close()

    // Withdrawn: the row goes and the link stops working.
    await page.getByTestId(`team-invitation-withdraw-${first!.id}`).click()
    await expect(page.getByText(MEMBER_EMAIL)).toHaveCount(0, {
      timeout: 30_000,
    })

    // Better Auth's own endpoints cannot go around the team rules.
    const refusedByTeamRules = async (path: string, data: object) => {
      const res = await request.post(`${apiUrl}/auth/organization/${path}`, {
        headers: authHeaders(expertCookie),
        data: { ...data, organizationId: teamId },
      })
      const body = (await res.json().catch(() => ({}))) as { code?: string }
      expect(body.code, `${path} answered ${res.status()}`).toBe(
        "TEAM_MEMBERS_API_REQUIRED"
      )
      return res.status()
    }
    expect(
      await refusedByTeamRules("invite-member", {
        email: MEMBER_EMAIL,
        role: "admin",
      })
    ).toBe(403)
    // Renewing skips Better Auth's organization hooks: refused up front.
    expect(
      await refusedByTeamRules("invite-member", {
        email: MEMBER_EMAIL,
        role: "member",
        resend: true,
      })
    ).toBe(400)
    expect(await pendingInvitations()).toEqual([])
    const leave = await request.post(`${apiUrl}/auth/organization/leave`, {
      headers: authHeaders(expertCookie),
      data: { organizationId: teamId },
    })
    expect(leave.status()).toBe(404)

    // A second invitation, accepted by the member.
    const again = await request.post(`${apiUrl}/teams/${teamId}/invitations`, {
      headers: { ...authHeaders(expertCookie), [ORG_HEADER]: teamSlug },
      data: { email: MEMBER_EMAIL, role: "member" },
    })
    expect(again.status(), await again.text()).toBe(201)
    const secondId = ((await again.json()) as { invitation: { id: string } })
      .invitation.id
    expect(secondId).not.toBe(first!.id)
    expect(
      await refusedByTeamRules("cancel-invitation", { invitationId: secondId })
    ).toBe(403)
    expect((await pendingInvitations()).map((row) => row.id)).toEqual([
      secondId,
    ])
    const memberCookie = await sessionFromMagicLink(request, MEMBER_EMAIL)
    const accepted = await request.post(
      `${apiUrl}/auth/organization/accept-invitation`,
      {
        headers: authHeaders(memberCookie),
        data: { invitationId: secondId },
      }
    )
    expect(accepted.status(), await accepted.text()).toBe(200)

    // She works in the clinic: one published service, one session booked.
    const [joined] = (await sql`
      SELECT m.id, m.user_id FROM auth.member m
      JOIN auth."user" u ON u.id = m.user_id
      WHERE m.organization_id = ${teamId}::uuid AND lower(u.email) = ${MEMBER_EMAIL}
    `) as { id: string; user_id: string }[]
    expect(joined).toBeTruthy()
    expect(
      await refusedByTeamRules("remove-member", {
        memberIdOrEmail: joined!.id,
      })
    ).toBe(403)
    expect(
      await refusedByTeamRules("update-member-role", {
        memberId: joined!.id,
        role: "admin",
      })
    ).toBe(403)
    const [stillMember] = (await sql`
      SELECT role FROM auth.member WHERE id = ${joined!.id}::uuid
    `) as { role: string }[]
    expect(stillMember?.role).toBe("member")
    const [profile] = (await sql`
      INSERT INTO expert_profiles (org_id, user_id, username, display_name, status, practice_countries)
      VALUES (${teamId}::uuid, ${joined!.user_id}::uuid, ${`e2e-${teamId.slice(0, 8)}`}, 'Leonor Almeida', 'active', '{}')
      RETURNING id
    `) as { id: string }[]
    const [service] = (await sql`
      INSERT INTO event_types (org_id, expert_profile_id, slug, title, published, languages)
      VALUES (${teamId}::uuid, ${profile!.id}::uuid, 'first-visit', '{"en":"First visit"}'::jsonb, true, '{}')
      RETURNING id
    `) as { id: string }[]
    const [booking] = (await sql`
      INSERT INTO bookings (
        org_id, event_type_id, expert_profile_id, expert_user_id, guest_email,
        price_cents, price_amount, starts_at, ends_at, timezone, status, session_mode
      ) VALUES (
        ${teamId}::uuid, ${service!.id}::uuid, ${profile!.id}::uuid, ${joined!.user_id}::uuid,
        'guest@example.test', 0, 0, now() + interval '1 day',
        now() + interval '1 day 1 hour', 'Europe/Lisbon', 'confirmed', 'online'
      ) RETURNING id
    `) as { id: string }[]

    await page.reload()
    await expect(page.getByRole("heading", { name: "2 people" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(people).toContainText("1 published service")
    await shot(page, "09-team-two-people.desktop")

    const phoneList = await pageWithSession(browser, expertCookie, true)
    await phoneList.goto(membersUrl)
    await expect(
      phoneList.getByRole("heading", { name: "2 people" })
    ).toBeVisible({ timeout: 60_000 })
    await shot(phoneList, "09-team-two-people.mobile")
    await phoneList.context().close()

    // A session still booked keeps her in the clinic, and says why.
    const removeButton = page.getByTestId(`team-member-remove-${joined!.id}`)
    await removeButton.click()
    await expect(
      page.getByRole("heading", { name: new RegExp(`from ${CLINIC_NAME}\\?$`) })
    ).toBeVisible()
    await shot(page, "10-team-remove-dialog.desktop")
    await page.getByTestId("team-member-remove-confirm").click()
    await expect(page.getByTestId("team-member-remove-error")).toContainText(
      "still has 1 session booked in this clinic",
      { timeout: 30_000 }
    )
    await expect(page.getByTestId("team-member-remove-confirm")).toBeDisabled()
    await shot(page, "10-team-remove-blocked.desktop")
    await page.getByRole("button", { name: "Keep in team" }).click()

    // Once the session is done she can be removed, and her service with her.
    await sql`UPDATE bookings SET status = 'completed' WHERE id = ${booking!.id}::uuid`
    await removeButton.click()
    await page.getByTestId("team-member-remove-confirm").click()
    await expect(page.getByRole("heading", { name: "1 person" })).toBeVisible({
      timeout: 30_000,
    })
    await page.context().close()

    const members = (await sql`
      SELECT role FROM auth.member WHERE organization_id = ${teamId}::uuid
    `) as { role: string }[]
    expect(members.map((m) => m.role)).toEqual(["owner"])
    const [unpublished] = (await sql`
      SELECT published FROM event_types WHERE id = ${service!.id}::uuid
    `) as { published: boolean }[]
    expect(unpublished!.published).toBe(false)

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
