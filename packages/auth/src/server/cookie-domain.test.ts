import { afterEach, describe, expect, it } from "vitest"
import {
  crossSubDomainCookieConfig,
  defaultCookieDomain,
} from "./cookie-domain"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("defaultCookieDomain", () => {
  it("uses .dev.eleva.care for staging BETTER_AUTH_URL hosts", () => {
    expect(defaultCookieDomain("https://api.dev.eleva.care/auth")).toBe(
      ".dev.eleva.care"
    )
  })

  it("uses .eleva.care for production BETTER_AUTH_URL hosts", () => {
    expect(defaultCookieDomain("https://api.eleva.care/auth")).toBe(
      ".eleva.care"
    )
  })
})

describe("crossSubDomainCookieConfig", () => {
  it("uses ELEVA_COOKIE_DOMAIN on Vercel production", () => {
    process.env.ELEVA_COOKIE_DOMAIN = ".eleva.care"
    process.env.BETTER_AUTH_URL = "https://api.eleva.care/auth"
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
    delete process.env.BETTER_AUTH_URL
    process.env.VERCEL_ENV = "production"
    expect(crossSubDomainCookieConfig()).toEqual({
      enabled: true,
      domain: ".eleva.care",
    })
  })

  it("defaults to .dev.eleva.care when BETTER_AUTH_URL is staging", () => {
    delete process.env.ELEVA_COOKIE_DOMAIN
    process.env.BETTER_AUTH_URL = "https://api.dev.eleva.care/auth"
    process.env.VERCEL_ENV = "production"
    expect(crossSubDomainCookieConfig()).toEqual({
      enabled: true,
      domain: ".dev.eleva.care",
    })
  })

  it("overrides staging ELEVA_COOKIE_DOMAIN=.eleva.care to .dev.eleva.care", () => {
    process.env.ELEVA_COOKIE_DOMAIN = ".eleva.care"
    process.env.BETTER_AUTH_URL = "https://api.dev.eleva.care/auth"
    process.env.VERCEL_ENV = "production"
    expect(crossSubDomainCookieConfig()).toEqual({
      enabled: true,
      domain: ".dev.eleva.care",
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
