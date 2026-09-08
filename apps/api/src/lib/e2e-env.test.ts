import { afterEach, describe, expect, it } from "vitest"
import {
  assertE2eBypassNotInProduction,
  isE2eAuthBypassMounted,
} from "./e2e-env"

const originalEnv = process.env.VERCEL_ENV
const originalToken = process.env.E2E_AUTH_BYPASS_TOKEN

afterEach(() => {
  if (originalEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalEnv
  if (originalToken === undefined) delete process.env.E2E_AUTH_BYPASS_TOKEN
  else process.env.E2E_AUTH_BYPASS_TOKEN = originalToken
})

describe("e2e auth bypass guards", () => {
  it("is not mounted when VERCEL_ENV is production", () => {
    process.env.VERCEL_ENV = "production"
    process.env.E2E_AUTH_BYPASS_TOKEN = "secret"
    expect(isE2eAuthBypassMounted()).toBe(false)
  })

  it("throws at startup when the token is present in production", () => {
    process.env.VERCEL_ENV = "production"
    process.env.E2E_AUTH_BYPASS_TOKEN = "secret"
    expect(() => assertE2eBypassNotInProduction()).toThrow(
      /E2E_AUTH_BYPASS_TOKEN/
    )
  })

  it("mounts only in non-production when a token is set", () => {
    process.env.VERCEL_ENV = "preview"
    process.env.E2E_AUTH_BYPASS_TOKEN = "secret"
    expect(isE2eAuthBypassMounted()).toBe(true)
  })
})
