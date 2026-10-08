import { expect, test } from "@playwright/test"
import { accountUrl } from "./helpers/auth"
import { appUrl, isNonLoopbackE2eTarget } from "./helpers/local"

const runLiveJoin = process.env.E2E_VIDEO_JOIN === "1"
const orgSlug = process.env.E2E_VIDEO_ORG_SLUG
const bookingId = process.env.E2E_VIDEO_BOOKING_ID
const memberEmail = process.env.E2E_VIDEO_MEMBER_EMAIL
const memberPassword = process.env.E2E_VIDEO_MEMBER_PASSWORD
const storageState = process.env.E2E_VIDEO_STORAGE_STATE

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
    "Set E2E_VIDEO_JOIN=1 E2E_VIDEO_ORG_SLUG E2E_VIDEO_BOOKING_ID and member credentials on loopback"
  )
  test.skip(
    isNonLoopbackE2eTarget(),
    "video join e2e must not run against non-loopback hosts"
  )

  if (storageState) {
    test.use({ storageState })
  }

  test("member join page reaches the ElevaCall prejoin UI", async ({
    page,
  }) => {
    if (!orgSlug || !bookingId) {
      throw new Error(
        "E2E_VIDEO_JOIN=1 requires E2E_VIDEO_ORG_SLUG and E2E_VIDEO_BOOKING_ID"
      )
    }
    if (!storageState) {
      if (!memberEmail || !memberPassword) {
        throw new Error(
          "E2E_VIDEO_JOIN=1 requires E2E_VIDEO_STORAGE_STATE or E2E_VIDEO_MEMBER_EMAIL and E2E_VIDEO_MEMBER_PASSWORD"
        )
      }
      await page.goto(`${accountUrl}/login`)
      await page.getByTestId("login-email").fill(memberEmail)
      await page.getByTestId("login-password").fill(memberPassword)
      const signedIn = page.waitForResponse(
        (response) =>
          response.url().includes("/auth/sign-in/email") && response.ok()
      )
      await page.getByTestId("login-submit").click()
      await signedIn
    }

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
