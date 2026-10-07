import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { buildAdminRedirect } from "./gateway-dispatch"

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"))
}

describe("buildAdminRedirect", () => {
  const originalAdminUrl = process.env.ADMIN_URL

  beforeEach(() => {
    process.env.ADMIN_URL = "http://localhost:3007"
  })

  afterEach(() => {
    if (originalAdminUrl === undefined) {
      delete process.env.ADMIN_URL
    } else {
      process.env.ADMIN_URL = originalAdminUrl
    }
  })

  it("redirects /admin to admin origin root", () => {
    const req = makeRequest("http://localhost:3000/admin")
    const res = buildAdminRedirect(req)
    expect(res.headers.get("location")).toBe("http://localhost:3007/")
  })

  it("strips /admin prefix for nested paths", () => {
    const req = makeRequest("http://localhost:3000/admin/payments?tab=open")
    const res = buildAdminRedirect(req)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3007/payments?tab=open"
    )
  })
})
