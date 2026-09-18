import { describe, expect, it, vi } from "vitest"
import {
  classifyIvaRegime,
  createViesCache,
  territoryFromCountry,
} from "./iva-matrix"

describe("territoryFromCountry", () => {
  it("treats PT and autonomous regions as territorial", () => {
    expect(territoryFromCountry("pt")).toBe("pt")
    expect(territoryFromCountry("PT-MA")).toBe("pt")
    expect(territoryFromCountry("PT-AC")).toBe("pt")
    expect(classifyIvaRegime({ countryIso: "PT-MA" }).taxCountryRegion).toBe(
      "PT-MA"
    )
  })

  it("treats other EU members as eu and the UK as extra-EU", () => {
    expect(territoryFromCountry("DE")).toBe("eu")
    expect(territoryFromCountry("EL")).toBe("eu")
    expect(territoryFromCountry("GB")).toBe("extra_eu")
    expect(territoryFromCountry("US")).toBe("extra_eu")
  })
})

describe("classifyIvaRegime", () => {
  it("allows PT territorial issuance without VIES", () => {
    expect(classifyIvaRegime({ countryIso: "PT" })).toMatchObject({
      regime: "pt_territorial",
      canIssue: true,
      queueReason: null,
    })
  })

  it("does not auto-classify EU without valid VIES as consumer", () => {
    expect(
      classifyIvaRegime({ countryIso: "ES", viesStatus: "invalid" })
    ).toMatchObject({
      regime: "eu_unclassified",
      canIssue: false,
      queueReason: "eu_without_valid_vies_not_auto_consumer",
    })
    expect(
      classifyIvaRegime({
        countryIso: "FR",
        viesStatus: "valid",
        reverseChargeLegalReqsMet: true,
      })
    ).toMatchObject({
      regime: "eu_unclassified",
      viesStatus: "missing_vat",
      canIssue: false,
    })
  })

  it("fail-closes when VIES is down", () => {
    expect(
      classifyIvaRegime({ countryIso: "IT", viesStatus: "unavailable" })
    ).toMatchObject({
      regime: "vies_unavailable",
      canIssue: false,
      queueReason: "vies_unavailable_fail_closed",
    })
  })

  it("requires a VAT number and explicit legal reqs for reverse charge", () => {
    expect(
      classifyIvaRegime({
        countryIso: "NL",
        vatNumber: "NL123",
        viesStatus: "valid",
        reverseChargeLegalReqsMet: false,
      })
    ).toMatchObject({
      regime: "eu_unclassified",
      queueReason: "eu_reverse_charge_legal_reqs_unmet",
    })
    expect(
      classifyIvaRegime({
        countryIso: "NL",
        vatNumber: "NL123",
        viesStatus: "valid",
        reverseChargeLegalReqsMet: true,
      })
    ).toMatchObject({
      regime: "eu_reverse_charge",
      canIssue: true,
    })
  })

  it("does not treat extra-EU as indiscriminate zero-rate or M99", () => {
    const decision = classifyIvaRegime({ countryIso: "US" })
    expect(decision.regime).toBe("extra_eu_unclassified")
    expect(decision.canIssue).toBe(false)
    expect(decision.queueReason).toBe("extra_eu_not_indiscriminate_zero_rate")
  })
})

describe("createViesCache", () => {
  it("reuses a valid result for 24h and fail-closes on lookup errors", async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce({ status: "valid" })
      .mockRejectedValueOnce(new Error("vies down"))
    const now = vi.fn().mockReturnValue(1_000)
    const cached = createViesCache({ check }, { now })

    await expect(cached.check("DE123")).resolves.toEqual({ status: "valid" })
    now.mockReturnValue(1_000 + 23 * 60 * 60 * 1000)
    await expect(cached.check("de123")).resolves.toEqual({ status: "valid" })
    expect(check).toHaveBeenCalledTimes(1)

    await expect(cached.check("IT999")).resolves.toEqual({
      status: "unavailable",
    })
    expect(check).toHaveBeenCalledTimes(2)
  })
})
