import { afterEach, beforeEach, describe, expect, it } from "vitest"
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
    expect(CSP_ALLOWLIST.scriptSrc?.length).toBeGreaterThan(0)
    expect(CSP_ALLOWLIST.connectSrc?.length).toBeGreaterThan(0)
  })
})

describe("buildCspHeader - Vercel Live", () => {
  const originalEnv = process.env.VERCEL

  beforeEach(() => {
    process.env.VERCEL = "1"
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalEnv
    }
  })

  it("includes vercel.live in script-src on any Vercel deployment", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/script-src[^;]*https:\/\/vercel\.live/)
  })

  it("includes vercel.com in script-src on any Vercel deployment", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/script-src[^;]*https:\/\/vercel\.com/)
  })

  it("includes pusher websocket origin in connect-src", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/connect-src[^;]*wss:\/\/\*\.pusher\.com/)
    expect(header).toMatch(/connect-src[^;]*https:\/\/\*\.pusher\.com/)
  })

  it("includes vercel.live in connect-src, frame-src, img-src, font-src", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/connect-src[^;]*https:\/\/vercel\.live/)
    expect(header).toMatch(/frame-src[^;]*https:\/\/vercel\.live/)
    expect(header).toMatch(/img-src[^;]*https:\/\/vercel\.live/)
    expect(header).toMatch(/font-src[^;]*https:\/\/vercel\.live/)
  })

  it("includes assets.vercel.com in font-src", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/font-src[^;]*https:\/\/assets\.vercel\.com/)
  })

  it("includes vercel.com in style-src", () => {
    const header = buildCspHeader()
    expect(header).toMatch(/style-src[^;]*https:\/\/vercel\.com/)
  })
})

describe("buildCspHeader - off-Vercel deployments", () => {
  const originalEnv = process.env.VERCEL

  beforeEach(() => {
    delete process.env.VERCEL
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.VERCEL = originalEnv
    }
  })

  it("does NOT include vercel.live when not on Vercel", () => {
    const header = buildCspHeader()
    expect(header).not.toMatch(/script-src[^;]*vercel\.live/)
    expect(header).not.toMatch(/connect-src[^;]*pusher\.com/)
  })
})
