import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FLAG_CATALOG } from "./catalog"

describe("getFlag", () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the catalog default when EDGE_CONFIG is not set", async () => {
    vi.doMock("@eleva/config/env", () => ({
      env: () => ({ EDGE_CONFIG: "" }),
    }))
    vi.doMock("@vercel/edge-config", () => ({
      get: vi.fn().mockResolvedValue(true),
    }))
    const { getFlag } = await import("./client")
    expect(await getFlag("ff.three_party_revenue")).toBe(
      FLAG_CATALOG["ff.three_party_revenue"].default
    )
  })

  it("returns Edge Config value when present and boolean", async () => {
    vi.doMock("@eleva/config/env", () => ({
      env: () => ({ EDGE_CONFIG: "https://edge-config.vercel.com/xyz" }),
    }))
    vi.doMock("@vercel/edge-config", () => ({
      get: vi.fn().mockResolvedValue(true),
    }))
    const { getFlag } = await import("./client")
    expect(await getFlag("ff.three_party_revenue")).toBe(true)
  })

  it("falls back to catalog default when Edge Config throws", async () => {
    vi.doMock("@eleva/config/env", () => ({
      env: () => ({ EDGE_CONFIG: "https://edge-config.vercel.com/xyz" }),
    }))
    vi.doMock("@vercel/edge-config", () => ({
      get: vi.fn().mockRejectedValue(new Error("offline")),
    }))
    const { getFlag } = await import("./client")
    expect(await getFlag("ff.ai_reports_beta")).toBe(false)
  })

  it("falls back to default when Edge Config returns undefined", async () => {
    vi.doMock("@eleva/config/env", () => ({
      env: () => ({ EDGE_CONFIG: "https://edge-config.vercel.com/xyz" }),
    }))
    vi.doMock("@vercel/edge-config", () => ({
      get: vi.fn().mockResolvedValue(undefined),
    }))
    const { getFlag } = await import("./client")
    expect(await getFlag("ff.clinic_subscription_tiers")).toBe(true)
  })

  it("getAllFlags returns every catalog flag", async () => {
    vi.doMock("@eleva/config/env", () => ({
      env: () => ({ EDGE_CONFIG: "" }),
    }))
    vi.doMock("@vercel/edge-config", () => ({
      get: vi.fn(),
    }))
    const { getAllFlags } = await import("./client")
    const result = await getAllFlags()
    expect(Object.keys(result).sort()).toEqual(Object.keys(FLAG_CATALOG).sort())
  })
})
