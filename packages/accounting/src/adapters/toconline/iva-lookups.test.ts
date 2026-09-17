import { afterEach, describe, expect, it, vi } from "vitest"
import { classifyIvaRegime } from "../../core/iva-matrix"
import { resolveIvaLookups } from "./iva-lookups"

const client = {
  apiBase: "https://api1.toconline.pt",
  accessToken: "tok",
}

function jsonApiResponse(id: string, attributes: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: [{ type: "resource", id, attributes }],
    }),
  }
}

describe("resolveIvaLookups", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("resolves PT NOR via GET /taxes without posting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonApiResponse("103", {
        tax_code: "NOR",
        tax_country_region: "PT",
        tax_percentage: "17.5",
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await resolveIvaLookups(
      client,
      classifyIvaRegime({ countryIso: "PT" })
    )
    expect(result).toMatchObject({
      ok: true,
      regime: "pt_territorial",
      tax: { id: "103", taxPercentage: 17.5 },
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("https://api1.toconline.pt/api/taxes?")
    expect(url).toContain("filter%5Btax_code%5D=NOR")
    expect(url).not.toContain("tax_percentage")
    expect(init.method).toBe("GET")
  })

  it("looks up NOR against PT-MA for Madeira territorial experts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonApiResponse("104", {
        tax_code: "NOR",
        tax_country_region: "PT-MA",
        tax_percentage: "17.5",
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    await resolveIvaLookups(client, classifyIvaRegime({ countryIso: "PT-MA" }))
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain("filter%5Btax_country_region%5D=PT-MA")
  })

  it("resolves reverse charge ISE + M07 exemption codes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonApiResponse("7", { tax_code: "ISE", tax_country_region: "PT" })
      )
      .mockResolvedValueOnce(jsonApiResponse("12"))
    vi.stubGlobal("fetch", fetchMock)

    const result = await resolveIvaLookups(
      client,
      classifyIvaRegime({
        countryIso: "DE",
        vatNumber: "DE123456789",
        viesStatus: "valid",
        reverseChargeLegalReqsMet: true,
      })
    )
    expect(result).toMatchObject({
      ok: true,
      regime: "eu_reverse_charge",
      exemptionCode: "M07",
      exemptionReasonId: "12",
    })
    const urls = fetchMock.mock.calls.map((call) => call[0] as string)
    expect(urls[0]).toContain("/api/taxes?")
    expect(urls[0]).toContain("filter%5Btax_code%5D=ISE")
    expect(urls[1]).toContain("/api/tax_exemption_reasons?")
    expect(urls[1]).toContain("filter%5Bcode%5D=M07")
    expect(urls.some((url) => url.includes("M99"))).toBe(false)
  })

  it("does not look up M99 for unclassified extra-EU", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const result = await resolveIvaLookups(
      client,
      classifyIvaRegime({ countryIso: "US" })
    )
    expect(result).toEqual({
      ok: false,
      regime: "extra_eu_unclassified",
      reason: "extra_eu_not_indiscriminate_zero_rate",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
