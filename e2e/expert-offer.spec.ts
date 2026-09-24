import { expect, test, type Page } from "@playwright/test"
import { PAID_EXPERT, PAID_OFFER } from "./helpers/local"

const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"
const expertUrl = process.env.E2E_EXPERT_URL ?? "http://127.0.0.1:3003"
const expertOrgSlug = process.env.E2E_EXPERT_ORG_SLUG ?? PAID_EXPERT
const runBuilder = process.env.E2E_EXPERT_OFFER === "1"

type PublicOffer = {
  slug: string
  modes?: Array<{ mode?: string; active?: boolean }>
}

async function apiReachable(): Promise<boolean> {
  try {
    const res = await fetch(
      `${apiUrl}/public/experts/${encodeURIComponent(PAID_EXPERT)}`
    )
    return res.status > 0
  } catch {
    return false
  }
}

async function fetchSeededOffer(
  slug: string
): Promise<{ ok: boolean; modes: NonNullable<PublicOffer["modes"]> }> {
  try {
    const profile = await fetch(
      `${apiUrl}/public/experts/${encodeURIComponent(PAID_EXPERT)}`
    )
    if (!profile.ok) return { ok: false, modes: [] }
    const body = (await profile.json()) as { eventTypes?: PublicOffer[] }
    const offer = body.eventTypes?.find((et) => et.slug === slug)
    const modes = Array.isArray(offer?.modes) ? offer.modes : []
    return { ok: modes.length > 0, modes }
  } catch {
    return { ok: false, modes: [] }
  }
}

test.describe("expert offer — public funnel modes", () => {
  test.beforeEach(async () => {
    test.skip(
      process.env.CI === "true" && !process.env.DATABASE_URL,
      "e2e-smoke has no DATABASE_URL"
    )
    test.skip(!(await apiReachable()), "API unavailable (start local stack)")
  })

  test("seeded fisiomota / first-visit exposes an online delivery mode", async ({
    page,
  }) => {
    const seeded = await fetchSeededOffer(PAID_OFFER)
    expect(
      seeded.ok,
      "db:seed:demo must include fisiomota / first-visit with modes"
    ).toBe(true)
    expect(seeded.modes.some((m) => m.mode === "online")).toBe(true)

    const response = await page.goto(`/${PAID_EXPERT}/${PAID_OFFER}`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByTestId("booking-mode-cards")).toBeVisible()
    expect(
      await page.getByTestId("booking-mode-option").count()
    ).toBeGreaterThan(0)
  })

  test("seeded fisiomota / follow-up exposes multiple in-person modes", async ({
    page,
  }) => {
    const seeded = await fetchSeededOffer("follow-up")
    expect(
      seeded.ok,
      "db:seed:demo must include fisiomota / follow-up with modes"
    ).toBe(true)
    expect(
      seeded.modes.filter((m) => m.mode === "in_person").length
    ).toBeGreaterThanOrEqual(2)

    const response = await page.goto(`/${PAID_EXPERT}/follow-up`)
    expect(response?.status()).toBe(200)

    await expect(page.getByTestId("booking-mode-cards")).toBeVisible()
    expect(
      await page.getByTestId("booking-mode-option").count()
    ).toBeGreaterThanOrEqual(2)
  })
})

/**
 * UI-built Quick chat / Physiotherapy path (Phase 04B exit gate).
 * Requires an authenticated expert session on loopback:
 *   E2E_EXPERT_OFFER=1
 *   storageState or cookies already signed into the expert org
 *   (or navigate after manual login — Playwright uses the browser context).
 *
 * Does not invent Production e2e. Publish+public funnel for net-new UI-built
 * offers still needs Connect-ready billing; this suite asserts the builder
 * can create named schedules, locations, EU/PT presets, and mode rows that
 * match the reference fixtures.
 */
test.describe("expert offer — builder UI fixtures", () => {
  test.skip(
    !runBuilder,
    "set E2E_EXPERT_OFFER=1 with an authenticated expert session (loopback only)"
  )

  test.beforeEach(async () => {
    test.skip(!(await apiReachable()), "API unavailable (start local stack)")
  })

  test("event-types list loads for the seeded expert workspace", async ({
    page,
  }) => {
    const listUrl = `${expertUrl}/${expertOrgSlug}/event-types`
    const response = await page.goto(listUrl)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/${expertOrgSlug}/event-types`))
    await expect(page.getByTestId(`event-type-card-${PAID_OFFER}`)).toBeVisible(
      { timeout: 15_000 }
    )
    await expect(page.getByTestId(`mode-count-${PAID_OFFER}`)).toBeVisible()
  })

  test("modes panel exposes schedule, location, and country presets for fixtures", async ({
    page,
  }) => {
    const editUrl = `${expertUrl}/${expertOrgSlug}/event-types`
    const list = await page.goto(editUrl)
    expect(list?.status()).toBe(200)

    const card = page.getByTestId(`event-type-card-${PAID_OFFER}`)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.click()

    const modesTab = page.getByTestId("tab-modes")
    await expect(modesTab).toBeVisible({ timeout: 15_000 })
    await modesTab.click()
    await expect(page.getByTestId("event-type-modes")).toBeVisible({
      timeout: 15_000,
    })

    await page.getByTestId("add-delivery-mode").click()
    await expect(page.getByTestId("mode-form")).toBeVisible()
    await expect(page.getByTestId("mode-new-schedule")).toBeVisible()
    await expect(page.getByTestId("preset-all-countries")).toBeVisible()

    // Switch to phone / in_person to surface EU + location affordances.
    await page.getByTestId("mode-kind").click()
    await page.getByTestId("mode-kind-phone").click()
    await expect(page.getByTestId("preset-eu")).toBeVisible()

    await page.getByTestId("mode-kind").click()
    await page.getByTestId("mode-kind-in-person").click()
    await expect(page.getByTestId("mode-new-location")).toBeVisible()
  })

  test("can create a named Online schedule and an in-person location inline", async ({
    page,
  }) => {
    await openModesForm(page)

    const stamp = Date.now().toString(36)
    const scheduleName = `Online-ui-${stamp}`

    await page.getByTestId("mode-new-schedule").click()
    await page.getByTestId("new-schedule-name").fill(scheduleName)
    await page.getByTestId("save-new-schedule").click()
    await expect(page.getByTestId("mode-new-schedule-form")).toBeHidden({
      timeout: 15_000,
    })

    await page.getByTestId("mode-kind").click()
    await page.getByTestId("mode-kind-in-person").click()
    await page.getByTestId("mode-new-location").click()
    await page.getByTestId("new-location-name").fill(`Lisboa-ui-${stamp}`)
    await page.getByTestId("new-location-address").fill("Av. da Liberdade 100")
    await page.getByTestId("new-location-city").fill("Lisboa")
    await page.getByTestId("save-new-location").click()
    await expect(page.getByTestId("mode-new-location-form")).toBeHidden({
      timeout: 15_000,
    })
  })
})

async function openModesForm(page: Page) {
  const editUrl = `${expertUrl}/${expertOrgSlug}/event-types`
  const list = await page.goto(editUrl)
  expect(list?.status()).toBe(200)
  const card = page.getByTestId(`event-type-card-${PAID_OFFER}`)
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.click()

  const modesTab = page.getByTestId("tab-modes")
  await expect(modesTab).toBeVisible({ timeout: 15_000 })
  await modesTab.click()
  await expect(page.getByTestId("event-type-modes")).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId("add-delivery-mode").click()
  await expect(page.getByTestId("mode-form")).toBeVisible()
}
