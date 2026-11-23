/**
 * Phase 12 clinic verification evidence — not part of default `e2e-smoke`.
 * Opt-in via E2E_ADMIN_CLINICS=1; loopback + approved test DB only. Needs
 * the admin app on :3007 (E2E_ADMIN_URL) next to the API.
 * The seeded expert gets a staff workspace for the run, opens the clinic
 * queue, checks a pending filing and approves it; a second filing is sent
 * back with a reason. The clinic belongs to the demo member, so the
 * reviewer is never one of its people. Screenshots go to the design-audit
 * captures when E2E_DESIGN_CAPTURE=1.
 */
import { mkdirSync } from "node:fs"
import { neon } from "@neondatabase/serverless"
import { expect, test, type Browser, type Page } from "@playwright/test"
import { adminUrl, apiUrl, authHeaders, sessionCookie } from "./helpers/auth"
import { expertSession } from "./helpers/booking-request-smoke"
import {
  isApprovedE2eDatabaseUrl,
  isLoopbackUrl,
  isNonLoopbackE2eTarget,
} from "./helpers/local"

const runSmoke = process.env.E2E_ADMIN_CLINICS === "1"
const OWNER_EMAIL = "member.demo@example.test"
const EXPERT_EMAIL = "fisio.mota@example.test"
const CLINIC_NAME = "Clínica Lumen"
const CAPTURE_DIR = process.env.E2E_DESIGN_CAPTURE
  ? `docs/eleva-v3/design-audit/captures/${process.env.DESIGN_CAPTURE_LABEL ?? "admin-clinics"}/13-admin`
  : null

/** Merge a response's Set-Cookie pairs into a Cookie header. */
function withCookies(cookie: string, fresh: string | null): string {
  if (!fresh) return cookie
  const jar = new Map<string, string>()
  for (const part of `${cookie}; ${fresh}`.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name) jar.set(name, rest.join("="))
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

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
      return { name: name!, value: rest.join("="), url: adminUrl }
    })
  )
  return context.newPage()
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
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
    fullPage,
  })
}

