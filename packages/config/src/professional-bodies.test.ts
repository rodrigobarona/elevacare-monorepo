import { describe, expect, it } from "vitest"
import {
  ERS_REGISTRATION_NUMBER_PATTERN,
  LICENCE_NUMBER_PATTERN,
  PROFESSIONAL_BODIES,
  PROFESSIONAL_BODY_IDS,
  isProfessionalBodyId,
  professionalBodyById,
} from "./professional-bodies"

describe("professional bodies", () => {
  it("lists unique ids with https sites", () => {
    expect(new Set(PROFESSIONAL_BODY_IDS).size).toBe(PROFESSIONAL_BODIES.length)
    for (const body of PROFESSIONAL_BODIES) {
      expect(body.website.startsWith("https://")).toBe(true)
    }
  })

  it("narrows ids", () => {
    expect(isProfessionalBodyId("ordem_psicologos")).toBe(true)
    expect(isProfessionalBodyId("ordem_coaches")).toBe(false)
    expect(professionalBodyById("ordem_enfermeiros")?.name).toBe(
      "Ordem dos Enfermeiros"
    )
    expect(professionalBodyById(null)).toBeNull()
  })

  it("accepts plain licence and ERS numbers", () => {
    expect(LICENCE_NUMBER_PATTERN.test("12345")).toBe(true)
    expect(LICENCE_NUMBER_PATTERN.test("OPP 12345")).toBe(true)
    expect(LICENCE_NUMBER_PATTERN.test(" 12345")).toBe(false)
    expect(LICENCE_NUMBER_PATTERN.test("12<b>")).toBe(false)
    expect(ERS_REGISTRATION_NUMBER_PATTERN.test("E123456")).toBe(true)
    expect(ERS_REGISTRATION_NUMBER_PATTERN.test("12 34")).toBe(false)
  })
})
