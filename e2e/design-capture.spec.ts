import { mkdirSync, renameSync } from "node:fs"
import path from "node:path"
import {
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test"
import {
  accountUrl,
  E2E_PASSWORD,
  uniqueEmail,
  verifyEmail,
  waitForE2eAuthUrl,
} from "./helpers/auth"
import {
  dismissCookieBanner,
  fillGuestAndConsents,
  uniqueGuestEmail,
} from "./helpers/booking"
import { PAID_EXPERT_EMAIL } from "./helpers/booking-request-smoke"
import { sessionFromMagicLink } from "./helpers/cancellation-policy-smoke"
import {
  appUrl,
  isNonLoopbackE2eTarget,
  PAID_EXPERT,
  PAID_OFFER,
  webUrl,
} from "./helpers/local"

/**
 * Design capture: full-page screenshots and walkthrough videos of every key
 * surface, saved as the before/after evidence for the design audit.
 *
 *   E2E_DESIGN_CAPTURE=1 E2E_SKIP_WEBSERVER=1 DESIGN_CAPTURE_LABEL=2026-11-14-before \
 *     pnpm exec playwright test e2e/design-capture.spec.ts --project=chromium --workers=1
 *
 * Loopback only. Output: docs/eleva-v3/design-audit/captures/{label}/{surface}/.
 * Run it before a design slice and again after (a new label) to get the pair.
 */
const run = process.env.E2E_DESIGN_CAPTURE === "1"
const label =
  process.env.DESIGN_CAPTURE_LABEL ?? new Date().toISOString().slice(0, 10)
const outRoot = path.join(
  process.cwd(),
  "docs/eleva-v3/design-audit/captures",
  label
)
const expertUrl = process.env.E2E_EXPERT_URL ?? "http://localhost:3003"
const MEMBER_DEMO_EMAIL = "member.demo@example.test"

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }
type Viewport = "desktop" | "mobile"

function viewportOf(kind: Viewport) {
  return kind === "desktop" ? DESKTOP : MOBILE
}

function dir(surface: string): string {
  const target = path.join(outRoot, surface)
  mkdirSync(target, { recursive: true })
  return target
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {})
  // The Next dev overlay covers buttons at phone width.
  await page
    .addStyleTag({ content: "nextjs-portal{display:none!important}" })
    .catch(() => {})
  await page.waitForTimeout(400)
}

/** The consent banner mounts after hydration; wait for it, then reject. */
async function clearBanner(page: Page): Promise<void> {
  await settle(page)
  await dismissCookieBanner(page).catch(() => {})
}

async function shoot(
  page: Page,
  surface: string,
  name: string,
  kind: Viewport,
  options?: { fullPage?: boolean }
): Promise<void> {
  await settle(page)
  await page.screenshot({
    path: path.join(dir(surface), `${name}.${kind}.jpg`),
    fullPage: options?.fullPage ?? true,
    type: "jpeg",
    quality: 82,
  })
}

async function newContext(
  browser: Browser,
  kind: Viewport,
  options?: { video?: { surface: string }; cookie?: string }
): Promise<BrowserContext> {
  const viewport = viewportOf(kind)
  const context = await browser.newContext({
    viewport,
    isMobile: kind === "mobile",
    hasTouch: kind === "mobile",
    deviceScaleFactor: 1,
    locale: "en-GB",
    timezoneId: "Europe/Lisbon",
    // Sections fade in with a scroll-driven animation; a full-page shot
    // never scrolls them into view, so stills are taken with motion reduced.
    reducedMotion: options?.video ? "no-preference" : "reduce",
    recordVideo: options?.video
      ? { dir: dir(options.video.surface), size: viewport }
      : undefined,
  })
  if (options?.cookie) {
    await context.addCookies(
      options.cookie.split("; ").map((pair) => {
        const eq = pair.indexOf("=")
        return {
          name: pair.slice(0, eq),
          value: pair.slice(eq + 1),
          domain: "localhost",
          path: "/",
        }
      })
    )
  }
  return context
}

