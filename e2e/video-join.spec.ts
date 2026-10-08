import { expect, test } from "@playwright/test"
import { appUrl, isNonLoopbackE2eTarget } from "./helpers/local"

const runLiveJoin = process.env.E2E_VIDEO_JOIN === "1"
const orgSlug = process.env.E2E_VIDEO_ORG_SLUG
const bookingId = process.env.E2E_VIDEO_BOOKING_ID

test.describe("video join — fake media devices", () => {
  test("Chromium exposes fake camera and microphone", async ({ page }) => {
    await page.goto("/")
    const kinds = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      const tracks = stream.getTracks().map((track) => track.kind)
      for (const track of stream.getTracks()) track.stop()
      return tracks
    })
    expect(kinds).toContain("audio")
    expect(kinds).toContain("video")
  })
})

test.describe("video join — Eleva prejoin", () => {
  test.skip(
    !runLiveJoin,
    "Set E2E_VIDEO_JOIN=1 E2E_VIDEO_ORG_SLUG E2E_VIDEO_BOOKING_ID with a signed-in member session on loopback"
  )
  test.skip(
    isNonLoopbackE2eTarget(),
    "video join e2e must not run against non-loopback hosts"
  )
  test.skip(
    !orgSlug || !bookingId,
    "E2E_VIDEO_ORG_SLUG and E2E_VIDEO_BOOKING_ID are required"
  )

  test("member join page reaches the ElevaCall prejoin UI", async ({
    page,
  }) => {
    const response = await page.goto(
      `${appUrl}/${orgSlug}/sessions/${bookingId}/join`
    )
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId("eleva-call")).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByTestId("eleva-call-prejoin")).toBeVisible()
  })
})
