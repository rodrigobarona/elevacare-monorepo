import { expect, test } from "@playwright/test"
import {
  COMMUNITY_EXTERNAL_LINKS,
  PUBLIC_SITE_PARITY_REDIRECTS,
  RETIRED_LOCALE_REDIRECTS,
} from "../packages/config/src/public-site-parity"

const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "health-data",
  "cookies",
  "payments",
  "expert-agreement",
] as const

const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"

function locationPath(header: string | null): string {
  expect(header).toBeTruthy()
  return new URL(header!, webUrl).pathname
}

test.describe("D-10 public-site parity", () => {
  test("301s retired locale prefixes (D-01)", async ({ request }) => {
    for (const row of RETIRED_LOCALE_REDIRECTS) {
      const res = await request.get(row.path, { maxRedirects: 0 })
      expect(res.status(), row.id).toBe(301)
      expect(locationPath(res.headers()["location"]), row.id).toBe(
        row.locationPath
      )
    }
  })

  test("301s retired quiz, help, and trust aliases", async ({ request }) => {
    for (const row of PUBLIC_SITE_PARITY_REDIRECTS) {
      const res = await request.get(row.path, { maxRedirects: 0 })
      expect(res.status(), row.id).toBe(301)
      expect(locationPath(res.headers()["location"]), row.id).toBe(
        row.locationPath
      )
    }
  })

  test("keeps legal documents and draft contact/trust pages", async ({
    page,
  }) => {
    for (const slug of LEGAL_SLUGS) {
      const legal = await page.goto(`/legal/${slug}`)
      expect(legal?.status(), slug).toBe(200)
      await expect(page.getByTestId("longform-version")).toBeVisible()
      await expect(page.getByTestId("longform-last-updated")).toBeVisible()
      await expect(page.getByTestId("legal-draft-banner")).toHaveCount(0)
    }

    const contact = await page.goto("/contact")
    expect(contact?.status()).toBe(200)
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
    await expect(page.getByTestId("contact-heading")).toBeVisible()

    for (const slug of ["security", "ers", "dpa", "sub-processors"] as const) {
      const trust = await page.goto(`/trust/${slug}`)
      expect(trust?.status(), slug).toBe(200)
      await expect(page.getByTestId("longform-version")).toBeVisible()
      await expect(page.getByTestId("legal-draft-banner")).toHaveCount(0)
    }

    const evidence = await page.goto("/evidence-based-care")
    expect(evidence?.status()).toBe(200)
    await expect(page.getByTestId("longform-version")).toBeVisible()
  })

  test("serves editorial pillar pages and footer community links", async ({
    page,
    request,
  }) => {
    for (const path of ["/newsletter", "/podcast", "/community"] as const) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
    }

    await page.goto("/")
    const nav = page.getByTestId("footer-community")
    await expect(nav).toBeVisible()
    await expect(nav.getByTestId("footer-community-newsletter")).toBeVisible()
    await expect(nav.getByTestId("footer-community-podcast")).toBeVisible()
    await expect(nav.getByTestId("footer-community-hub")).toBeVisible()
    for (const link of COMMUNITY_EXTERNAL_LINKS) {
      const item = nav.getByTestId(`footer-community-${link.id}`)
      await expect(item).toBeVisible()
      await expect(item).toHaveAttribute("href", link.href)
    }
  })

  test("rewrites legacy help paths to docs portals", async ({ request }) => {
    const cases = [
      { path: "/help", target: "/docs" },
      { path: "/help/patient/booking", target: "/docs/members/booking" },
      { path: "/pt/help/patient/booking", target: "/docs/pt/members/booking" },
    ] as const
    for (const row of cases) {
      const res = await request.get(row.path, { maxRedirects: 0 })
      expect(res.status(), row.path).toBe(301)
      expect(locationPath(res.headers()["location"]), row.path).toBe(row.target)
    }
  })

  test("preserves a seeded expert URL", async ({ page }) => {
    test.skip(
      process.env.CI === "true" && !process.env.DATABASE_URL,
      "e2e-smoke has no DATABASE_URL"
    )
    const profile = await page.goto("/fisiomota")
    expect(profile?.status()).toBe(200)
    await expect(page.getByTestId("expert-profile-heading")).toBeVisible({
      timeout: 15_000,
    })
  })
})
