import { expect, test } from "@playwright/test"

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"

test.describe("smoke", () => {
  test("web home returns 200 and renders the hero", async ({ page }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId("marketing-hero")).toBeVisible()
  })

  test("api /health returns 200", async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as { status?: string }
    expect(body.status).toBe("ok")
  })

  test("api /openapi.json is valid OpenAPI", async ({ request }) => {
    const response = await request.get(`${apiUrl}/openapi.json`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      openapi?: string
      info?: { title?: string }
      paths?: Record<string, unknown>
    }
    expect(body.openapi).toMatch(/^3\.\d+\.\d+/)
    expect(body.info && typeof body.info === "object").toBe(true)
    expect(body.paths && typeof body.paths === "object").toBe(true)
  })
})
