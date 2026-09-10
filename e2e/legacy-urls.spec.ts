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
      await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
    }

    const contact = await page.goto("/contact")
    expect(contact?.status()).toBe(200)
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
    await expect(page.getByTestId("contact-heading")).toBeVisible()

    for (const slug of ["security", "ers"] as const) {
      const trust = await page.goto(`/trust/${slug}`)
      expect(trust?.status(), slug).toBe(200)
      await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
    }
  })

  test("keeps community as external footer links with no v3 route", async ({
    page,
    request,
  }) => {
    const community = await request.get("/community", { maxRedirects: 0 })
    expect(community.status()).toBe(404)

    await page.goto("/")
    const nav = page.getByTestId("footer-community")
    await expect(nav).toBeVisible()
    for (const link of COMMUNITY_EXTERNAL_LINKS) {
      const item = nav.getByTestId(`footer-community-${link.id}`)
      await expect(item).toBeVisible()
      await expect(item).toHaveAttribute("href", link.href)
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
