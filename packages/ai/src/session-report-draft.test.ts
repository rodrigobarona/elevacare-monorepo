import { describe, expect, it, vi } from "vitest"
import { AiModelNotApprovedError } from "./approved-models"
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

  it("fails closed when the configured model is not on the EU zero-retention allow-list", () => {
    expect(() =>
      resolveSessionReportModelId({
        AI_GATEWAY_MODEL_SESSION_REPORT: "openai/gpt-4.1-mini",
      })
    ).toThrow(AiModelNotApprovedError)
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
    process.env.AI_GATEWAY_MODEL_SESSION_REPORT = "openai/gpt-6-luna"

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
