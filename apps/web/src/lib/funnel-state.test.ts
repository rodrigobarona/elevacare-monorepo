import { describe, expect, it } from "vitest"
import {
  initialFunnelLanguage,
  initialFunnelStep,
  mapConfirmError,
  mapReserveError,
  previousFunnelStep,
  reconcileSlotWindow,
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

  it("opens the details form when a slot is already selected", () => {
    expect(
      initialFunnelStep({
        skipToWhen: true,
        skipToDetails: true,
      })
    ).toBe("details")
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
    expect(mapReserveError("POLICY_CHANGED")).toBe("policyChanged")
    expect(mapReserveError("mystery")).toBe("generic")
    expect(mapReserveError(undefined)).toBe("generic")
  })
})

describe("mapConfirmError", () => {
  it("maps confirm API codes", () => {
    expect(mapConfirmError("PAYMENT_MISMATCH")).toBe("confirmMismatch")
    expect(mapConfirmError("PAYMENT_FAILED")).toBe("paymentFailed")
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

describe("reconcileSlotWindow", () => {
  const slot = (start: string) => ({ start })
  const base = {
    fromKey: "2026-11-09",
    windowEnd: "2026-12-07",
    dayOf: (item: { start: string }) => item.start.slice(0, 10),
  }

  it("sets Next available from the first window with a time", () => {
    const result = reconcileSlotWindow({
      ...base,
      state: { earliest: null, seeking: true, selected: null },
      slots: [slot("2026-11-12T09:00:00Z"), slot("2026-11-10T09:00:00Z")],
    })
    expect(result.earliest?.start).toBe("2026-11-10T09:00:00Z")
    expect(result.seeking).toBe(false)
  })

  it("keeps searching after an empty window", () => {
    const empty = reconcileSlotWindow({
      ...base,
      state: { earliest: null, seeking: true, selected: null },
      slots: [],
    })
    expect(empty).toMatchObject({ earliest: null, seeking: true })
  })

  it("replaces a Next available time that was booked meanwhile", () => {
    const result = reconcileSlotWindow({
      ...base,
      state: {
        earliest: slot("2026-11-10T09:00:00Z"),
        seeking: false,
        selected: null,
      },
      slots: [slot("2026-11-10T09:30:00Z")],
    })
    expect(result.earliest?.start).toBe("2026-11-10T09:30:00Z")
  })

  it("resumes the search when the booked time leaves the window empty", () => {
    const result = reconcileSlotWindow({
      ...base,
      state: {
        earliest: slot("2026-11-10T09:00:00Z"),
        seeking: false,
        selected: null,
      },
      slots: [],
    })
    expect(result).toMatchObject({ earliest: null, seeking: true })
    // "Later dates" then finds one.
    const later = reconcileSlotWindow({
      fromKey: "2026-12-07",
      windowEnd: "2027-01-04",
      dayOf: base.dayOf,
      state: result,
      slots: [slot("2026-12-08T10:00:00Z")],
    })
    expect(later.earliest?.start).toBe("2026-12-08T10:00:00Z")
  })

  it("clears and reports a chosen time that is no longer open", () => {
    const taken = slot("2026-11-10T09:00:00Z")
    const result = reconcileSlotWindow({
      ...base,
      state: { earliest: taken, seeking: false, selected: taken },
      slots: [slot("2026-11-10T09:30:00Z")],
    })
    expect(result.selected).toBeNull()
    expect(result.selectionGone).toBe(true)
  })

  it("leaves times outside the window alone", () => {
    const november = slot("2026-11-10T09:00:00Z")
    const result = reconcileSlotWindow({
      fromKey: "2026-12-07",
      windowEnd: "2027-01-04",
      dayOf: base.dayOf,
      state: { earliest: november, seeking: false, selected: november },
      slots: [slot("2026-12-08T10:00:00Z")],
    })
    expect(result.earliest).toBe(november)
    expect(result.selected).toBe(november)
    expect(result.selectionGone).toBe(false)
  })
})
