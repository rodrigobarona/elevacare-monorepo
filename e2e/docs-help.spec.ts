import { expect, test } from "@playwright/test"

const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"

function docsPath(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`
  if (process.env.E2E_DOCS_URL) {
    return `${process.env.E2E_DOCS_URL.replace(/\/$/, "")}${suffix}`
  }
  if (webUrl.includes("localhost")) {
    return `http://localhost:3008/docs${suffix}`
  }
  return `${webUrl.replace(/\/$/, "")}/docs${suffix}`
}

test.describe("Help center (docs zone)", () => {
  test("hub and a members article render", async ({ request, page }) => {
    test.skip(
      !process.env.E2E_DOCS_URL && !webUrl.includes("localhost"),
      "Docs smoke needs local docs on :3008 or E2E_DOCS_URL"
    )

    const hub = await request.get(docsPath("/en"))
    expect(hub.status()).toBe(200)

    const article = await request.get(docsPath("/en/members/booking"))
    expect(article.status()).toBe(200)

    await page.goto(docsPath("/en/members/booking"))
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }).first()
    ).toBeVisible()
    await expect(page.getByTestId("footer-community-help")).toBeVisible()

    const index = await request.get(docsPath("/help-search-index.json"))
    expect(index.status()).toBe(200)
    const entries = (await index.json()) as unknown[]
    expect(entries.length).toBeGreaterThan(5)

    const llms = await request.get(docsPath("/llms.txt"))
    expect(llms.status()).toBe(200)
    expect(await llms.text()).toContain("members")
  })
})
