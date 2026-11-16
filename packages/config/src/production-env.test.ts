import { describe, expect, it } from "vitest"
import { API_PRODUCTION_ENV, missingApiProductionEnv } from "./production-env"

function fullEnv(): Record<string, string> {
  return Object.fromEntries(
    API_PRODUCTION_ENV.map((names) => [names[0], "set"])
  )
}

describe("missingApiProductionEnv", () => {
  it("reports nothing when every entry is set", () => {
    expect(missingApiProductionEnv(fullEnv())).toEqual([])
  })

  it("names each missing or blank variable", () => {
    const env = fullEnv()
    delete env.API_URL
    env.RETENTION_PSEUDONYM_KEY = "  "
    expect(missingApiProductionEnv(env)).toEqual([
      "API_URL",
      "RETENTION_PSEUDONYM_KEY",
    ])
  })

  it("accepts an alternate name for the same entry", () => {
    const env: Record<string, string | undefined> = fullEnv()
    delete env.ACCOUNT_URL
    env.NEXT_PUBLIC_ACCOUNT_URL = "https://dev.eleva.care"
    delete env.TWILIO_MESSAGING_SERVICE_SID
    env.TWILIO_MESSAGE_SERVICE_SID = "MG123"
    expect(missingApiProductionEnv(env)).toEqual([])
  })
})
