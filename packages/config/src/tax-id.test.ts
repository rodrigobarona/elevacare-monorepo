import { describe, expect, it } from "vitest"
import { isValidTaxId, normalizeTaxId } from "./tax-id"

describe("isValidTaxId", () => {
  it("checks Portuguese NIF and NIPC check digits", () => {
    expect(isValidTaxId("123456789", "PT")).toBe(true)
    expect(isValidTaxId("501964843", "PT")).toBe(true)
    expect(isValidTaxId("PT 123 456 789", "PT")).toBe(true)
    expect(isValidTaxId("123456780", "PT")).toBe(false)
    expect(isValidTaxId("12345678", "PT")).toBe(false)
  })

  it("checks Spanish DNI, NIE and CIF control characters", () => {
    expect(isValidTaxId("12345678Z", "ES")).toBe(true)
    expect(isValidTaxId("12345678-z", "ES")).toBe(true)
    expect(isValidTaxId("12345678A", "ES")).toBe(false)
    expect(isValidTaxId("X1234567L", "ES")).toBe(true)
    expect(isValidTaxId("X1234567A", "ES")).toBe(false)
    expect(isValidTaxId("B12345674", "ES")).toBe(true)
    expect(isValidTaxId("B12345670", "ES")).toBe(false)
  })

  it("checks Brazilian CPF and CNPJ check digits", () => {
    expect(isValidTaxId("529.982.247-25", "BR")).toBe(true)
    expect(isValidTaxId("529.982.247-26", "BR")).toBe(false)
    expect(isValidTaxId("111.111.111-11", "BR")).toBe(false)
    expect(isValidTaxId("11.222.333/0001-81", "BR")).toBe(true)
    expect(isValidTaxId("11.222.333/0001-80", "BR")).toBe(false)
  })

  it("accepts a plain tax number for other countries", () => {
    expect(isValidTaxId("DE123456789", "DE")).toBe(true)
    expect(isValidTaxId("12", "DE")).toBe(false)
  })
})

describe("normalizeTaxId", () => {
  it("drops separators and the country prefix", () => {
    expect(normalizeTaxId(" pt 123.456-789 ", "PT")).toBe("123456789")
    expect(normalizeTaxId("12345678-z", "ES")).toBe("12345678Z")
  })
})
