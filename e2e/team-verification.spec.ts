/**
 * Phase 11.4 clinic verification page — not part of default `e2e-smoke` CI.
 * Opt-in via E2E_TEAM_API=1; loopback + approved test DB only. Needs the
 * team app on :3004 (E2E_TEAM_URL) next to the API.
 * The seeded expert creates a clinic and sends its legal details from the
 * Verification page; staff decisions are written straight to the database
 * (the staff queue has its own spec, admin-clinics), and the page shows
 * each one: a change asked with its reason, then verified. Screenshots go
 * to the design-audit captures when E2E_DESIGN_CAPTURE=1.
 */
import { mkdirSync } from "node:fs"
import { neon } from "@neondatabase/serverless"
import { expect, test, type Browser, type Page } from "@playwright/test"
import { apiUrl, authHeaders } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isLoopbackUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_TEAM_API === "1"
const teamUrl = process.env.E2E_TEAM_URL ?? "http://localhost:3004"
const REVIEWER_EMAIL = "member.demo@example.test"
const REASON =
  "The legal name in the register is Clínica Lumen, Unipessoal Lda."
const CAPTURE_DIR = process.env.E2E_DESIGN_CAPTURE
  ? `docs/eleva-v3/design-audit/captures/${process.env.DESIGN_CAPTURE_LABEL ?? "team-verification"}/11-team`
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
  await page.screenshot({
    path: `${CAPTURE_DIR}/${name}.jpg`,
    quality: 85,
    fullPage: true,
  })
}

