import { expect, test } from "@playwright/test"

test.describe("phase 04 marketing pages", () => {
  test("become-expert and for-clinics drafts render", async ({ page }) => {
    const expert = await page.goto("/become-expert")
    expect(expert?.status()).toBe(200)
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
    await expect(page.getByTestId("become-expert-heading")).toBeVisible()

    const clinics = await page.goto("/for-clinics")
    expect(clinics?.status()).toBe(200)
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible()
    await expect(page.getByTestId("for-clinics-heading")).toBeVisible()

    const pt = await page.goto("/pt/become-expert")
    expect(pt?.status()).toBe(200)
    await expect(page.getByTestId("become-expert-heading")).toBeVisible()
  })

  test("301s the MVP for-organizations URL to for-clinics", async ({
    request,
  }) => {
    const res = await request.get("/for-organizations", { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    const location = res.headers()["location"]
    expect(new URL(location!, "http://localhost:3000").pathname).toBe(
      "/for-clinics"
    )
  })
})
