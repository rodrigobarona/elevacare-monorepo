import type { Page, Route } from "@playwright/test"

export const PAID_EXPERT = "fisiomota"
export const PAID_OFFER = "first-visit"
export const PAID_PRICE_CENTS = 6000

export const appUrl = process.env.E2E_APP_URL ?? "http://localhost:3001"
export const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"

const PRODUCTION_HOSTS = new Set(["eleva.care", "www.eleva.care"])

export function isVercelProductionTarget(): boolean {
  if (process.env.VERCEL_ENV === "production") return true
  const urls = [
    process.env.E2E_BASE_URL,
    process.env.E2E_API_URL,
    process.env.E2E_ACCOUNT_URL,
    process.env.E2E_APP_URL,
  ]
  for (const raw of urls) {
    if (!raw) continue
    try {
      const host = new URL(raw).hostname
      if (PRODUCTION_HOSTS.has(host)) return true
    } catch {
      continue
    }
  }
  return false
}

const MOCK_ZIP = Buffer.from("PK\u0005\u0006" + "\u0000".repeat(18))

export async function mockPrivateBlob(page: Page): Promise<void> {
  const fulfillZip = async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/zip",
      headers: {
        "Content-Disposition": 'attachment; filename="eleva-member-export.zip"',
      },
      body: MOCK_ZIP,
    })
  }

  await page.route(/blob\.vercel-storage\.com/i, fulfillZip)
  await page.route("**/privacy/dsar/*/file**", fulfillZip)
}
