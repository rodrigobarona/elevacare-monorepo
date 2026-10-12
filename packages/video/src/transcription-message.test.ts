import { describe, expect, it } from "vitest"
import {
  appendTranscriptLine,
  parseTranscriptionMessage,
} from "./client/transcription-message"

describe("parseTranscriptionMessage", () => {
  it("reads nested Daily data payloads", () => {
    expect(
      parseTranscriptionMessage({
        action: "transcription-message",
        data: {
          text: "Hello there",
          user_name: "Ana",
          is_final: true,
        },
      })
    ).toEqual({ speaker: "Ana", text: "Hello there", isFinal: true })
  })

  it("treats missing final flag as final so we do not drop lines", () => {
    expect(
      parseTranscriptionMessage({ text: "Hi", userName: "Expert" })
    ).toEqual({ speaker: "Expert", text: "Hi", isFinal: true })
  })

  it("ignores empty text", () => {
    expect(parseTranscriptionMessage({ data: { text: "  " } })).toBeNull()
    expect(parseTranscriptionMessage(null)).toBeNull()
  })
})

describe("appendTranscriptLine", () => {
  it("joins speakers as a raw transcript", () => {
    const first = appendTranscriptLine("", {
      speaker: "Ana",
      text: "Hi",
      isFinal: true,
    })
    expect(
      appendTranscriptLine(first, {
        speaker: "Expert",
        text: "Hello",
        isFinal: true,
      })
    ).toBe("Ana: Hi\nExpert: Hello")
  })
})