/** Close the context and give its recording a stable name. */
async function finishVideo(
  page: Page,
  context: BrowserContext,
  surface: string,
  name: string,
  kind: Viewport
): Promise<void> {
  const video = page.video()
  await context.close()
  const recorded = await video?.path().catch(() => null)
  if (recorded) {
    renameSync(recorded, path.join(dir(surface), `${name}.${kind}.webm`))
  }
}

async function slowScroll(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.body.scrollHeight)
  const step = Math.round(page.viewportSize()!.height * 0.6)
  for (let y = 0; y < height; y += step) {
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "smooth" }),
      y
    )
    await page.waitForTimeout(650)
  }
  await page.evaluate(() => window.scrollTo({ top: 0 }))
}

const PUBLIC_PAGES: Array<{ surface: string; name: string; url: string }> = [
  { surface: "01-homepage", name: "01-home", url: "/home" },
  { surface: "02-discovery", name: "01-experts", url: "/experts" },
  { surface: "03-profile", name: "01-profile-paid", url: `/${PAID_EXPERT}` },
  { surface: "03-profile", name: "02-profile-free", url: "/anaquick" },
  { surface: "03-profile", name: "03-profile-empty", url: "/patimota" },
  { surface: "08-marketing", name: "01-become-expert", url: "/become-expert" },
  { surface: "08-marketing", name: "02-for-clinics", url: "/for-clinics" },
  { surface: "08-marketing", name: "03-about", url: "/about" },
  { surface: "09-trust", name: "01-trust", url: "/trust" },
  { surface: "09-trust", name: "02-legal-privacy", url: "/legal/privacy" },
]

