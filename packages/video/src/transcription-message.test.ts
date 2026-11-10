import { describe, expect, it } from "vitest"
import {
  appendTranscriptLine,
  appendTranscriptMarker,
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

  it("names the speaker from Daily's participantId", () => {
    const line = parseTranscriptionMessage(
      { participantId: "sess-1", text: "Bom dia" },
      (id) => (id === "sess-1" ? "Ana" : null)
    )
    expect(line).toMatchObject({
      speaker: "Ana",
      text: "Bom dia",
      participantId: "sess-1",
    })
  })

  it("reads the detected language from Deepgram's raw result", () => {
    const line = parseTranscriptionMessage({
      participantId: "sess-1",
      text: "tomo ibuprofeno",
      rawResponse: {
        is_final: true,
        channel: {
          alternatives: [
            { languages: ["es"], languages_hinted: [], words: [] },
          ],
        },
      },
    })
    expect(line).toMatchObject({ language: "es", isFinal: true })
  })

  it("falls back to the most common word language", () => {
    const line = parseTranscriptionMessage({
      text: "dor de cabeça since Monday",
      rawResponse: {
        channel: {
          alternatives: [
            {
              words: [
                { word: "dor", language: "pt" },
                { word: "de", language: "pt" },
                { word: "cabeça", language: "pt" },
                { word: "since", language: "en" },
              ],
            },
          ],
        },
      },
    })
    expect(line?.language).toBe("pt")
  })

  it("skips Deepgram interim results", () => {
    const line = parseTranscriptionMessage({
      text: "tomo ibu",
      rawResponse: { is_final: false, channel: { alternatives: [{}] } },
    })
    expect(line?.isFinal).toBe(false)
  })
})

describe("appendTranscriptMarker", () => {
  it("adds a bracketed settings note on its own line", () => {
    expect(
      appendTranscriptMarker(
        "Ana: Hi",
        "Live transcript · language detected automatically · medical vocabulary"
      )
    ).toBe(
      "Ana: Hi\n[Live transcript · language detected automatically · medical vocabulary]"
    )
    expect(appendTranscriptMarker("", "Live transcript")).toBe(
      "[Live transcript]"
    )
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
