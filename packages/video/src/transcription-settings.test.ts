import { describe, expect, it } from "vitest"
import {
  DETECTED_LANGUAGE_WINDOW,
  ENGLISH_SUGGESTION_MIN_LINES,
  detectsLanguage,
  dominantLanguage,
  initialModelTier,
  isAlreadyRunningError,
  isMedicalModel,
  legacyLanguageCode,
  nextModelTier,
  primaryLanguage,
  rememberLanguage,
  runDailyMethod,
  suggestsEnglishOnly,
  transcriptionOptions,
} from "./client/transcription-settings"

describe("transcriptionOptions", () => {
  it("defaults to the medical model detecting the language, in the EU", () => {
    expect(
      transcriptionOptions({
        mode: "auto",
        tier: "medical",
        sessionLanguage: "pt",
      })
    ).toEqual({
      transcription_geo: "eu",
      model: "nova-3-medical",
      language: "multi",
      punctuate: true,
      includeRawResponse: true,
    })
  })

  it("never sends a language hint to the medical model", () => {
    const options = transcriptionOptions({
      mode: "auto",
      tier: "medical",
      sessionLanguage: "es",
    })
    expect(options.extra).toBeUndefined()
  })

  it("uses the medical English model for English only", () => {
    expect(
      transcriptionOptions({
        mode: "english",
        tier: "medical",
        sessionLanguage: "pt",
      })
    ).toMatchObject({ model: "nova-3-medical", language: "en" })
  })

  it("hints the booked language on the general model", () => {
    expect(
      transcriptionOptions({
        mode: "auto",
        tier: "general",
        sessionLanguage: "pl-PL",
      })
    ).toMatchObject({
      model: "nova-3",
      language: "multi",
      extra: { language_hint: "pl" },
    })
  })

  it("drops hints Deepgram would reject", () => {
    const options = transcriptionOptions({
      mode: "auto",
      tier: "general",
      sessionLanguage: "eo",
    })
    expect(options).toMatchObject({ model: "nova-3", language: "multi" })
    expect(options.extra).toBeUndefined()
  })

  it("pins the legacy model to European Portuguese", () => {
    expect(
      transcriptionOptions({
        mode: "auto",
        tier: "legacy",
        sessionLanguage: "pt",
      })
    ).toMatchObject({ model: "nova-2", language: "pt-PT" })
    expect(
      transcriptionOptions({
        mode: "english",
        tier: "legacy",
        sessionLanguage: "pt",
      })
    ).toMatchObject({ model: "nova-2", language: "en" })
  })
})

describe("model tiers", () => {
  it("starts on the medical model for the languages it covers", () => {
    expect(initialModelTier("pt")).toBe("medical")
    expect(initialModelTier("es")).toBe("medical")
    expect(initialModelTier("en-GB")).toBe("medical")
    expect(initialModelTier(null)).toBe("medical")
  })

  it("uses the general model for other languages it can hint", () => {
    expect(initialModelTier("pl")).toBe("general")
    expect(initialModelTier("sv")).toBe("general")
  })

  it("falls back to the legacy model for anything else", () => {
    expect(initialModelTier("eo")).toBe("legacy")
  })

  it("steps down medical → general → legacy → none", () => {
    expect(nextModelTier("medical")).toBe("general")
    expect(nextModelTier("general")).toBe("legacy")
    expect(nextModelTier("legacy")).toBeNull()
  })

  it("recognises the medical model in Daily's started event", () => {
    expect(isMedicalModel("nova-3-medical")).toBe(true)
    expect(isMedicalModel("nova-3")).toBe(false)
    expect(isMedicalModel(undefined)).toBe(false)
  })
})

describe("language helpers", () => {
  it("reads the primary subtag", () => {
    expect(primaryLanguage("pt-PT")).toBe("pt")
    expect(primaryLanguage(" ES ")).toBe("es")
    expect(primaryLanguage("")).toBeNull()
    expect(primaryLanguage(42)).toBeNull()
  })

  it("defaults the legacy language to European Portuguese", () => {
    expect(legacyLanguageCode(null)).toBe("pt-PT")
    expect(legacyLanguageCode("es")).toBe("es")
  })

  it("only detects languages on multi models", () => {
    expect(detectsLanguage({ mode: "auto", tier: "medical" })).toBe(true)
    expect(detectsLanguage({ mode: "auto", tier: "general" })).toBe(true)
    expect(detectsLanguage({ mode: "auto", tier: "legacy" })).toBe(false)
    expect(detectsLanguage({ mode: "english", tier: "medical" })).toBe(false)
  })

  it("keeps a short window of recent languages", () => {
    let recent: string[] = []
    for (let i = 0; i < DETECTED_LANGUAGE_WINDOW + 3; i += 1) {
      recent = rememberLanguage(recent, i % 2 ? "en" : "pt")
    }
    expect(recent).toHaveLength(DETECTED_LANGUAGE_WINDOW)
  })

  it("shows the most frequent recent language", () => {
    expect(dominantLanguage(["pt", "pt", "en"])).toBe("pt")
    expect(dominantLanguage(["pt", "en"])).toBe("en")
    expect(dominantLanguage([])).toBeNull()
  })

  it("suggests English only after a run of English lines", () => {
    const english = Array.from(
      { length: ENGLISH_SUGGESTION_MIN_LINES },
      () => "en"
    )
    const auto = { mode: "auto", tier: "medical" } as const
    expect(suggestsEnglishOnly(auto, english)).toBe(true)
    expect(suggestsEnglishOnly(auto, english.slice(1))).toBe(false)
    expect(suggestsEnglishOnly(auto, [...english.slice(1), "pt"])).toBe(false)
    expect(
      suggestsEnglishOnly({ mode: "english", tier: "medical" }, english)
    ).toBe(false)
  })
})

describe("runDailyMethod", () => {
  it("wraps Daily methods that return undefined", async () => {
    await expect(runDailyMethod(() => undefined)).resolves.toBeUndefined()
  })

  it("turns synchronous throws into rejections", async () => {
    await expect(
      runDailyMethod(() => {
        throw new Error("only supported after join")
      })
    ).rejects.toThrow("only supported after join")
  })

  it("spots Daily's already-running error", () => {
    expect(isAlreadyRunningError("Transcription already started")).toBe(true)
    expect(isAlreadyRunningError("model not found")).toBe(false)
    expect(isAlreadyRunningError(undefined)).toBe(false)
  })
})
