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
    if (previousOrgId) {
      await request.post(`${apiUrl}/auth/organization/set-active`, {
        headers: authHeaders(cookie),
        data: { organizationId: previousOrgId },
      })
    }
    const sql = neon(process.env.DATABASE_URL!)
    if (clinicId) {
      // Approved filings keep their reviewer: filings go before the org.
      await sql`DELETE FROM clinic_verifications WHERE org_id = ${clinicId}::uuid`
      await sql`DELETE FROM auth.organization WHERE id = ${clinicId}::uuid`
    }
    if (staffOrgId) {
      await sql`DELETE FROM auth.organization WHERE id = ${staffOrgId}::uuid`
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
      "This filing is approved: the clinic is verified.",
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
      .getByLabel("Reason")
      .fill("The NIF belongs to another company in the register.")
    await page.getByTestId("clinic-needs-changes").click()
    await expect(page.getByTestId("clinic-filing-note")).toContainText(
      "You asked for changes.",
      { timeout: 30_000 }
    )
    await shot(page, "04-clinic-sent-back.desktop")
    await page.context().close()

    // The clinic stays verified, and both decisions are audited.
    const team = await request.get(`${apiUrl}/admin/clinics/${second!.id}`, {
      headers: authHeaders(cookie),
    })
    expect(team.status(), await team.text()).toBe(200)
    expect(await team.json()).toMatchObject({
      verified: true,
      verification: {
        status: "needs_changes",
        reason: "The NIF belongs to another company in the register.",
      },
    })
    const audit = (await sql`
      SELECT action FROM audit_outbox
      WHERE org_id = ${clinicId}::uuid AND action LIKE 'clinic_verification.%'
      ORDER BY action
    `) as { action: string }[]
    expect(audit.map((r) => r.action)).toEqual([
      "clinic_verification.approved",
      "clinic_verification.changes_requested",
    ])
  })
})
