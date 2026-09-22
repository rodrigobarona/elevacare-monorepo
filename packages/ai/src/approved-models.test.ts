import { describe, expect, it } from "vitest"

import {
  AiModelNotApprovedError,
  AiModelZeroRetentionRequiredError,
  assertApprovedModel,
  requireZeroRetentionModel,
} from "./approved-models"

describe("assertApprovedModel", () => {
  it("returns a known model", () => {
    const model = assertApprovedModel("openai/gpt-4.1-mini")
    expect(model.provider).toBe("vercel-ai-gateway")
  })

  it("fails closed on unknown models", () => {
    expect(() => assertApprovedModel("evil/unknown")).toThrow(
      AiModelNotApprovedError
    )
  })
})

describe("requireZeroRetentionModel", () => {
  it("rejects non-zero-retention models (Phase 10 clinical gate)", () => {
    expect(() => requireZeroRetentionModel("openai/gpt-4.1-mini")).toThrow(
      AiModelZeroRetentionRequiredError
    )
  })
})
