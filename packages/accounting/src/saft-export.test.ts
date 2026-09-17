import { afterEach, describe, expect, it, vi } from "vitest"
import {
  SAFT_SIGNED_URL_TTL_SECONDS,
  buildSaftCsv,
  buildSaftDownloadUrl,
  buildSaftXmlSkeleton,
  parseSaftMonth,
  saftBlobPathname,
  saftMonthRange,
  signSaftDownloadToken,
  verifySaftDownloadToken,
  type SaftInvoiceRow,
} from "./saft-export"

const ROW: SaftInvoiceRow = {
  id: "00000000-0000-4000-8000-000000000001",
  bookingId: "00000000-0000-4000-8000-000000000010",
  adapter: "manual",
  status: "manual_issued",
  number: 'FT 1, "A"',
  issuedAt: new Date("2026-03-15T10:00:00.000Z"),
  createdAt: new Date("2026-03-15T09:00:00.000Z"),
  amountCents: 6000,
  memberNif: "123456789",
}

describe("parseSaftMonth", () => {
  it("accepts YYYY-MM", () => {
    expect(parseSaftMonth("2026-03")).toEqual({ year: 2026, month: 3 })
  })

  it("rejects malformed months", () => {
    expect(() => parseSaftMonth("2026-13")).toThrow(/YYYY-MM/)
    expect(() => parseSaftMonth("26-03")).toThrow(/YYYY-MM/)
  })
})

describe("saftMonthRange", () => {
  it("uses Europe/Lisbon midnight across the March DST change", () => {
    const range = saftMonthRange("2026-03")
    expect(range.start.toISOString()).toBe("2026-03-01T00:00:00.000Z")
    expect(range.end.toISOString()).toBe("2026-03-31T23:00:00.000Z")
    expect(range.startDate).toBe("2026-03-01")
    expect(range.endDate).toBe("2026-03-31")
  })

  it("uses Europe/Lisbon midnight across the October DST change", () => {
    const range = saftMonthRange("2026-10")
    expect(range.start.toISOString()).toBe("2026-09-30T23:00:00.000Z")
    expect(range.end.toISOString()).toBe("2026-11-01T00:00:00.000Z")
    expect(range.endDate).toBe("2026-10-31")
  })
})

describe("buildSaftCsv", () => {
  it("quotes commas and never labels members as patients", () => {
    const csv = buildSaftCsv([ROW])
    expect(csv).toContain('"FT 1, ""A"""')
    expect(csv).toContain("member_nif")
    expect(csv).toContain("123456789")
    expect(csv.toLowerCase()).not.toContain("patient")
  })

  it("neutralizes spreadsheet formulas in invoice numbers", () => {
    const csv = buildSaftCsv([{ ...ROW, number: "=cmd|'/c calc'!A0" }])
    expect(csv).toContain("'=cmd|'/c calc'!A0")
  })

  it("records truncation inside the CSV", () => {
    const csv = buildSaftCsv([ROW], { truncated: true })
    expect(csv).toContain("# truncated:")
  })
})

describe("buildSaftXmlSkeleton", () => {
  it("labels the file as a non-certified skeleton", () => {
    const xml = buildSaftXmlSkeleton({
      month: "2026-03",
      rows: [
        ROW,
        {
          ...ROW,
          id: "00000000-0000-4000-8000-000000000099",
          status: "failed",
        },
      ],
      generatedAt: new Date("2026-09-17T10:00:00.000Z"),
    })
    expect(xml).toContain("Not a certified AT file")
    expect(xml).toContain("Do not Comunicar")
    expect(xml).toContain("<InvoiceNo>FT 1, &quot;A&quot;</InvoiceNo>")
    expect(xml).toContain("<CustomerID>123456789</CustomerID>")
    expect(xml).toContain("<NumberOfEntries>1</NumberOfEntries>")
    expect(xml).not.toContain("<TaxPayable>")
    expect(xml).not.toContain("<GrossTotal>")
    expect(xml).toContain("<DateCreated>2026-09-17</DateCreated>")
  })

  it("records truncation next to the invoice count", () => {
    const xml = buildSaftXmlSkeleton({
      month: "2026-03",
      rows: [ROW],
      truncated: true,
    })
    expect(xml).toContain("truncated: export hit")
  })
})

describe("SAF-T download token", () => {
  const orgId = "00000000-0000-4000-8000-000000000002"
  const pathname = `invoicing-exports/${orgId}/saft-2026-03.zip`

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("round-trips a fresh signature", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "saft-test-secret")
    const exp = Math.floor(Date.now() / 1000) + SAFT_SIGNED_URL_TTL_SECONDS
    const signature = signSaftDownloadToken({
      orgId,
      month: "2026-03",
      pathname,
      exp,
    })
    expect(
      verifySaftDownloadToken({
        orgId,
        month: "2026-03",
        pathname,
        exp,
        signature,
      })
    ).toBe(true)
  })

  it("rejects expired tokens and path traversal", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "saft-test-secret")
    const signature = signSaftDownloadToken({
      orgId,
      month: "2026-03",
      pathname,
      exp: Math.floor(Date.now() / 1000) - 10,
    })
    expect(
      verifySaftDownloadToken({
        orgId,
        month: "2026-03",
        pathname,
        exp: Math.floor(Date.now() / 1000) - 10,
        signature,
      })
    ).toBe(false)
    expect(
      verifySaftDownloadToken({
        orgId,
        month: "2026-03",
        pathname: `invoicing-exports/${orgId}/../secret.zip`,
        exp: Math.floor(Date.now() / 1000) + 60,
        signature: "x",
      })
    ).toBe(false)
  })

  it("builds a file URL without a raw blob host", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "saft-test-secret")
    const url = buildSaftDownloadUrl({
      apiBaseUrl: "https://api.eleva.care",
      orgId,
      month: "2026-03",
      pathname,
      expiresAt: new Date("2026-03-15T12:00:00.000Z"),
    })
    expect(url).toContain("/invoicing/exports/saft/file?")
    expect(url).not.toContain("blob.vercel-storage.com")
    expect(saftBlobPathname(orgId, "2026-03")).toBe(pathname)
  })
})
