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
  webUrl,
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
    // 51 more filings, sent long before anything else in the queue, so
    // they fill its first 51 places whatever the database already holds:
    // a first page, a page in the middle and a last one.
    await sql`
      INSERT INTO auth.organization (name, slug, type)
      SELECT 'Paging clinic ' || n, ${pagingSlugs} || n, 'team'
      FROM generate_series(1, 51) AS n
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
    // The rows and the heading point at the range, so both read it.
    await expect(page.getByRole("grid")).toHaveAttribute(
      "aria-describedby",
      "queue-range"
    )
    await shot(page, "06-clinic-queue-page-1.desktop", true)

    // Next is a link: the pointer rests on it, then presses it.
    const next = pages.getByRole("link", { name: "Next page" })
    await next.hover()
    await next.click()
    await expect(page).toHaveURL(/\/clinics\?page=2$/, { timeout: 60_000 })
    await expect(range).toHaveText(/^Showing 26 to 50 of \d+$/)
    await expect(page).toHaveTitle("Clinic verifications · Page 2")
    // A page in the middle has both ways on.
    await expect(
      pages.getByRole("link", { name: "Previous page" })
    ).toHaveAttribute("href", "/clinics")
    await expect(next).toHaveAttribute("href", "/clinics?page=3")
    // The keyboard continues from the heading, which then reads the range.
    await expect(heading).toBeFocused()
    await expect(heading).toHaveAttribute("aria-describedby", "queue-range")
    await shot(page, "07-clinic-queue-page-2.desktop", true)

    // Two pages were served and two are on record, each with how it was
    // read. Resting on a link and the tab title read nothing.
    const served = (await reads()).slice(before)
    expect(served.map((row) => row.payload)).toMatchObject([
      { page: 1, shown: 25, via: "cookie" },
      { page: 2, via: "cookie" },
    ])
    expect(served).toHaveLength(2)

    // The keyboard's place on a control can be seen: reached with Tab, as
    // a keyboard user reaches it.
    await pages.getByRole("link", { name: "Previous page" }).focus()
    await page.keyboard.press("Tab")
    await expect(next).toBeFocused()
    await shot(page, "07-clinic-queue-page-2.focus.desktop", true)

    // The page is in the address: a reload shows the same rows.
    await page.reload()
    await expect(range).toHaveText(/^Showing 26 to 50 of \d+$/, {
      timeout: 60_000,
    })

    // A filing opened from page 2, then the browser's Back: page 2 again,
    // with the rows the browser kept and no new read of the queue.
    const beforeBack = (await reads()).length
    await page.getByRole("row").nth(1).click()
    await expect(page.getByText("What the clinic sent")).toBeVisible({
      timeout: 60_000,
    })
    await page.goBack()
    await expect(page).toHaveURL(/\/clinics\?page=2$/, { timeout: 60_000 })
    await expect(range).toHaveText(/^Showing 26 to 50 of \d+$/)
    expect((await reads()).length).toBe(beforeBack)

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
    await shot(page, "08-clinic-queue-last-page.desktop", true)

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
      await page.goto(`${adminUrl}/clinics`)
      await expect(range).toHaveText(
        locale === "pt"
          ? /^A mostrar 1 a 25 de \d+$/
          : /^Mostrando del 1 al 25 de \d+$/,
        { timeout: 60_000 }
      )
      await page.goto(`${adminUrl}/clinics?page=2`)
      await expect(range).toHaveText(
        locale === "pt"
          ? /^A mostrar 26 a 50 de \d+$/
          : /^Mostrando del 26 al 50 de \d+$/,
        { timeout: 60_000 }
      )
      await shot(page, `09-clinic-queue-page-2.${locale}.desktop`, true)
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

  test("an old sign-in is told before writing, and signing in again keeps what was written", async ({
    browser,
    request,
  }) => {
    test.setTimeout(420_000)
    // The way back from signing in goes through the gateway and the
    // account app, so this one needs them too.
    const gateway = await request.get(`${webUrl}/login`).catch(() => null)
    test.skip(
      !gateway || gateway.status() >= 500,
      "needs the gateway on :3000 and the account app on :3006"
    )
    const sql = neon(process.env.DATABASE_URL!)
    // Two filings to decide: one for the journey, one for the captures.
    await sql`
      INSERT INTO auth.organization (name, slug, type)
      SELECT 'Sign-in clinic ' || n, ${`${pagingSlugs}signin-`} || n, 'team'
      FROM generate_series(1, 2) AS n
    `
    await sql`
      INSERT INTO clinic_profiles (org_id, slug, display_name, country_code, billing_address, specialties)
      SELECT id, slug, name, 'PT', '{"city":"Lisboa","country":"PT"}'::jsonb, '{}'
      FROM auth.organization WHERE slug LIKE ${`${pagingSlugs}signin-%`}
    `
    const filings = (await sql`
      INSERT INTO clinic_verifications (org_id, legal_name, tax_id)
      SELECT id, name || ', Lda',
             'PT5150018' || lpad((row_number() OVER (ORDER BY slug))::text, 2, '0')
      FROM auth.organization WHERE slug LIKE ${`${pagingSlugs}signin-%`}
      ORDER BY slug
      RETURNING id
    `) as { id: string }[]
    const [journey, captures] = filings.map((row) => row.id) as [string, string]
    const status = async (id: string) =>
      (
        (await sql`
          SELECT status FROM clinic_verifications WHERE id = ${id}::uuid
        `) as { status: string }[]
      )[0]!.status

    // The staff member signed in 13 hours ago. Better Auth reads a session
    // from its session store when there is one, and from the database
    // otherwise, so the start is moved back in both. The cookie that
    // caches the session is left out, so every read asks the store.
    const signedInHoursAgo = async (jar: string, hours: number) => {
      const startedAt = new Date(Date.now() - hours * 60 * 60 * 1000)
      await sql`
        UPDATE auth.session SET created_at = ${startedAt.toISOString()}::timestamptz
        WHERE user_id = (
          SELECT id FROM auth."user" WHERE lower(email) = ${EXPERT_EMAIL}
        )
      `
      const store = process.env.KV_REST_API_URL
      if (!store) return
      const command = async (parts: (string | number)[]) => {
        const res = await fetch(store, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
          body: JSON.stringify(parts),
        })
        return ((await res.json()) as { result: unknown }).result
      }
      const pair = jar
        .split("; ")
        .find((entry) => entry.split("=")[0]!.endsWith("session_token"))
      if (!pair) throw new Error("no session cookie to age")
      // The cookie is `<token>.<signature>`; the store's key is the token.
      const token = decodeURIComponent(pair.slice(pair.indexOf("=") + 1)).split(
        "."
      )[0]!
      const raw = (await command(["GET", token])) as string | null
      if (!raw) return
      const stored = JSON.parse(raw) as { session: { createdAt: string } }
      stored.session.createdAt = startedAt.toISOString()
      const ttl = (await command(["TTL", token])) as number
      await command(
        ttl > 0
          ? ["SET", token, JSON.stringify(stored), "EX", ttl]
          : ["SET", token, JSON.stringify(stored)]
      )
    }
    const withoutCache = (jar: string) =>
      jar
        .split("; ")
        .filter((pair) => !pair.split("=")[0]!.endsWith("session_data"))
        .join("; ")
    await signedInHoursAgo(cookie, 13)
    const old = withoutCache(cookie)

    const page = await pageWithSession(browser, old)
    await page.goto(`${adminUrl}/clinics/${journey}`)
    const banner = page.getByTestId("decision-sign-in-banner")
    await expect(banner).toBeVisible({ timeout: 90_000 })
    await expect(banner).toContainText("Sign in again before you decide")
    await expect(banner).toContainText(
      "You signed in more than 12 hours ago. A decision needs a sign-in from the last 12 hours, so a console left open can't be used to decide in your name."
    )
    await expect(banner).toContainText(
      "Your ticks and your reason stay in this tab while you sign in."
    )
    // Said before the filing, and not as an interruption.
    await expect(banner).toHaveAttribute("role", "note")
    const bannerBox = (await banner.boundingBox())!
    const filingBox = (await page
      .getByRole("heading", { name: "What the clinic sent" })
      .boundingBox())!
    expect(bannerBox.y).toBeLessThan(filingBox.y)
    // It does not take the keyboard's place when the page opens.
    await expect(banner.getByTestId("sign-in-again")).not.toBeFocused()
    await shot(page, "11-sign-in-again-banner.desktop", true)

    // The reviewer may still read, tick and write.
    const REASON = "The NIF belongs to another company in the register."
    const legal = page.getByRole("checkbox", {
      name: "Legal name found in the public register",
    })
    const nif = page.getByRole("checkbox", {
      name: "NIF or VAT number belongs to that company",
    })
    await page.getByText("Legal name found in the public register").click()
    await page.getByText("NIF or VAT number belongs to that company").click()
    await page.getByTestId("clinic-decision-reason").fill(REASON)

    // A decision pressed on the old sign-in: not saved, and said so first,
    // beside the button, which keeps the keyboard's place.
    await page.getByTestId("clinic-needs-changes").click()
    const refusal = page.getByTestId("decision-sign-in-refusal")
    await expect(refusal).toBeVisible()
    await expect(refusal).toContainText(
      "That decision wasn't saved. You signed in more than 12 hours ago, and a decision needs a newer sign-in. Your ticks and your reason are kept."
    )
    // The words are the alert; the button beside them is not part of it.
    await expect(refusal.getByRole("alert")).toContainText(
      "That decision wasn't saved."
    )
    await expect(refusal.getByRole("alert").getByRole("button")).toHaveCount(0)
    await expect(page.getByTestId("clinic-needs-changes")).toBeFocused()
    // Reject on a sign-in the page knows is too old asks for no
    // confirmation: the answer is the same, and nothing was sent.
    await page.getByTestId("clinic-reject").click()
    await expect(page.getByTestId("clinic-reject-confirm")).toHaveCount(0)
    await expect(refusal).toBeVisible()
    expect(await status(journey)).toBe("pending")
    await shot(page, "12-sign-in-again-refused.desktop", true)

    // The API is the authority, whatever a page shows or hides.
    const direct = await request.post(
      `${apiUrl}/admin/clinics/${journey}/decision`,
      {
        headers: authHeaders(old),
        data: {
          decision: "needs_changes",
          submittedAt: new Date().toISOString(),
          reason: REASON,
        },
      }
    )
    expect(direct.status(), await direct.text()).toBe(403)
    expect(await direct.json()).toMatchObject({ code: "STEP_UP_REQUIRED" })

    // When signing out does not go through, the reviewer stays on the
    // review, is told, and loses nothing.
    await page.route("**/auth/sign-out", (route) => route.abort())
    await refusal.getByTestId("sign-in-again").click()
    await expect(refusal.getByTestId("sign-in-again-failure")).toHaveText(
      "We couldn't open the sign-in page. Try again in a moment."
    )
    await expect(page).toHaveURL(`${adminUrl}/clinics/${journey}`)
    await expect(page.getByTestId("clinic-decision-reason")).toHaveValue(REASON)
    await page.unroute("**/auth/sign-out")

    // One press: the sign-in page, in this tab, with the way back to this
    // review and the email already filled in.
    await refusal.getByTestId("sign-in-again").click()
    await expect(page).toHaveURL(/\/login\?/, { timeout: 90_000 })
    const signInUrl = new URL(page.url())
    // Locally the gateway hands /login to the account app's own port.
    expect(signInUrl.pathname).toBe("/login")
    expect(signInUrl.searchParams.get("returnTo")).toBe(
      `/dashboard?console=${encodeURIComponent(`/clinics/${journey}`)}`
    )
    await expect(page.locator("#email")).toHaveValue(EXPERT_EMAIL, {
      timeout: 90_000,
    })
    await shot(page, "13-sign-in-email-filled.desktop")
    // The old session ended: it cannot be used again.
    const ended = await request.get(
      `${apiUrl}/auth/get-session?disableCookieCache=true`,
      { headers: authHeaders(old) }
    )
    expect((await ended.json())?.session ?? null).toBeNull()

    // Signing in with an email link, the method that opens another tab:
    // the reviewer asks for the link here, uses it elsewhere (the suite's
    // helper makes that session), and comes back to this tab, which goes
    // on by itself to the review. This is the tab that holds the draft.
    await page.locator("#email").press("Enter")
    await page.getByTestId("login-magic").click()
    await expect(page.getByTestId("login-magic-sent")).toBeVisible({
      timeout: 60_000,
    })
    cookie = await expertSession(request)
    await page.context().addCookies(
      cookie.split("; ").map((pair) => {
        const [name, ...rest] = pair.split("=")
        return { name: name!, value: rest.join("="), url: adminUrl }
      })
    )
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await expect(page).toHaveURL(`${adminUrl}/clinics/${journey}`, {
      timeout: 90_000,
    })
    // A new session starts in the person's own workspace. Entering the
    // staff one is a deliberate step, and it keeps the address.
    const enter = page.getByTestId("staff-entry-submit")
    const restored = page.getByTestId("decision-restored")
    await expect(enter.or(restored)).toBeVisible({ timeout: 90_000 })
    if (await enter.isVisible()) await enter.click()
    await expect(restored).toBeVisible({ timeout: 90_000 })
    await expect(page).toHaveURL(`${adminUrl}/clinics/${journey}`)

    // Everything is as it was left, a sentence says so, and the keyboard
    // is at the form, not at the top of the page.
    await expect(restored).toHaveText(
      "You're signed in again. Your ticks and your reason are still here. Check them, then decide."
    )
    await expect(restored).toBeFocused()
    await expect(legal).toBeChecked()
    await expect(nif).toBeChecked()
    await expect(page.getByTestId("clinic-decision-reason")).toHaveValue(REASON)
    await expect(banner).toHaveCount(0)
    await shot(page, "14-signed-in-again-restored.desktop", true)
    // Nothing was decided for the reviewer.
    expect(await status(journey)).toBe("pending")

    // Their own press decides, and nothing of the draft is left behind.
    await page.getByTestId("clinic-needs-changes").click()
    await expect(page.getByTestId("clinic-filing-note")).toContainText(
      "You asked for changes.",
      { timeout: 60_000 }
    )
    expect(await status(journey)).toBe("needs_changes")
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith("eleva.decision-draft")
        )
      )
    ).toEqual([])
    await page.context().close()

    // A second trip, on the other filing. The sign-in is a minute short of
    // too old when the page opens: no banner. The minute passes on the
    // open page and the banner appears by itself, said politely.
    await signedInHoursAgo(cookie, 12 - 1 / 60)
    const second = await pageWithSession(browser, withoutCache(cookie))
    await second.clock.install()
    await second.goto(`${adminUrl}/clinics/${captures}`)
    await expect(
      second.getByRole("heading", { name: "Your decision" })
    ).toBeVisible({ timeout: 90_000 })
    const late = second.getByTestId("decision-sign-in-banner")
    await expect(late).toHaveCount(0)
    await second.clock.fastForward("02:00")
    await expect(late).toBeVisible()
    // Said by a region that was on the page, empty, since it opened.
    await expect(second.getByTestId("decision-sign-in-said")).toHaveText(
      "Sign in again before you decide"
    )
    await second.getByText("NIF or VAT number belongs to that company").click()
    await second.getByTestId("clinic-decision-reason").fill(REASON)
    // The banner's own button this time.
    await late.getByTestId("sign-in-again").click()
    await expect(second).toHaveURL(/\/login\?/, { timeout: 90_000 })
    // The clinic sends new details while the reviewer signs in.
    await sql`
      UPDATE clinic_verifications
      SET legal_name = 'Sign-in clinic 2 (new), Lda', submitted_at = now()
      WHERE id = ${captures}::uuid
    `
    cookie = await expertSession(request)
    await second.context().addCookies(
      cookie.split("; ").map((pair) => {
        const [name, ...rest] = pair.split("=")
        return { name: name!, value: rest.join("="), url: adminUrl }
      })
    )
    await second.goto(
      `${webUrl}/dashboard?console=${encodeURIComponent(`/clinics/${captures}`)}`
    )
    const enterAgain = second.getByTestId("staff-entry-submit")
    const changed = second.getByTestId("decision-restored")
    await expect(enterAgain.or(changed)).toBeVisible({ timeout: 90_000 })
    if (await enterAgain.isVisible()) await enterAgain.click()
    // The reason is back; the tick is not, because it was made on other
    // details; and a sentence says why.
    await expect(changed).toHaveText(
      "You're signed in again. The clinic sent new details while you were away, so the checks are unticked. Your reason is still here.",
      { timeout: 90_000 }
    )
    await expect(
      second.getByRole("checkbox", {
        name: "NIF or VAT number belongs to that company",
      })
    ).not.toBeChecked()
    await expect(second.getByTestId("clinic-decision-reason")).toHaveValue(
      REASON
    )
    await expect(second.getByText("Sign-in clinic 2 (new), Lda")).toBeVisible()
    await shot(second, "14-signed-in-again-new-details.desktop", true)
    await second.context().close()

    // A signed-out person who opens a console address is sent to sign in
    // with the way back to that address, not to the console's front page.
    const nobody = await browser.newContext()
    const signedOut = await nobody.request.get(`${adminUrl}/clinics?page=2`, {
      maxRedirects: 0,
    })
    await nobody.close()
    expect(signedOut.status()).toBe(307)
    expect(
      new URL(signedOut.headers().location!).searchParams.get("returnTo")
    ).toBe(`/dashboard?console=${encodeURIComponent("/clinics?page=2")}`)

    // The same two messages in Portuguese, on a phone at night.
    await signedInHoursAgo(cookie, 13)
    const phone = await pageWithSession(browser, withoutCache(cookie), true)
    await phone.context().addCookies([
      { name: "ELEVA_LOCALE", value: "pt", url: adminUrl },
      { name: "ELEVA_THEME", value: "dark", url: adminUrl },
    ])
    await phone.goto(`${adminUrl}/clinics/${captures}`)
    const phoneBanner = phone.getByTestId("decision-sign-in-banner")
    await expect(phoneBanner).toContainText(
      "Inicie sessão de novo antes de decidir",
      { timeout: 90_000 }
    )
    await expect(phoneBanner).toContainText("há mais de 12 horas")
    // The button drops under the words and takes the width.
    const words = (await phoneBanner
      .getByText("Inicie sessão de novo antes de decidir")
      .boundingBox())!
    const button = (await phoneBanner
      .getByTestId("sign-in-again")
      .boundingBox())!
    expect(button.y).toBeGreaterThan(words.y)
    expect(button.width).toBeGreaterThan(250)
    expect(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await shot(phone, "15-sign-in-again-banner.pt.mobile.dark", true)
    await phone.getByTestId("clinic-decision-reason").fill("Motivo de teste.")
    await phone.getByTestId("clinic-needs-changes").click()
    await expect(phone.getByTestId("decision-sign-in-refusal")).toContainText(
      "Essa decisão não foi guardada."
    )
    await shot(phone, "16-sign-in-again-refused.pt.mobile.dark", true)
    await phone.context().close()
    // The sign-in is as recent as it was, for whatever runs next.
    await signedInHoursAgo(cookie, 0)

    // A browser whose clock is 13 hours ahead: the page was told how long
    // is left, not at what moment it ends, so a fresh sign-in stays fresh.
    const ahead = await pageWithSession(browser, withoutCache(cookie))
    await ahead.clock.install({ time: Date.now() + 13 * 60 * 60 * 1000 })
    await ahead.goto(`${adminUrl}/clinics/${captures}`)
    await expect(
      ahead.getByRole("heading", { name: "Your decision" })
    ).toBeVisible({ timeout: 90_000 })
    await expect(ahead.getByTestId("decision-sign-in-banner")).toHaveCount(0)
    await ahead.context().close()
  })
})
