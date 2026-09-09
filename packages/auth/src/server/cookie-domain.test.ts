import { afterEach, describe, expect, it } from "vitest"
import { crossSubDomainCookieConfig } from "./cookie-domain"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("crossSubDomainCookieConfig", () => {
  it("uses ELEVA_COOKIE_DOMAIN on Vercel production", () => {
    process.env.ELEVA_COOKIE_DOMAIN = ".eleva.care"
    process.env.VERCEL_ENV = "production"
    expect(crossSubDomainCookieConfig()).toEqual({
      enabled: true,
      domain: ".eleva.care",
    })
  })

  it("ignores ELEVA_COOKIE_DOMAIN on preview", () => {
    process.env.ELEVA_COOKIE_DOMAIN = ".eleva.care"
    process.env.VERCEL_ENV = "preview"
    expect(crossSubDomainCookieConfig()).toEqual({ enabled: false })
  })

  it("defaults to .eleva.care on Vercel production", () => {
    delete process.env.ELEVA_COOKIE_DOMAIN
    process.env.VERCEL_ENV = "production"
    expect(crossSubDomainCookieConfig()).toEqual({
      enabled: true,
      domain: ".eleva.care",
    })
  })

  it("stays host-only on Vercel preview unless ELEVA_COOKIE_DOMAIN is set", () => {
    delete process.env.ELEVA_COOKIE_DOMAIN
    process.env.VERCEL_ENV = "preview"
    expect(crossSubDomainCookieConfig()).toEqual({ enabled: false })
  })

  it("stays host-only on local so Playwright cookies stick", () => {
    delete process.env.ELEVA_COOKIE_DOMAIN
    delete process.env.VERCEL_ENV
    expect(crossSubDomainCookieConfig()).toEqual({ enabled: false })
  })
})