test.describe("Phase 12 — staff verify a clinic", () => {
  test.describe.configure({ mode: "serial" })
  test.skip(!runSmoke, "Set E2E_ADMIN_CLINICS=1 to run the clinic queue smoke")
  test.skip(
    isNonLoopbackE2eTarget() || !isLoopbackUrl(adminUrl),
    "Clinic queue smoke stays on loopback"
  )
  test.skip(
    !isApprovedE2eDatabaseUrl(),
    "needs E2E_ALLOW_DB_WRITES=1 and approved loopback test DATABASE_URL"
  )

  let cookie = ""
  let previousOrgId: string | null = null
  let staffOrgId = ""
  let clinicId = ""
  // The clinics the paging test adds, found again by their slug.
  const pagingSlugs = `e2e-paging-${Date.now().toString(36)}-`

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000)
    const health = await request.get(`${apiUrl}/health`)
    test.skip(health.status() !== 200, "needs local API on :3002")
    const admin = await request.get(adminUrl).catch(() => null)
    test.skip(!admin, "needs the admin app on :3007")
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

    const sql = neon(process.env.DATABASE_URL!)
    const suffix = Date.now().toString(36)
    const [staffOrg] = (await sql`
      INSERT INTO auth.organization (name, slug, type)
      VALUES ('E2E Staff', ${`e2e-staff-${suffix}`}, 'staff')
      RETURNING id
    `) as { id: string }[]
    staffOrgId = staffOrg!.id
    await sql`
      INSERT INTO auth.member (organization_id, user_id, role)
      SELECT ${staffOrgId}::uuid, id, 'admin' FROM auth."user"
      WHERE lower(email) = ${EXPERT_EMAIL}
    `
    const [clinic] = (await sql`
      INSERT INTO auth.organization (name, slug, type)
      VALUES (${CLINIC_NAME}, ${`e2e-clinic-${suffix}`}, 'team')
      RETURNING id
    `) as { id: string }[]
    clinicId = clinic!.id
    await sql`
      INSERT INTO auth.member (organization_id, user_id, role)
      SELECT ${clinicId}::uuid, id, 'owner' FROM auth."user"
      WHERE lower(email) = ${OWNER_EMAIL}
    `
    await sql`
      INSERT INTO clinic_profiles (org_id, slug, display_name, country_code, website_url, billing_address, specialties)
      VALUES (
        ${clinicId}::uuid, ${`e2e-clinic-${suffix}`}, ${CLINIC_NAME}, 'PT',
        'https://clinicalumen.example',
        '{"line1":"Rua das Flores 12","postalCode":"1200-195","city":"Lisboa","country":"PT"}'::jsonb,
        '{}'
      )
    `
    await sql`
      INSERT INTO clinic_verifications (org_id, legal_name, tax_id)
      VALUES (${clinicId}::uuid, 'Clínica Lumen, Lda', 'PT515001708')
    `

    const switched = await request.post(
      `${apiUrl}/auth/organization/set-active`,
      {
        headers: authHeaders(cookie),
        data: { organizationId: staffOrgId },
      }
    )
    expect(switched.status(), await switched.text()).toBe(200)
    cookie = withCookies(cookie, sessionCookie(switched))
  })

  test.afterAll(async ({ request }) => {
    try {
      if (previousOrgId) {
        await request.post(`${apiUrl}/auth/organization/set-active`, {
          headers: authHeaders(cookie),
          data: { organizationId: previousOrgId },
        })
      }
    } finally {
      // The fixtures go even if the API is gone.
      const sql = neon(process.env.DATABASE_URL!)
      await sql`
        DELETE FROM clinic_verifications WHERE org_id IN (
          SELECT id FROM auth.organization WHERE slug LIKE ${`${pagingSlugs}%`}
        )
      `
      await sql`DELETE FROM auth.organization WHERE slug LIKE ${`${pagingSlugs}%`}`
      if (staffOrgId) {
        await sql`DELETE FROM audit_outbox WHERE org_id = ${staffOrgId}::uuid`
      }
      if (clinicId) {
        // Approved filings keep their reviewer: filings go before the org.
        await sql`DELETE FROM clinic_verifications WHERE org_id = ${clinicId}::uuid`
        await sql`DELETE FROM auth.organization WHERE id = ${clinicId}::uuid`
      }
      if (staffOrgId) {
        await sql`DELETE FROM auth.organization WHERE id = ${staffOrgId}::uuid`
      }
    }
  })

  test("a pending filing is checked and approved; another is sent back", async ({
    browser,
    request,
  }) => {
    test.setTimeout(240_000)
    const sql = neon(process.env.DATABASE_URL!)
    const page = await pageWithSession(browser, cookie)
    await page.goto(`${adminUrl}/clinics`)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Clinic verifications",
      { timeout: 90_000 }
    )
    const row = page.getByRole("row", { name: new RegExp(CLINIC_NAME) }).last()
    await expect(row).toContainText("Clínica Lumen, Lda")
    await expect(row).toContainText("To check")
    await shot(page, "01-clinic-queue.desktop")

    await row.click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      CLINIC_NAME,
      { timeout: 60_000 }
    )
    await expect(page.getByText("PT515001708")).toBeVisible()
    await expect(page.getByText("Rua das Flores 12")).toBeVisible()
    // Both checks are needed before Approve is offered.
    await expect(page.getByTestId("clinic-approve")).toBeDisabled()
    await shot(page, "02-clinic-filing.desktop")

    const phone = await pageWithSession(browser, cookie, true)
    await phone.goto(page.url())
    await expect(phone.getByRole("heading", { level: 1 })).toHaveText(
      CLINIC_NAME,
      { timeout: 60_000 }
    )
    // The whole page, so the decision form is in the capture.
    await shot(phone, "02-clinic-filing.mobile", true)
    await phone.context().close()

    await page.getByText("Legal name found in the public register").click()
    await expect(page.getByTestId("clinic-approve")).toBeDisabled()
    await page.getByText("NIF or VAT number belongs to that company").click()
    await page.getByTestId("clinic-approve").click()
    await expect(page.getByTestId("clinic-filing-note")).toHaveText(
      "This filing is approved: the clinic is verified. Eleva tells the clinic's owner and admins by email.",
      { timeout: 30_000 }
    )
    await shot(page, "03-clinic-verified.desktop")

    const [approved] = (await sql`
      SELECT status, reviewer_user_id, checklist FROM clinic_verifications
      WHERE org_id = ${clinicId}::uuid
    `) as {
      status: string
      reviewer_user_id: string | null
      checklist: Record<string, boolean>
    }[]
    expect(approved).toMatchObject({
      status: "approved",
      checklist: { legal_entity_checked: true, tax_id_checked: true },
    })
    expect(approved!.reviewer_user_id).toBeTruthy()

    // A new identity is filed later; staff send it back with a reason.
    const [second] = (await sql`
      INSERT INTO clinic_verifications (org_id, legal_name, tax_id)
      VALUES (${clinicId}::uuid, 'Lumen Saúde, SA', 'PT509442013')
      RETURNING id
    `) as { id: string }[]
    await page.goto(`${adminUrl}/clinics/${second!.id}`)
    await expect(page.getByText("PT509442013")).toBeVisible({
      timeout: 60_000,
    })
    await expect(
      page.getByText("This clinic is verified under another filing")
    ).toBeVisible()
    // A reason is needed before either button is offered.
    await expect(page.getByTestId("clinic-needs-changes")).toBeDisabled()
    await page
      .getByTestId("clinic-decision-reason")
      .fill("The NIF belongs to another company in the register.")
    await page.getByTestId("clinic-needs-changes").click()
    await expect(page.getByTestId("clinic-filing-note")).toContainText(
      "You asked for changes.",
      { timeout: 30_000 }
    )
    await shot(page, "04-clinic-sent-back.desktop")

    // The clinic sends it again; this time staff reject. Rejecting tells
    // the whole clinic, so it is confirmed with the reason as they read it.
    await sql`
      UPDATE clinic_verifications
      SET status = 'pending', reason = NULL, reviewer_user_id = NULL,
          reviewed_at = NULL, submitted_at = now()
      WHERE id = ${second!.id}::uuid
    `
    await page.reload()
    await expect(page.getByTestId("clinic-reject")).toBeDisabled({
      timeout: 60_000,
    })
    await page
      .getByTestId("clinic-decision-reason")
      .fill("This company is not in the register.")
    await page.getByTestId("clinic-reject").click()
    await expect(page.getByTestId("clinic-reject-reason")).toHaveText(
      "This company is not in the register."
    )
    await shot(page, "05-clinic-reject-confirm.desktop")
    // Backing out decides nothing.
    await page.getByTestId("clinic-reject-cancel").click()
    await expect(page.getByTestId("clinic-reject-confirm")).toHaveCount(0)
    await page.getByTestId("clinic-reject").click()
    await page.getByTestId("clinic-reject-confirm").click()
    await expect(page.getByTestId("clinic-filing-note")).toContainText(
      "This filing was rejected.",
      { timeout: 30_000 }
    )
    await page.context().close()

    // The clinic stays verified, and both decisions are audited.
    const team = await request.get(`${apiUrl}/admin/clinics/${second!.id}`, {
      headers: authHeaders(cookie),
    })
    expect(team.status(), await team.text()).toBe(200)
    expect(await team.json()).toMatchObject({
      verified: true,
      verification: {
        status: "rejected",
        reason: "This company is not in the register.",
      },
    })
    // Staff see the owner by name only: Eleva writes to the clinic itself.
    expect(Object.keys((await team.json()).owner)).toEqual(["name"])
    const audit = (await sql`
      SELECT action FROM audit_outbox
      WHERE org_id = ${clinicId}::uuid AND action LIKE 'clinic_verification.%'
        AND action <> 'clinic_verification.opened'
      ORDER BY action
    `) as { action: string }[]
    expect(audit.map((r) => r.action)).toEqual([
      "clinic_verification.approved",
      "clinic_verification.changes_requested",
      "clinic_verification.rejected",
    ])
    // Every time staff opened a filing is on record, with who opened it.
    const [opened] = (await sql`
      SELECT count(*)::int AS times, count(DISTINCT actor_user_id)::int AS readers
      FROM audit_outbox
      WHERE org_id = ${clinicId}::uuid AND action = 'clinic_verification.opened'
    `) as { times: number; readers: number }[]
    expect(opened!.times).toBeGreaterThanOrEqual(2)
    expect(opened!.readers).toBe(1)
    // Each decision queued its notice to the clinic, and a clinic that was
    // already verified is told it stays verified.
    const notices = (await sql`
      SELECT type, payload->>'verified' AS verified FROM domain_events_outbox
      WHERE org_id = ${clinicId}::uuid AND type LIKE 'clinic.%'
      ORDER BY created_at
    `) as { type: string; verified: string }[]
    expect(notices).toEqual([
      { type: "clinic.verified", verified: "true" },
      { type: "clinic.needs_changes", verified: "true" },
      { type: "clinic.rejected", verified: "true" },
    ])
  })

  test("the queue has pages: the address, the title, the keyboard's place and the record", async ({
    browser,
  }) => {
    test.setTimeout(300_000)
    const sql = neon(process.env.DATABASE_URL!)
    // 26 more filings, sent long before anything else in the queue, so
    // they fill its first 26 places whatever the database already holds.
    await sql`
      INSERT INTO auth.organization (name, slug, type)
      SELECT 'Paging clinic ' || n, ${pagingSlugs} || n, 'team'
      FROM generate_series(1, 26) AS n
    `
    await sql`
      INSERT INTO clinic_profiles (org_id, slug, display_name, country_code, billing_address, specialties)
      SELECT id, slug, name, 'PT', '{"city":"Lisboa","country":"PT"}'::jsonb, '{}'
      FROM auth.organization WHERE slug LIKE ${`${pagingSlugs}%`}
    `
    await sql`
      INSERT INTO clinic_verifications (org_id, legal_name, tax_id, submitted_at)
      SELECT id, name || ', Lda',
             'PT5150017' || lpad((row_number() OVER (ORDER BY slug))::text, 2, '0'),
             '2001-01-01T00:00:00Z'
      FROM auth.organization WHERE slug LIKE ${`${pagingSlugs}%`}
    `
    const reads = async () =>
      (await sql`
        SELECT payload FROM audit_outbox
        WHERE org_id = ${staffOrgId}::uuid AND action = 'clinic_verification.listed'
        ORDER BY created_at
      `) as { payload: { page: number; shown: number; via: string } }[]
    const before = (await reads()).length

    const page = await pageWithSession(browser, cookie)
    const heading = page.getByRole("heading", { level: 1 })
    const range = page.locator("#queue-range")
    const pages = page.getByRole("navigation", { name: "Pages" })

    await page.goto(`${adminUrl}/clinics`)
    await expect(heading).toHaveText("Clinic verifications", {
      timeout: 90_000,
    })
    await expect(range).toHaveText(/^Showing 1 to 25 of \d+$/)
    await expect(page).toHaveTitle("Clinic verifications")
    // The header row and 25 filings: one page, not the queue.
    await expect(page.getByRole("row")).toHaveCount(26)
    // No way back from the first page; the control is there and says so.
    await expect(
      pages.getByRole("link", { name: "Previous page" })
    ).toHaveAttribute("aria-disabled", "true")
    await shot(page, "06-clinic-queue-page-1.desktop")

    // Next is a link: the pointer rests on it, then presses it.
    const next = pages.getByRole("link", { name: "Next page" })
    await next.hover()
    await next.click()
    await expect(page).toHaveURL(/\/clinics\?page=2$/, { timeout: 60_000 })
    await expect(range).toHaveText(/^Showing (26 to \d+|row 26) of \d+/)
    await expect(page).toHaveTitle("Clinic verifications · Page 2")
    // The keyboard continues from the heading, which then reads the range.
    await expect(heading).toBeFocused()
    await expect(heading).toHaveAttribute("aria-describedby", "queue-range")
    await shot(page, "07-clinic-queue-page-2.desktop")

    // Two pages were served and two are on record, each with how it was
    // read. Resting on a link and the tab title read nothing.
    const served = (await reads()).slice(before)
    expect(served.map((row) => row.payload)).toMatchObject([
      { page: 1, shown: 25, via: "cookie" },
      { page: 2, via: "cookie" },
    ])
    expect(served).toHaveLength(2)

    // The page is in the address: a reload shows the same rows.
    await page.reload()
    await expect(range).toHaveText(/^Showing (26 to \d+|row 26) of \d+/, {
      timeout: 60_000,
    })

    // A page past the end is the last page, and the address says which.
    await page.goto(`${adminUrl}/clinics?page=999`)
    // The address is 999 until the console has followed the API.
    await expect(page).toHaveURL(/\/clinics\?page=(?!999$)\d+$/, {
      timeout: 60_000,
    })
    await expect(range).toHaveText(
      /of \d+\. You've reached the end of the queue\.$/
    )
    await expect(
      pages.getByRole("link", { name: "Next page" })
    ).toHaveAttribute("aria-disabled", "true")
    await shot(page, "08-clinic-queue-last-page.desktop")

    // A number too large to be a page is past the end too.
    await page.goto(`${adminUrl}/clinics?page=123456`)
    await expect(page).toHaveURL(/\/clinics\?page=\d{1,3}$/, {
      timeout: 60_000,
    })
    // What is not a page, and a needless page 1, are the clean address.
    for (const value of ["abc", "0", "1"]) {
      await page.goto(`${adminUrl}/clinics?page=${value}`)
      await expect(page).toHaveURL(/\/clinics$/, { timeout: 60_000 })
      await expect(range).toHaveText(/^Showing 1 to 25 of \d+$/)
    }

    // Opening a filing and its link back read the queue once: the link is
    // not fetched ahead while the filing is on screen.
    const beforeFiling = (await reads()).length
    await page.getByRole("row").nth(1).click()
    await expect(page.getByText("What the clinic sent")).toBeVisible({
      timeout: 60_000,
    })
    const back = page.getByRole("link", { name: "All clinic verifications" })
    await back.hover()
    expect((await reads()).length).toBe(beforeFiling)
    await back.click()
    await expect(range).toHaveText(/^Showing 1 to 25 of \d+$/, {
      timeout: 60_000,
    })
    expect((await reads()).length).toBe(beforeFiling + 1)

    // The same footer in the other two languages, and on a phone at night.
    for (const locale of ["pt", "es"]) {
      await page
        .context()
        .addCookies([{ name: "ELEVA_LOCALE", value: locale, url: adminUrl }])
      await page.goto(`${adminUrl}/clinics?page=2`)
      await expect(range).toHaveText(
        locale === "pt"
          ? /^A mostrar (26 a \d+|a linha 26) de \d+/
          : /^Mostrando (del 26 al \d+|la fila 26) de \d+/,
        { timeout: 60_000 }
      )
      await shot(page, `09-clinic-queue-page-2.${locale}.desktop`)
    }
    await page.context().close()

    const phone = await pageWithSession(browser, cookie, true)
    await phone
      .context()
      .addCookies([{ name: "ELEVA_THEME", value: "dark", url: adminUrl }])
    await phone.goto(`${adminUrl}/clinics?page=2`)
    await expect(phone.locator("#queue-range")).toBeVisible({ timeout: 60_000 })
    // Nothing runs off the side of a phone.
    expect(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await shot(phone, "10-clinic-queue-page-2.mobile.dark", true)
    await phone.context().close()
  })
})
