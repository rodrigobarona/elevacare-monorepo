import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AiModelNotApprovedError,
  AiModelZeroRetentionRequiredError,
  GATEWAY_PROVIDER_OPTIONS,
} from "./approved-models"
import {
  assertZeroRetentionRoutingOptions,
  attestZeroRetentionEu,
  resetZeroRetentionAttestationCacheForTests,
} from "./zero-retention-attestation"

const MODEL = "openai/gpt-6-luna"

const listing = (endpoints: unknown[]) => ({
  ok: true,
  json: async () => ({ data: { endpoints } }),
})

const euZdr = {
  provider_name: "openai",
  has_zdr: true,
  inference_regions: [{ geo_region: "us" }, { geo_region: "eu" }],
}

beforeEach(() => {
  resetZeroRetentionAttestationCacheForTests()
})

describe("attestZeroRetentionEu", () => {
  it("passes when a ZDR provider serves the EU zone, and caches within the TTL", async () => {
    const fetchImpl = vi.fn(async () => listing([euZdr]))
    const first = await attestZeroRetentionEu(MODEL, { fetchImpl })
    expect(first).toMatchObject({ modelId: MODEL, provider: "openai" })
    await attestZeroRetentionEu(MODEL, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("re-checks after the TTL", async () => {
    const fetchImpl = vi.fn(async () => listing([euZdr]))
    const now = new Date("2026-10-22T10:00:00.000Z")
    await attestZeroRetentionEu(MODEL, { fetchImpl, now, ttlMs: 1000 })
    await attestZeroRetentionEu(MODEL, {
      fetchImpl,
      now: new Date(now.getTime() + 2000),
      ttlMs: 1000,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("fails closed when no endpoint has both ZDR and EU inference", async () => {
    const noEu = {
      provider_name: "bedrock",
      has_zdr: true,
      inference_regions: [{ geo_region: "us" }],
    }
    const noZdr = {
      provider_name: "azure",
      has_zdr: false,
      inference_regions: [{ geo_region: "eu" }],
    }
    await expect(
      attestZeroRetentionEu(MODEL, {
        fetchImpl: async () => listing([noEu, noZdr]),
      })
    ).rejects.toBeInstanceOf(AiModelZeroRetentionRequiredError)
  })

  it("fails closed on gateway outage, HTTP error, and malformed payloads", async () => {
    await expect(
      attestZeroRetentionEu(MODEL, {
        fetchImpl: async () => {
          throw new Error("network down")
        },
      })
    ).rejects.toBeInstanceOf(AiModelZeroRetentionRequiredError)
    await expect(
      attestZeroRetentionEu(MODEL, {
        fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
      })
    ).rejects.toBeInstanceOf(AiModelZeroRetentionRequiredError)
    await expect(
      attestZeroRetentionEu(MODEL, {
        fetchImpl: async () => ({ ok: true, json: async () => "nope" }),
      })
    ).rejects.toBeInstanceOf(AiModelZeroRetentionRequiredError)
  })

  it("refuses models that are not on the allow-list", async () => {
    await expect(
      attestZeroRetentionEu("unknown/model", {
        fetchImpl: async () => listing([euZdr]),
      })
    ).rejects.toBeInstanceOf(AiModelNotApprovedError)
  })
})

describe("assertZeroRetentionRoutingOptions", () => {
  it("accepts the production gateway options", () => {
    expect(() =>
      assertZeroRetentionRoutingOptions(GATEWAY_PROVIDER_OPTIONS)
    ).not.toThrow()
  })

  it.each([
    ["missing", {}],
    [
      "zdr off",
      {
        gateway: {
          ...GATEWAY_PROVIDER_OPTIONS.gateway,
          zeroDataRetention: false,
        },
      },
    ],
    [
      "non-EU region",
      {
        gateway: {
          zeroDataRetention: true,
          inferenceRegion: { scope: "zone", geoRegion: "us" },
        },
      },
    ],
    ["no region", { gateway: { zeroDataRetention: true } }],
  ])("rejects %s", (_name, options) => {
    expect(() => assertZeroRetentionRoutingOptions(options)).toThrow(
      AiModelZeroRetentionRequiredError
    )
  })
})
