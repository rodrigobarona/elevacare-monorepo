import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const checkBotId = vi.hoisted(() => vi.fn())
vi.mock("botid/server", () => ({ checkBotId }))

import {
  checkBot,
  resolveBotIdMode,
  resolveExtraAllowedHosts,
} from "./bot-protection"

beforeEach(() => {
  checkBotId.mockReset()
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("resolveBotIdMode", () => {
  it("defaults to off for missing or unknown values", () => {
    expect(resolveBotIdMode(undefined)).toBe("off")
    expect(resolveBotIdMode("true")).toBe("off")
    expect(resolveBotIdMode("monitor")).toBe("monitor")
    expect(resolveBotIdMode("enforce")).toBe("enforce")
  })
})

describe("resolveExtraAllowedHosts", () => {
  it("splits and trims a comma list", () => {
    expect(resolveExtraAllowedHosts(" dev.eleva.care, eleva.care ,")).toEqual([
      "dev.eleva.care",
      "eleva.care",
    ])
    expect(resolveExtraAllowedHosts(undefined)).toEqual([])
  })
})

describe("checkBot", () => {
  it("skips the check entirely when off", async () => {
    vi.stubEnv("BOTID_MODE", "")
    expect(await checkBot({ enforceable: true })).toBeNull()
    expect(checkBotId).not.toHaveBeenCalled()
  })

  it("monitors without blocking", async () => {
    vi.stubEnv("BOTID_MODE", "monitor")
    checkBotId.mockResolvedValue({ isBot: true })
    expect(await checkBot({ enforceable: true })).toBeNull()
    expect(checkBotId).toHaveBeenCalledOnce()
  })

  it("enforces only on enforceable routes and passes allowed hosts", async () => {
    vi.stubEnv("BOTID_MODE", "enforce")
    vi.stubEnv("BOTID_EXTRA_ALLOWED_HOSTS", "dev.eleva.care")
    checkBotId.mockResolvedValue({ isBot: true })

    expect(
      await checkBot({ checkLevel: "deepAnalysis", enforceable: true })
    ).toEqual({ isBot: true })
    expect(checkBotId).toHaveBeenCalledWith({
      advancedOptions: {
        checkLevel: "deepAnalysis",
        extraAllowedHosts: ["dev.eleva.care"],
      },
    })
    expect(await checkBot()).toBeNull()
  })

  it("fails closed in enforce mode when the check throws", async () => {
    vi.stubEnv("BOTID_MODE", "enforce")
    checkBotId.mockRejectedValue(new Error("unavailable"))
    expect(await checkBot({ enforceable: true })).toEqual({ isBot: true })
    expect(await checkBot()).toBeNull()
  })
})
