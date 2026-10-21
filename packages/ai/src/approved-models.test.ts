import { describe, expect, it } from "vitest"

import {
  AiModelNotApprovedError,
  GATEWAY_PROVIDER_OPTIONS,
  assertApprovedModel,
} from "./approved-models"

describe("assertApprovedModel", () => {
  it("returns a known model", () => {
    const model = assertApprovedModel("openai/gpt-6-luna")
    expect(model.provider).toBe("vercel-ai-gateway")
  })

  it("fails closed on unknown models", () => {
    expect(() => assertApprovedModel("evil/unknown")).toThrow(
      AiModelNotApprovedError
    )
  })

  it("rejects the previous model, which has no EU inference", () => {
    expect(() => assertApprovedModel("openai/gpt-4.1-mini")).toThrow(
      AiModelNotApprovedError
    )
  })
})

describe("GATEWAY_PROVIDER_OPTIONS", () => {
  it("requires zero data retention and EU inference on every call", () => {
    expect(GATEWAY_PROVIDER_OPTIONS).toEqual({
      gateway: {
        zeroDataRetention: true,
        inferenceRegion: { scope: "zone", geoRegion: "eu" },
      },
    })
  })
})
