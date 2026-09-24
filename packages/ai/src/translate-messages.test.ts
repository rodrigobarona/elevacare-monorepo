import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AiTranslateMessagesEmptyError,
  AiTranslateMessagesParseError,
  buildTranslateMessagesPrompt,
  projectToSourceShape,
  translateMessages,
} from "./translate-messages"
import { AiModelNotApprovedError } from "./approved-models"
import { AiModelEnvMissingError } from "./editor-assist"

describe("projectToSourceShape", () => {
  it("keeps only source keys from the model output", () => {
    expect(
      projectToSourceShape(
        { a: "A", nest: { b: "B" } },
        { a: "Á", nest: { b: "Ḃ", extra: "x" }, extra: "y" }
      )
    ).toEqual({ a: "Á", nest: { b: "Ḃ" } })
  })
})

describe("buildTranslateMessagesPrompt", () => {
  it("includes glossary terms and locales", () => {
    const prompt = buildTranslateMessagesPrompt({
      sourceLocale: "en",
      targetLocales: ["pt"],
      targetLocale: "pt",
      messages: { nav: { dashboard: "Dashboard" } },
      glossary: { members: "members" },
    })
    expect(prompt).toContain("Source locale: en")
    expect(prompt).toContain("Target locale: pt")
    expect(prompt).toContain('"members" → keep as "members"')
    expect(prompt).toContain("Dashboard")
  })
})

describe("translateMessages", () => {
  afterEach(() => {
    delete process.env.AI_GATEWAY_MODEL_EDITOR
    vi.clearAllMocks()
  })

  it("rejects an empty messages tree", async () => {
    await expect(
      translateMessages({
        sourceLocale: "en",
        targetLocales: ["pt"],
        messages: {},
      })
    ).rejects.toThrow(AiTranslateMessagesEmptyError)
  })

  it("fails closed when the editor model env is missing", async () => {
    await expect(
      translateMessages(
        {
          sourceLocale: "en",
          targetLocales: ["pt"],
          messages: { hello: "Hello" },
        },
        { env: {} }
      )
    ).rejects.toThrow(AiModelEnvMissingError)
  })

  it("fails closed on an unapproved model", async () => {
    await expect(
      translateMessages(
        {
          sourceLocale: "en",
          targetLocales: ["pt"],
          messages: { hello: "Hello" },
        },
        { env: { AI_GATEWAY_MODEL_EDITOR: "evil/unknown" } }
      )
    ).rejects.toThrow(AiModelNotApprovedError)
  })

  it("parses model JSON into a message tree per locale", async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify({ hello: "Olá" }),
    }))

    const result = await translateMessages(
      {
        sourceLocale: "en",
        targetLocales: ["pt"],
        messages: { hello: "Hello" },
      },
      {
        env: { AI_GATEWAY_MODEL_EDITOR: "openai/gpt-4.1-mini" },
        generate: generate as never,
      }
    )

    expect(result).toEqual({ pt: { hello: "Olá" } })
    expect(generate).toHaveBeenCalledOnce()
  })

  it("accepts fenced JSON from the model", async () => {
    const generate = vi.fn(async () => ({
      text: '```json\n{"hello":"Hola"}\n```',
    }))

    const result = await translateMessages(
      {
        sourceLocale: "en",
        targetLocales: ["es"],
        messages: { hello: "Hello" },
      },
      {
        env: { AI_GATEWAY_MODEL_EDITOR: "openai/gpt-4.1-mini" },
        generate: generate as never,
      }
    )

    expect(result).toEqual({ es: { hello: "Hola" } })
  })

  it("throws when the model omits a source key", async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify({ other: "x" }),
    }))

    await expect(
      translateMessages(
        {
          sourceLocale: "en",
          targetLocales: ["pt"],
          messages: { hello: "Hello" },
        },
        {
          env: { AI_GATEWAY_MODEL_EDITOR: "openai/gpt-4.1-mini" },
          generate: generate as never,
        }
      )
    ).rejects.toThrow(AiTranslateMessagesParseError)
  })

  it("throws when the model returns non-JSON", async () => {
    const generate = vi.fn(async () => ({ text: "not json" }))

    await expect(
      translateMessages(
        {
          sourceLocale: "en",
          targetLocales: ["pt"],
          messages: { hello: "Hello" },
        },
        {
          env: { AI_GATEWAY_MODEL_EDITOR: "openai/gpt-4.1-mini" },
          generate: generate as never,
        }
      )
    ).rejects.toThrow(AiTranslateMessagesParseError)
  })
})
