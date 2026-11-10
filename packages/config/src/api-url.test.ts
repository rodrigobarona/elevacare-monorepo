import { describe, expect, it } from "vitest"
import { secureApiBaseUrl } from "./api-url"

describe("secureApiBaseUrl", () => {
  it("accepts HTTPS and a loopback HTTP API", () => {
    expect(secureApiBaseUrl("https://api.eleva.care")).toBe(
      "https://api.eleva.care"
    )
    expect(secureApiBaseUrl("http://localhost:3002")).toBe(
      "http://localhost:3002"
    )
  })

  it("refuses plain HTTP to a remote host, and missing or bad URLs", () => {
    expect(() => secureApiBaseUrl("http://api.eleva.care")).toThrow(/HTTPS/)
    expect(() => secureApiBaseUrl("")).toThrow(/required/)
    expect(() => secureApiBaseUrl("not a url")).toThrow(/valid/)
  })
})
