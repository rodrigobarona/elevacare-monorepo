import { describe, expect, it } from "vitest"
import { buildCspHeader, CSP_ALLOWLIST } from "./csp"

describe("buildCspHeader", () => {
  it("emits kebab-cased directives separated by ; ", () => {
    const header = buildCspHeader()
    expect(header).toContain("script-src ")
    expect(header).toContain("connect-src ")
    expect(header).toContain("frame-ancestors ")
  })

  it("includes Stripe + Daily hosts in connect-src and frame-src", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/connect-src[^;]*api\.stripe\.com/)
    expect(header).toMatch(/frame-src[^;]*daily\.co/)
  })

  it("includes sentry ingest domains in connect-src", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/connect-src[^;]*sentry\.io/)
  })

  it("locks frame-ancestors to none by default", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/frame-ancestors 'none'/)
  })

  it("accepts overrides", () => {
    const header = buildCspHeader({ connectSrc: ["'self'"] })
    expect(header).toMatch(/connect-src 'self'/)
    // Stripe NOT present any more in this header.
    expect(header).not.toMatch(/connect-src[^;]*stripe\.com/)
  })

  it("exposes the underlying allowlist as a constant", () => {
    expect(CSP_ALLOWLIST.scriptSrc.length).toBeGreaterThan(0)
    expect(CSP_ALLOWLIST.connectSrc.length).toBeGreaterThan(0)
  })
})
