import { describe, expect, it } from "vitest"
import { describeUserAgent } from "./user-agent"

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      { browser: "Chrome", os: "macOS", kind: "computer" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      { browser: "Safari", os: "macOS", kind: "computer" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
      { browser: "Edge", os: "Windows", kind: "computer" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      { browser: "Safari", os: "iPhone", kind: "phone" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0 Mobile/15E148 Safari/604.1",
      { browser: "Chrome", os: "iPhone", kind: "phone" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome", os: "Android", kind: "phone" },
    ],
    [
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      { browser: "Firefox", os: "Linux", kind: "computer" },
    ],
  ])("names %s", (ua, expected) => {
    expect(describeUserAgent(ua)).toEqual(expected)
  })

  it("falls back to nulls for an unknown or missing agent", () => {
    expect(describeUserAgent("curl/8.7.1")).toEqual({
      browser: null,
      os: null,
      kind: "computer",
    })
    expect(describeUserAgent(null)).toEqual({
      browser: null,
      os: null,
      kind: "computer",
    })
  })
})
