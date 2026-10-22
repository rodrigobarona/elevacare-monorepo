import { describe, expect, it } from "vitest"
import { resolveAllowedDevOrigins } from "./next-dev.mjs"

describe("resolveAllowedDevOrigins", () => {
  it("allows account and app loopback hosts used by Playwright", () => {
    const origins = resolveAllowedDevOrigins({})
    expect(origins).toContain("localhost")
    expect(origins).toContain("127.0.0.1")
    expect(origins).toContain("localhost:3000")
    expect(origins).toContain("127.0.0.1:3000")
    expect(origins).toContain("localhost:3001")
    expect(origins).toContain("localhost:3006")
    expect(origins).toContain("127.0.0.1:3006")
    expect(origins).toContain("localhost:3007")
    expect(origins).toContain("127.0.0.1:3007")
    expect(origins).toContain("localhost:3100")
    expect(origins).toContain("127.0.0.1:3102")
  })

  it("adds hosts from local app URLs without replacing the loopback set", () => {
    const origins = resolveAllowedDevOrigins({
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      ACCOUNT_URL: "http://127.0.0.1:3006",
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3102",
    })
    expect(origins).toContain("localhost:3100")
    expect(origins).toContain("127.0.0.1:3006")
    expect(origins).toContain("localhost:3006")
    expect(origins).toContain("127.0.0.1:3102")
  })
})
