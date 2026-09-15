import { afterEach, describe, expect, it, vi } from "vitest"
import {
  listOssTaxes,
  resolveCountryId,
  resolveCurrencyId,
  resolveCustomerId,
  resolveDocumentSeriesId,
  resolveExemptionReasonId,
  resolveServiceId,
  resolveTaxId,
} from "./lookups"

const client = {
  apiBase: "https://api33.toconline.pt",
  accessToken: "tok",
}

function jsonApiResponse(id: string, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: [{ type: "resource", id, attributes: extra }],
    }),
  }
}

describe("TOConline lookups", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("resolves document_series_id with document_type + prefix filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonApiResponse("337"))
    vi.stubGlobal("fetch", fetchMock)

    const id = await resolveDocumentSeriesId(client, {
      documentType: "FT",
      prefix: "TEST",
    })

    expect(id).toBe("337")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "https://api33.toconline.pt/api/commercial_document_series?filter%5Bdocument_type%5D=FT&filter%5Bprefix%5D=TEST"
    )
    const headers = init.headers as Record<string, string>
    expect(headers["Content-Type"]).toBe("application/vnd.api+json")
    expect(init.method).toBe("GET")
  })

  it("resolves tax id with optional percentage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonApiResponse("103"))
    vi.stubGlobal("fetch", fetchMock)

    const id = await resolveTaxId(client, {
      taxCode: "NOR",
      taxCountryRegion: "PT",
      taxPercentage: 23,
    })

    expect(id).toBe("103")
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain("filter%5Btax_code%5D=NOR")
    expect(url).toContain("filter%5Btax_country_region%5D=PT")
    expect(url).toContain("filter%5Btax_percentage%5D=23")
  })

  it("resolves customer, exemption, currency, service, and country ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonApiResponse("3"))
      .mockResolvedValueOnce(jsonApiResponse("12"))
      .mockResolvedValueOnce(jsonApiResponse("1"))
      .mockResolvedValueOnce(jsonApiResponse("6"))
      .mockResolvedValueOnce(jsonApiResponse("2"))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      resolveCustomerId(client, { taxRegistrationNumber: "999999990" })
    ).resolves.toBe("3")
    await expect(
      resolveExemptionReasonId(client, { code: "M07" })
    ).resolves.toBe("12")
    await expect(resolveCurrencyId(client, { isoCode: "EUR" })).resolves.toBe(
      "1"
    )
    await expect(
      resolveServiceId(client, { itemCode: "ELEVA-SESSION" })
    ).resolves.toBe("6")
    await expect(
      resolveCountryId(client, { isoAlpha2: "PT-MA" })
    ).resolves.toBe("2")

    const urls = fetchMock.mock.calls.map((call) => call[0] as string)
    expect(urls[0]).toContain("/api/customers?")
    expect(urls[0]).toContain("filter%5Btax_registration_number%5D=999999990")
    expect(urls[1]).toContain("/api/tax_exemption_reasons?")
    expect(urls[1]).toContain("filter%5Bcode%5D=M07")
    expect(urls[2]).toContain("/api/currencies?")
    expect(urls[2]).toContain("filter%5Biso_code%5D=EUR")
    expect(urls[3]).toContain("/api/services?")
    expect(urls[3]).toContain("filter%5Bitem_code%5D=ELEVA-SESSION")
    expect(urls[4]).toContain("/api/countries?")
    expect(urls[4]).toContain("filter%5Biso_alpha_2%5D=PT-MA")
  })

  it("lists OSS taxes without inventing fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            type: "oss_taxes",
            id: "oss_1",
            attributes: { tax_percentage: "19.0" },
          },
        ],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listOssTaxes(client)
    expect(rows).toEqual([
      { id: "oss_1", attributes: { tax_percentage: "19.0" } },
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api33.toconline.pt/api/oss_taxes"
    )
  })

  it("returns null when the filter matches nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      resolveDocumentSeriesId(client, { documentType: "FT", prefix: "TEST" })
    ).resolves.toBeNull()
  })

  it("refuses an ambiguous tax lookup", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { type: "taxes", id: "1" },
          { type: "taxes", id: "2" },
        ],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      resolveTaxId(client, { taxCode: "NOR", taxCountryRegion: "PT" })
    ).rejects.toMatchObject({ name: "AdapterError", kind: "validation" })
  })

  it("refuses to send the bearer token to a non-TOConline host", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      resolveDocumentSeriesId(
        { apiBase: "https://evil.example", accessToken: "tok" },
        { documentType: "FT", prefix: "TEST" }
      )
    ).rejects.toMatchObject({ kind: "validation" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("never POSTs a sales document from a lookup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonApiResponse("337"))
    vi.stubGlobal("fetch", fetchMock)
    await resolveDocumentSeriesId(client, {
      documentType: "FT",
      prefix: "TEST",
    })
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.method).toBe("GET")
    }
  })
})
