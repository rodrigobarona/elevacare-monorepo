import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AiClinicalContextRejectedError,
  AiModelEnvMissingError,
  AiTranslateLocaleRequiredError,
  assertEditorAssistInput,
  buildEditorAssistPrompt,
  editorAssist,
  resolveEditorModelId,
} from "./editor-assist"
import { AiModelNotApprovedError } from "./approved-models"

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toTextStreamResponse: () => new Response("ok"),
  })),
}))

describe("resolveEditorModelId", () => {
  afterEach(() => {
    delete process.env.AI_GATEWAY_MODEL_EDITOR
  })

  it("returns an allow-listed pinned model", () => {
    process.env.AI_GATEWAY_MODEL_EDITOR = "openai/gpt-4.1-mini"
    expect(resolveEditorModelId()).toBe("openai/gpt-4.1-mini")
  })

  it("fails closed when the env var is missing", () => {
    expect(() => resolveEditorModelId({})).toThrow(AiModelEnvMissingError)
  })

  it("fails closed on unknown models", () => {
    expect(() =>
      resolveEditorModelId({ AI_GATEWAY_MODEL_EDITOR: "evil/unknown" })
    ).toThrow(AiModelNotApprovedError)
  })
})

describe("assertEditorAssistInput", () => {
  it("rejects clinical context until Phase 10", () => {
    expect(() =>
      assertEditorAssistInput({
        command: "improve",
        text: "hello",
        context: "clinical",
      })
    ).toThrow(AiClinicalContextRejectedError)
  })

  it("requires locales for translate", () => {
    expect(() =>
      assertEditorAssistInput({
        command: "translate",
        text: "hello",
        context: "marketing",
      })
    ).toThrow(AiTranslateLocaleRequiredError)
  })
})

describe("buildEditorAssistPrompt", () => {
  it("includes command instructions and never invents clinical claims", () => {
    const prompt = buildEditorAssistPrompt({
      command: "shorten",
      text: "A long bio about physiotherapy.",
      context: "marketing",
      sourceLocale: "en",
    })
    expect(prompt).toContain("Shorten the text")
    expect(prompt).toContain("A long bio about physiotherapy.")
    expect(prompt).toContain("members")
    expect(prompt).toContain("Do not invent clinical claims")
  })

  it("includes source and target locales for translate", () => {
    const prompt = buildEditorAssistPrompt({
      command: "translate",
      text: "Hello",
      context: "marketing",
      sourceLocale: "en",
      targetLocale: "pt",
    })
    expect(prompt).toContain("Source locale: en")
    expect(prompt).toContain("Target locale: pt")
  })
})

describe("editorAssist", () => {
  afterEach(() => {
    delete process.env.AI_GATEWAY_MODEL_EDITOR
    vi.clearAllMocks()
  })

  it("streams after allow-list checks pass", async () => {
    process.env.AI_GATEWAY_MODEL_EDITOR = "openai/gpt-4.1-mini"
    const { streamText } = await import("ai")
    editorAssist({
      command: "improve",
      text: "Draft bio",
      context: "marketing",
    })
    expect(streamText).toHaveBeenCalledOnce()
    expect(vi.mocked(streamText).mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-4.1-mini",
    })
  })

  it("never calls the gateway for clinical context", async () => {
    process.env.AI_GATEWAY_MODEL_EDITOR = "openai/gpt-4.1-mini"
    const { streamText } = await import("ai")
    expect(() =>
      editorAssist({
        command: "improve",
        text: "clinical note",
        context: "clinical",
      })
    ).toThrow(AiClinicalContextRejectedError)
    expect(streamText).not.toHaveBeenCalled()
  })

  it("never calls the gateway for an unapproved model", async () => {
    process.env.AI_GATEWAY_MODEL_EDITOR = "evil/unknown"
    const { streamText } = await import("ai")
    expect(() =>
      editorAssist({
        command: "improve",
        text: "Draft bio",
        context: "marketing",
      })
    ).toThrow(AiModelNotApprovedError)
    expect(streamText).not.toHaveBeenCalled()
  })
})