test.describe("Phase 11.4 — the clinic's Verification page", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_TEAM_API=1 to run the verification smoke")
  test.skip(
    isNonLoopbackE2eTarget() || !isLoopbackUrl(teamUrl),
    "Verification smoke stays on loopback"
  )
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let cookie = ""
  let teamId = ""
  let teamSlug = ""

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000)
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    const team = await request.get(teamUrl).catch(() => null)
    test.skip(!team, "needs the team app on :3004")
    cookie = await expertSession(request)
    const created = await request.post(`${apiUrl}/organizations`, {
      headers: authHeaders(cookie),
      data: { name: "Clínica Lumen", type: "team" },
    })
    expect(created.status(), await created.text()).toBe(201)
    const body = (await created.json()) as { orgId: string; slug: string }
    teamId = body.orgId
    teamSlug = body.slug
  })

  test.afterAll(async () => {
    if (!teamId) return
    const sql = neon(process.env.DATABASE_URL!)
    // An approved filing keeps its reviewer: filings go before the org.
    await sql`DELETE FROM clinic_verifications WHERE org_id = ${teamId}::uuid`
    await sql`DELETE FROM auth.organization WHERE id = ${teamId}::uuid`
  })

  test("send details, correct them when asked, and end verified", async ({
    browser,
  }) => {
    test.setTimeout(240_000)
    const sql = neon(process.env.DATABASE_URL!)
    const url = `${teamUrl}/team/${teamSlug}/verification`
    const page = await pageWithSession(browser, cookie)
    const standing = page.getByTestId("verification-standing")
    const expectStanding = (value: string) =>
      expect(standing).toHaveAttribute("data-standing", value, {
        timeout: 60_000,
      })

    // The Overview points here while verification waits on the clinic, and
    // says nothing once it does not.
    const overviewUrl = `${teamUrl}/team/${teamSlug}`
    const overview = await pageWithSession(browser, cookie)
    const notice = overview.getByTestId("overview-verification")
    await overview.goto(overviewUrl)
    await expect(notice).toHaveAttribute("data-standing", "not-sent", {
      timeout: 90_000,
    })
    await expect(notice).toContainText("Send your clinic's legal details")
    await shot(overview, "19-overview-verification-not-sent.desktop")
    await notice.getByRole("link", { name: "Go to Verification" }).click()
    await expect(overview).toHaveURL(url, { timeout: 60_000 })

    await page.goto(url)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Verification",
      { timeout: 90_000 }
    )
    await expectStanding("not-sent")
    await shot(page, "13-verification-not-sent.desktop")

    // A number that cannot be a NIF is refused next to the field.
    await page.getByTestId("verification-legal-name").fill("Clínica Lumen, Lda")
    await page.getByTestId("verification-tax-id").fill("PT 12")
    await page.getByTestId("verification-send").click()
    await expect(page.getByTestId("verification-tax-id-error")).toContainText(
      "Enter a valid NIF or VAT number"
    )
    await shot(page, "13-verification-invalid-number.desktop")

    // Spaces and dots are fine; the number is stored without them.
    await page.getByTestId("verification-tax-id").fill("PT 123.456.789")
    await page.getByTestId("verification-send").click()
    await expectStanding("checking")
    await expect(standing).toContainText("We are checking your details")
    await expect(standing).toContainText("PT123456789")
    // Focus lands on the new standing, not at the top of the page.
    await expect(page.locator("#verification-standing-title")).toBeFocused()
    // The same details cannot be sent again: that would only move the
    // clinic to the back of the queue.
    await expect(page.getByTestId("verification-send")).toBeDisabled()
    await expect(page.getByTestId("verification-unchanged")).toBeVisible()
    await shot(page, "14-verification-checking.desktop")
    // Eleva is checking: nothing for the clinic to do, nothing on Overview.
    await overview.goto(overviewUrl)
    await expect(
      overview.getByRole("heading", { level: 1, name: "Your clinic" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(notice).toHaveCount(0)

    // Staff ask for a change (their queue is covered by admin-clinics).
    const [reviewer] = (await sql`
      SELECT id FROM auth."user" WHERE lower(email) = ${REVIEWER_EMAIL}
    `) as { id: string }[]
    expect(reviewer).toBeTruthy()
    await sql`
      UPDATE clinic_verifications
      SET status = 'needs_changes', reason = ${REASON},
          reviewer_user_id = ${reviewer!.id}::uuid, reviewed_at = now()
      WHERE org_id = ${teamId}::uuid
    `
    await page.reload()
    await expectStanding("change-needed")
    await expect(page.getByTestId("verification-reason")).toHaveText(REASON)
    // The form holds what was sent, ready to correct.
    await expect(page.getByTestId("verification-legal-name")).toHaveValue(
      "Clínica Lumen, Lda"
    )
    await shot(page, "15-verification-change-needed.desktop")
    await overview.goto(overviewUrl)
    await expect(notice).toHaveAttribute("data-standing", "change-needed", {
      timeout: 60_000,
    })
    await expect(notice).toContainText("Your clinic's details need a change")
    await shot(overview, "19-overview-verification-change-needed.desktop")
    await overview.context().close()
    // On a phone the icon stays beside the text and the button goes under.
    const overviewPhone = await pageWithSession(browser, cookie, true)
    await overviewPhone.setViewportSize({ width: 360, height: 780 })
    await overviewPhone.goto(overviewUrl)
    await expect(
      overviewPhone.getByTestId("overview-verification")
    ).toHaveAttribute("data-standing", "change-needed", { timeout: 60_000 })
    await shot(overviewPhone, "19-overview-verification-change-needed.mobile")
    await overviewPhone.context().close()

    const phone = await pageWithSession(browser, cookie, true)
    await phone.goto(url)
    await expect(phone.getByTestId("verification-reason")).toHaveText(REASON, {
      timeout: 60_000,
    })
    await shot(phone, "15-verification-change-needed.mobile")
    await phone.context().close()

    // Staff asked for a change: the details can be sent again as they are
    // (what was asked may be elsewhere), or corrected first.
    await expect(page.getByTestId("verification-send")).toBeEnabled()
    await page
      .getByTestId("verification-legal-name")
      .fill("Clínica Lumen, Unipessoal Lda")
    await expect(page.getByTestId("verification-send")).toHaveText(
      "Send the correction"
    )
    await page.getByTestId("verification-send").click()
    await expectStanding("checking")
    await expect(page.getByTestId("verification-reason")).toHaveCount(0)
    const [refiled] = (await sql`
      SELECT status, legal_name, reviewer_user_id, reason
      FROM clinic_verifications WHERE org_id = ${teamId}::uuid
    `) as {
      status: string
      legal_name: string
      reviewer_user_id: string | null
      reason: string | null
    }[]
    expect(refiled).toEqual({
      status: "pending",
      legal_name: "Clínica Lumen, Unipessoal Lda",
      reviewer_user_id: null,
      reason: null,
    })

    // Staff approve: the page says verified, with the checked details.
    await sql`
      UPDATE clinic_verifications
      SET status = 'approved', reviewer_user_id = ${reviewer!.id}::uuid,
          reviewed_at = now(),
          checklist = '{"legal_entity_checked": true, "tax_id_checked": true}'::jsonb
      WHERE org_id = ${teamId}::uuid
    `
    await page.reload()
    await expectStanding("verified")
    await expect(standing).toContainText("Your clinic is verified")
    await expect(standing).toContainText("The details we checked")
    await expect(standing).toContainText("Clínica Lumen, Unipessoal Lda")
    // Nothing to correct: empty fields for a new legal identity.
    await expect(page.getByTestId("verification-legal-name")).toHaveValue("")
    await expect(page.getByTestId("verification-send")).toHaveText(
      "Send new details"
    )
    await shot(page, "16-verification-verified.desktop")

    // New details for a verified clinic, then refused: the page says the
    // clinic stays verified and which details are the new ones.
    await page.getByTestId("verification-legal-name").fill("Lumen Saúde, Lda")
    await page.getByTestId("verification-tax-id").fill("PT987654321")
    await page.getByTestId("verification-send").click()
    await expectStanding("verified-checking")
    await expect(standing).toContainText("The new details you sent")
    await shot(page, "17-verification-verified-checking.desktop")
    await sql`
      UPDATE clinic_verifications
      SET status = 'rejected', reason = ${REASON},
          reviewer_user_id = ${reviewer!.id}::uuid, reviewed_at = now()
      WHERE org_id = ${teamId}::uuid AND status = 'pending'
    `
    await page.reload()
    await expectStanding("verified-new-rejected")
    await expect(standing).toContainText("Your clinic is verified")
    await expect(page.getByTestId("verification-reason")).toHaveText(REASON)
    // What was refused is there to correct.
    await expect(page.getByTestId("verification-legal-name")).toHaveValue(
      "Lumen Saúde, Lda"
    )
    await expect(page.getByTestId("verification-send")).toBeEnabled()
    await expect(
      page.getByRole("heading", {
        name: "Want to send your new details again?",
      })
    ).toBeVisible()
    await shot(page, "18-verification-verified-new-rejected.desktop")
    await page.context().close()
  })
})