test.describe("design capture", () => {
  test.skip(!run, "set E2E_DESIGN_CAPTURE=1 (loopback only)")
  test.skip(isNonLoopbackE2eTarget(), "design capture stays on loopback")
  test.setTimeout(600_000)

  for (const kind of ["desktop", "mobile"] as const) {
    test(`public pages — ${kind}`, async ({ browser }) => {
      const context = await newContext(browser, kind)
      const page = await context.newPage()
      for (const entry of PUBLIC_PAGES) {
        await page.goto(`${webUrl}${entry.url}`)
        await clearBanner(page)
        await shoot(page, entry.surface, entry.name, kind)
        // Public API budget is 10 req/min for direct callers.
        await page.waitForTimeout(2_500)
      }
      await context.close()
    })

    test(`homepage scroll video — ${kind}`, async ({ browser }) => {
      const context = await newContext(browser, kind, {
        video: { surface: "01-homepage" },
      })
      const page = await context.newPage()
      await page.goto(`${webUrl}/home`)
      await clearBanner(page)
      await settle(page)
      await slowScroll(page)
      await finishVideo(page, context, "01-homepage", "home-scroll", kind)
    })

    test(`paid booking funnel to checkout — ${kind}`, async ({ browser }) => {
      const surface = "04-booking-checkout"
      const context = await newContext(browser, kind, { video: { surface } })
      const page = await context.newPage()
      await page.goto(`${webUrl}/${PAID_EXPERT}`)
      await clearBanner(page)
      await settle(page)
      await page.goto(`${webUrl}/${PAID_EXPERT}/${PAID_OFFER}`)
      await shoot(page, surface, "01-paid-funnel-entry", kind)

      const continueMeet = page.getByTestId("booking-continue-meet")
      if (await continueMeet.isVisible().catch(() => false)) {
        await page
          .getByTestId("booking-mode-option")
          .and(page.locator(":not([aria-disabled='true'])"))
          .first()
          .click()
        await shoot(page, surface, "02-paid-mode-picked", kind)
        await continueMeet.click()
      }
      await page
        .getByTestId("booking-slots-loading")
        .waitFor({ state: "detached", timeout: 60_000 })
        .catch(() => {})
      const picker = page.locator("[data-slot='slot-picker']")
      await picker.waitFor({ timeout: 30_000 })
      await shoot(page, surface, "03-paid-step-when", kind)
      await picker.getByTestId("booking-slot-day").last().click()
      await picker.getByTestId("booking-slot-time").first().click()
      await shoot(page, surface, "04-paid-slot-picked", kind)
      await page.getByTestId("booking-continue-when").click()
      await page.getByTestId("booking-guest-name").waitFor()
      await shoot(page, surface, "05-paid-step-details", kind)
      await fillGuestAndConsents(page, {
        name: "Marta Silva",
        email: uniqueGuestEmail("design-capture"),
      })
      await shoot(page, surface, "06-paid-details-filled", kind)
      await page.getByTestId("booking-continue-details").click()
      await page
        .getByTestId("booking-pay-submit")
        .waitFor({ timeout: 60_000 })
        .catch(() => {})
      // Stripe Elements paint a few seconds after the totals.
      await page.waitForTimeout(6_000)
      await shoot(page, surface, "07-paid-step-pay", kind)
      await finishVideo(page, context, surface, "paid-funnel", kind)
    })

    test(`free booking funnel to thank-you — ${kind}`, async ({ browser }) => {
      const surface = "04-booking-checkout"
      const context = await newContext(browser, kind, { video: { surface } })
      const page = await context.newPage()
      await page.goto(`${webUrl}/anaquick/quick-chat`)
      await clearBanner(page)
      const continueMeet = page.getByTestId("booking-continue-meet")
      const picker = page.locator("[data-slot='slot-picker']")
      await continueMeet.or(picker).first().waitFor({ timeout: 60_000 })
      if (await continueMeet.isVisible().catch(() => false)) {
        await page
          .getByTestId("booking-mode-option")
          .and(page.locator(":not([aria-disabled='true'])"))
          .first()
          .click()
        await continueMeet.click()
      }
      await picker.waitFor({ timeout: 60_000 })
      await picker.getByTestId("booking-slot-day").last().click()
      await picker.getByTestId("booking-slot-time").last().click()
      await page.getByTestId("booking-continue-when").click()
      await page.getByTestId("booking-guest-name").waitFor()
      await fillGuestAndConsents(page, {
        name: "Marta Silva",
        email: uniqueGuestEmail("design-capture-free"),
      })
      await shoot(page, surface, "08-free-details-filled", kind)
      await page.getByTestId("booking-continue-details").click()
      await page
        .getByTestId("booking-done-heading")
        .waitFor({ timeout: 60_000 })
      await shoot(page, surface, "09-free-thank-you", kind)
      await finishVideo(page, context, surface, "free-funnel", kind)
    })

    test(`auth, signup and expert onboarding — ${kind}`, async ({
      browser,
      request,
    }) => {
      const auth = "05-auth"
      const onboarding = "06-expert-onboarding"
      const context = await newContext(browser, kind, {
        video: { surface: onboarding },
      })
      const page = await context.newPage()

      await page.goto(`${accountUrl}/login`)
      await clearBanner(page)
      await shoot(page, auth, "01-login", kind)
      await page.getByTestId("login-email").fill("marta.silva@example.com")
      await page.getByTestId("login-continue").click()
      await shoot(page, auth, "02-login-step-two", kind)

      const email = uniqueEmail("design-capture")
      await page.goto(`${accountUrl}/signup`)
      await shoot(page, auth, "03-signup", kind)
      await page.getByTestId("signup-email").fill(email)
      await page.getByTestId("signup-continue").click()
      await page.getByTestId("signup-name").fill("Marta Silva")
      await page.getByTestId("signup-password").fill(E2E_PASSWORD)
      await page.getByTestId("signup-consent").click()
      await shoot(page, auth, "04-signup-step-two", kind)
      await page.getByTestId("signup-submit").click()
      await page.getByTestId("verify-email").waitFor({ timeout: 45_000 })
      await shoot(page, auth, "05-verify-email", kind)
      await verifyEmail(request, email)

      await page.goto(`${accountUrl}/login`)
      await page.getByTestId("login-email").fill(email)
      await page.getByTestId("login-continue").click()
      await page.getByTestId("login-magic").click()
      await page.getByTestId("login-magic-sent").waitFor({ timeout: 45_000 })
      await shoot(page, auth, "06-magic-link-sent", kind)
      const magicUrl = await waitForE2eAuthUrl("magic-link", email, 20_000)
      test.skip(!magicUrl, "needs E2E_AUTH_CAPTURE=1 on the API")
      await page.goto(magicUrl!)
      await settle(page)
      await clearBanner(page)
      await shoot(page, onboarding, "01-first-landing-after-signup", kind)

      // Only people with no Space yet see the naming step.
      if (page.url().includes("/onboarding")) {
        await page.locator("form button[type='submit']").click()
        await page
          .waitForURL((url) => !url.pathname.includes("/onboarding"), {
            timeout: 30_000,
          })
          .catch(() => {})
        await shoot(page, onboarding, "02-after-space-naming", kind)
      }

      await page.goto(`${accountUrl}/account/workspaces/new`)
      await shoot(page, onboarding, "03-workspace-type-picker", kind)
      await page.goto(`${accountUrl}/account/workspaces/create/expert`)
      await shoot(page, onboarding, "04-create-expert-workspace", kind)
      await page.locator("#workspace-name").fill("Marta Silva Physio")
      await page.locator("form button[type='submit']").click()
      await page
        .waitForURL((url) => !url.pathname.includes("/workspaces/create"), {
          timeout: 45_000,
        })
        .catch(() => {})
      await settle(page)
      await clearBanner(page)
      await shoot(page, onboarding, "05-after-create-landing", kind)

      // The wizard nav lets an expert peek at every step before finishing.
      const steps = page.locator("nav ol > li > button")
      const stepCount = await steps.count()
      for (let index = 0; index < stepCount; index++) {
        await steps.nth(index).click()
        await page.waitForTimeout(600)
        await shoot(page, onboarding, `06-setup-step-${index + 1}`, kind)
      }
      await finishVideo(page, context, onboarding, "signup-to-setup", kind)
    })

    test(`expert dashboard (seeded) — ${kind}`, async ({
      browser,
      request,
    }) => {
      const surface = "07-expert-dashboard"
      const cookie = await sessionFromMagicLink(request, PAID_EXPERT_EMAIL)
      const context = await newContext(browser, kind, { cookie })
      const page = await context.newPage()
      const base = `${expertUrl}/${PAID_EXPERT}`
      const pages = [
        ["01-home", ""],
        ["02-calendar", "/calendar"],
        ["03-event-types", "/event-types"],
        ["04-schedule", "/schedule"],
        ["05-profile", "/profile"],
        ["06-members", "/members"],
        ["07-finance", "/finance"],
        ["08-setup", "/setup"],
        ["09-integrations", "/integrations"],
      ] as const
      for (const [name, suffix] of pages) {
        await page.goto(`${base}${suffix}`)
        await clearBanner(page)
        await shoot(page, surface, name, kind)
      }
      await page.goto(`${base}/event-types`)
      const firstOffer = page.getByTestId(`event-type-card-${PAID_OFFER}`)
      if (await firstOffer.isVisible().catch(() => false)) {
        await firstOffer.getByRole("link").first().click()
        await page.waitForURL(/event-types\/[^/]+$/, { timeout: 30_000 })
        await shoot(page, surface, "10-event-type-editor", kind)
      }
      await context.close()
    })

    test(`member space (seeded) — ${kind}`, async ({ browser, request }) => {
      const surface = "10-member-space"
      const cookie = await sessionFromMagicLink(request, MEMBER_DEMO_EMAIL)
      const context = await newContext(browser, kind, { cookie })
      const page = await context.newPage()
      await page.goto(`${webUrl}/dashboard`)
      await page
        .waitForURL((url) => !url.pathname.startsWith("/dashboard"), {
          timeout: 30_000,
        })
        .catch(() => {})
      const slug = new URL(page.url()).pathname.split("/").filter(Boolean)[0]
      const base = `${slug?.startsWith("space-") ? webUrl : appUrl}/${slug}`
      const pages = [
        ["01-home", ""],
        ["02-sessions", "/sessions"],
        ["03-reports", "/reports"],
        ["04-payments", "/payments"],
        ["05-privacy", "/privacy"],
        ["06-settings", "/settings"],
        ["07-notifications", "/notifications"],
      ] as const
      for (const [name, suffix] of pages) {
        await page.goto(`${base}${suffix}`)
        await clearBanner(page)
        await shoot(page, surface, name, kind)
      }
      await context.close()
    })
  }
})
