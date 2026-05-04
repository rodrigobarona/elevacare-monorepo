import { describe, expect, it } from "vitest"
import {
  adapterCountriesIndex,
  AdapterError,
  getAdapter,
  InvoicingProviderSlug,
  listAdapters,
} from "./index"

describe("invoicing adapter registry", () => {
  it("registers TOConline, Moloni, and Manual adapters", () => {
    const slugs = listAdapters()
      .map((a) => a.manifest.slug)
      .sort()
    expect(slugs).toEqual(["manual", "moloni", "toconline"])
  })

  it("getAdapter returns the same instance for a known slug", () => {
    const a = getAdapter("toconline")
    const b = getAdapter("toconline")
    expect(a).toBe(b)
    expect(a.manifest.slug).toBe("toconline")
  })

  it("InvoicingProviderSlug enum matches the registry", () => {
    expect(InvoicingProviderSlug.options.sort()).toEqual([
      "manual",
      "moloni",
      "toconline",
    ])
  })

  it("countries index groups by ISO-3166-1 alpha-2", () => {
    const idx = adapterCountriesIndex()
    const pt = idx.PT
    expect(pt).toBeDefined()
    expect(pt!.map((a) => a.manifest.slug).sort()).toEqual([
      "manual",
      "moloni",
      "toconline",
    ])
    const es = idx.ES
    expect(es).toBeDefined()
    expect(es!.map((a) => a.manifest.slug).sort()).toEqual(["manual", "moloni"])
  })

  it("manual adapter requires an explicit acknowledgment", async () => {
    const adapter = getAdapter("manual")
    await expect(
      adapter.connect({
        expertProfileId: "exp_1",
        orgId: "org_1",
        userId: "usr_1",
        payload: {},
      })
    ).rejects.toBeInstanceOf(AdapterError)
  })

  it("manual adapter accepts acknowledged=true", async () => {
    const adapter = getAdapter("manual")
    const result = await adapter.connect({
      expertProfileId: "exp_1",
      orgId: "org_1",
      userId: "usr_1",
      payload: { acknowledged: true },
    })
    expect(result.vaultRef).toBe("")
    expect(result.metadata?.acknowledged).toBe(true)
  })

  it("moloni stub fails fast with AdapterError(fatal)", async () => {
    const adapter = getAdapter("moloni")
    try {
      await adapter.connect({
        expertProfileId: "exp_1",
        orgId: "org_1",
        userId: "usr_1",
        payload: { code: "x" },
      })
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(AdapterError)
      expect((err as AdapterError).kind).toBe("fatal")
    }
  })
})
