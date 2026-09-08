import { expect, test } from "@playwright/test"
import { adminUrl } from "./helpers/auth"

const runAuthJourney = process.env.E2E_AUTH === "1"

test.describe("admin portal", () => {
  test.skip(!runAuthJourney, "Set E2E_AUTH=1 with admin running")

  test("has no seeded staff login — unauthenticated visitors leave admin", async ({
    page,
  }) => {
    const response = await page.goto(adminUrl, {
      waitUntil: "domcontentloaded",
    })
    expect(response, "admin app must be running").toBeTruthy()
    await page.waitForURL(/\/(login|signin)(\/|\?|$)/, { timeout: 15_000 })
    expect(page.url().replace(/\/$/, "")).not.toBe(adminUrl.replace(/\/$/, ""))
  })
})
