import { describe, expect, it } from "vitest"
import { parseCliEnv, truncateRoleDescription } from "./workos-api.js"

describe("parseCliEnv", () => {
  it("defaults to staging when --env is omitted", () => {
    expect(parseCliEnv([])).toBe("staging")
  })

  it("accepts staging, production, and development", () => {
    expect(parseCliEnv(["--env=staging"])).toBe("staging")
    expect(parseCliEnv(["--env=production"])).toBe("production")
    expect(parseCliEnv(["--env=development"])).toBe("development")
  })

  it("normalizes prod and dev aliases", () => {
    expect(parseCliEnv(["--env=prod"])).toBe("production")
    expect(parseCliEnv(["--env=dev"])).toBe("development")
  })

  it("throws on invalid environment values", () => {
    expect(() => parseCliEnv(["--env=prodution"])).toThrow(/Invalid --env=/)
    expect(() => parseCliEnv(["--env=local"])).toThrow(/Invalid --env=/)
  })
})

describe("truncateRoleDescription", () => {
  it("passes through descriptions within the limit", () => {
    expect(truncateRoleDescription("short")).toBe("short")
  })

  it("truncates descriptions over 150 characters", () => {
    const long = "a".repeat(160)
    const result = truncateRoleDescription(long)
    expect(result!.length).toBe(150)
    expect(result!.endsWith("…")).toBe(true)
  })
})
