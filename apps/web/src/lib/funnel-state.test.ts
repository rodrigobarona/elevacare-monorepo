import { describe, expect, it } from "vitest"
import {
  initialFunnelLanguage,
  initialFunnelStep,
  mapConfirmError,
  mapReserveError,
  previousFunnelStep,
} from "./funnel-state"

describe("initialFunnelStep", () => {
  it("starts on meet when the member must choose", () => {
    expect(initialFunnelStep({ skipToWhen: false })).toBe("meet")
  })

  it("skips meet for a private pinned mode", () => {
    expect(
      initialFunnelStep({ pinnedModeId: "mode-1", skipToWhen: false })
    ).toBe("when")
  })

  it("skips meet when only one mode is bookable", () => {
    expect(initialFunnelStep({ skipToWhen: true })).toBe("when")
  })
})

describe("previousFunnelStep", () => {
  it("does not go back to meet when that step was skipped", () => {
    expect(previousFunnelStep("when", { skipToWhen: true })).toBeNull()
  })

  it("returns meet from when in the public funnel", () => {
    expect(previousFunnelStep("when", { skipToWhen: false })).toBe("meet")
  })

  it("walks pay back to details", () => {
    expect(previousFunnelStep("pay", { skipToWhen: false })).toBe("details")
  })
})

describe("mapReserveError", () => {
  it("maps known API codes", () => {
    expect(mapReserveError("SLOT_TAKEN")).toBe("slotTaken")
    expect(mapReserveError("CONSENT_VERSION_OUTDATED")).toBe("consentOutdated")
    expect(mapReserveError("mystery")).toBe("generic")
    expect(mapReserveError(undefined)).toBe("generic")
  })
})

describe("mapConfirmError", () => {
  it("maps confirm API codes", () => {
    expect(mapConfirmError("PAYMENT_MISMATCH")).toBe("confirmMismatch")
    expect(mapConfirmError("unavailable")).toBe("confirmFailed")
    expect(mapConfirmError("mystery")).toBe("confirmFailed")
    expect(mapConfirmError(undefined)).toBe("confirmFailed")
  })
})

describe("initialFunnelLanguage", () => {
  it("keeps the page locale when the expert offers it", () => {
    expect(initialFunnelLanguage("es", ["en", "es"])).toBe("es")
  })

  it("falls back to the first offered language", () => {
    expect(initialFunnelLanguage("es", ["pt"])).toBe("pt")
  })

  it("normalizes stored language tags", () => {
    expect(initialFunnelLanguage("pt", ["PT-BR"])).toBe("pt")
    expect(initialFunnelLanguage("es", ["PT"])).toBe("pt")
  })
})
