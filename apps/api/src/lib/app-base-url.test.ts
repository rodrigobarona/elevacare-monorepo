import { describe, expect, it } from "vitest"
import { appBaseUrl } from "./app-base-url"

describe("appBaseUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL and drops trailing slashes", () => {
    expect(
      appBaseUrl({
        NEXT_PUBLIC_APP_URL: "https://dev.eleva.care/",
        APP_URL: "https://other.example",
      })
    ).toBe("https://dev.eleva.care")
  })

  it("falls through a blank NEXT_PUBLIC_APP_URL to APP_URL", () => {
    expect(
      appBaseUrl({ NEXT_PUBLIC_APP_URL: "", APP_URL: "https://dev.eleva.care" })
    ).toBe("https://dev.eleva.care")
  })

  it("defaults to eleva.care when neither is set", () => {
    expect(appBaseUrl({})).toBe("https://eleva.care")
  })
})
