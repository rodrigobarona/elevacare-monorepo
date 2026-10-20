import { describe, expect, it } from "vitest"
import {
  fillTemplatePlaceholders,
  scanTemplateForPhi,
  tokenizeTemplatePlaceholders,
  type TemplatePhiDetector,
} from "./template-phi-scan"
import { STARTER_RECORD_TEMPLATES } from "./starter-templates"

function detectors(text: string, context = {}): TemplatePhiDetector[] {
  return scanTemplateForPhi(text, context).map((f) => f.detector)
}

describe("scanTemplateForPhi", () => {
  it("accepts tokenised templates", () => {
    expect(
      scanTemplateForPhi(
        "Session with {{member.firstName}} on {{session.date}}.\n\nPlan:\n\n{{expert.name}}"
      )
    ).toEqual([])
  })

  it("accepts every starter template in every locale", () => {
    for (const template of STARTER_RECORD_TEMPLATES) {
      for (const copy of Object.values(template.copy)) {
        expect(scanTemplateForPhi(copy.title)).toEqual([])
        expect(scanTemplateForPhi(copy.body)).toEqual([])
      }
    }
  })

  it("flags the source member's name, including a single name part", () => {
    const context = { names: ["Maria Fernandes"] }
    expect(detectors("Notes for Maria Fernandes", context)).toEqual([
      "member_identifier",
    ])
    expect(detectors("Fernandes reported less pain", context)).toEqual([
      "member_identifier",
    ])
    expect(detectors("Marianne", context)).toEqual([])
  })

  it("matches non-name identifiers only as whole values", () => {
    const context = { identifiers: ["+351 912 345 678", "20 Oct 2026"] }
    expect(detectors("Review again in 2026, set 345", context)).toEqual([])
    expect(detectors("Booked on 20 Oct 2026", context)).toContain(
      "member_identifier"
    )
  })

  it("flags e-mail addresses", () => {
    expect(detectors("Write to ana.silva@example.com")).toEqual(["email"])
  })

  it("flags phone numbers", () => {
    expect(detectors("Call +351 912 345 678 after")).toEqual(["phone"])
    expect(detectors("3 x 10 reps, 2 sets")).toEqual([])
  })

  it("flags NIF, DNI and NIE formats", () => {
    expect(detectors("NIF 123456789")).toEqual(["national_id"])
    expect(detectors("DNI 12345678Z")).toEqual(["national_id"])
    expect(detectors("NIE X1234567L")).toEqual(["national_id"])
  })

  it("flags numeric and written dates in en/pt/es", () => {
    expect(detectors("Seen on 12/03/2026")).toEqual(["date"])
    expect(detectors("Seen on 2026-03-12")).toEqual(["date"])
    expect(detectors("Seen on 12 March 2026")).toEqual(["date"])
    expect(detectors("Visto a 12 de março de 2026")).toEqual(["date"])
    expect(detectors("Visto el 12 de marzo")).toEqual(["date"])
    expect(detectors("Seen on March 12, 2026")).toEqual(["date"])
  })

  it("flags clinical sentences copied verbatim from the source record", () => {
    const sourceTexts = [
      "Lumbar flexion limited to 40 degrees with pain at end range. Plan: review.",
    ]
    const findings = scanTemplateForPhi(
      "Assessment:\nLumbar flexion limited to 40 degrees with\npain at end range",
      { sourceTexts }
    )
    expect(findings.map((f) => f.detector)).toEqual(["source_text"])
    expect(detectors("Plan: review.", { sourceTexts })).toEqual([])
  })

  it("returns spans that point at the original text", () => {
    const text = "Mail ana@example.com now"
    const [finding] = scanTemplateForPhi(text)
    expect(text.slice(finding!.start, finding!.end)).toBe("ana@example.com")
  })
})

describe("placeholders", () => {
  const values = {
    "member.firstName": "Maria",
    "session.date": "12 March 2026",
    "expert.name": "Patrícia Mota",
  } as const

  it("fills known tokens and leaves unknown ones", () => {
    expect(
      fillTemplatePlaceholders(
        "Hi {{member.firstName}}, {{session.date}}. {{ expert.name }} {{other}}",
        values
      )
    ).toBe("Hi Maria, 12 March 2026. Patrícia Mota {{other}}")
  })

  it("tokenises filled values back so the scrubber passes", () => {
    const filled = "Hi Maria, see you after 12 March 2026. Patrícia Mota"
    const tokenised = tokenizeTemplatePlaceholders(filled, values)
    expect(tokenised).toBe(
      "Hi {{member.firstName}}, see you after {{session.date}}. {{expert.name}}"
    )
    expect(
      scanTemplateForPhi(tokenised, { names: ["Maria Fernandes"] })
    ).toEqual([])
  })
})
