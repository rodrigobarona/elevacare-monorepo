import { describe, expect, it } from "vitest"
import { pickLocalizedText } from "./localized-text"

const text = { en: "Hello", pt: "Olá", es: "Hola" }

describe("pickLocalizedText", () => {
  it("returns the matching locale and falls back to English", () => {
    expect(pickLocalizedText(text, "pt")).toBe("Olá")
    expect(pickLocalizedText(text, "es")).toBe("Hola")
    expect(pickLocalizedText(text, "en")).toBe("Hello")
    expect(pickLocalizedText({ en: "Hello" }, "pt")).toBe("Hello")
  })
})
