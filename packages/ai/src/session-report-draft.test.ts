import { describe, expect, it, vi } from "vitest"
import * as approvedModels from "./approved-models"
import {
  AiModelNotApprovedError,
  AiModelZeroRetentionRequiredError,
} from "./approved-models"
import { AiModelEnvMissingError } from "./editor-assist"
import {
  generateSessionReportDraft,
  resolveSessionReportModelId,
} from "./session-report-draft"

describe("resolveSessionReportModelId", () => {
  it("requires AI_GATEWAY_MODEL_SESSION_REPORT", () => {
    expect(() => resolveSessionReportModelId({})).toThrow(
      AiModelEnvMissingError
    )
  })

  it("fails closed when the configured model lacks zero retention", () => {
    expect(() =>
      resolveSessionReportModelId({
        AI_GATEWAY_MODEL_SESSION_REPORT: "openai/gpt-4.1-mini",
      })
    ).toThrow(AiModelZeroRetentionRequiredError)
  })

  it("fails closed for unknown models", () => {
    expect(() =>
      resolveSessionReportModelId({
        AI_GATEWAY_MODEL_SESSION_REPORT: "unknown/model",
      })
    ).toThrow(AiModelNotApprovedError)
  })
})

describe("generateSessionReportDraft", () => {
  it("maps mocked gateway output into composer body text", async () => {
    process.env.AI_GATEWAY_MODEL_SESSION_REPORT = "openai/zdr-fixture"
    vi.spyOn(approvedModels, "requireZeroRetentionModel").mockReturnValue({
      modelId: "openai/zdr-fixture",
      provider: "vercel-ai-gateway",
      zeroRetention: true,
      evidenceUrl: "https://example.test/zdr",
    })

    const generateObject = vi.fn().mockResolvedValue({
      object: {
        summary: "Summary",
        observations: ["One"],
        recommendations: ["Rest"],
        followUpQuestions: [],
        redFlags: [],
        disclaimer: "Draft only.",
      },
      usage: { inputTokens: 10, outputTokens: 20 },
    })

    const result = await generateSessionReportDraft(
      { locale: "en", noteTexts: ["Note body"] },
      { generateObject }
    )

    expect(result.body).toContain("## Recommendations")
    expect(result.promptVersion).toBe("session-report.v1")
    expect(generateObject).toHaveBeenCalledOnce()
  })
})
