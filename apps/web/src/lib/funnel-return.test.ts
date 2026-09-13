import { afterEach, describe, expect, it, vi } from "vitest"
import {
  bookingReturnUrl,
  captureRedirect,
  captureRedirectStatus,
  clearFunnelReturn,
  parseRedirectStatus,
  releaseConfirmLock,
  saveFunnelReturn,
  takeFunnelRestore,
  tryAcquireConfirmLock,
  type FunnelReturnSnapshot,
} from "./funnel-return"

const snapshot: FunnelReturnSnapshot = {
  reservation: {
    reservationId: "res-1",
    reservationToken: "tok-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
  payment: {
    clientSecret: "cs_test",
    paymentIntentId: "pi_test",
    bookingId: "",
    publishableKey: "pk_test",
  },
  slot: {
    start: "2099-01-02T10:00:00.000Z",
    end: "2099-01-02T11:00:00.000Z",
    startLocal: "10:00",
    endLocal: "11:00",
  },
  modeId: "mode-1",
  name: "Member",
  email: "member@example.com",
  phone: "",
  timeZone: "Europe/Lisbon",
  country: "PT",
  language: "en",
}

function stubSession(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  })
  return store
}

describe("parseRedirectStatus", () => {
  it("reads a successful Stripe redirect", () => {
    expect(parseRedirectStatus("?redirect_status=succeeded")).toBe("succeeded")
    expect(parseRedirectStatus("redirect_status=processing")).toBe("processing")
  })

  it("reads a failed Stripe redirect", () => {
    expect(parseRedirectStatus("?redirect_status=failed")).toBe("failed")
    expect(
      parseRedirectStatus("?redirect_status=requires_payment_method")
    ).toBe("failed")
  })

  it("ignores other query values", () => {
    expect(parseRedirectStatus("?redirect_status=canceled")).toBeNull()
    expect(parseRedirectStatus("")).toBeNull()
  })
})

describe("captureRedirectStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("falls back to a stored Stripe status when the query is empty", () => {
    stubSession({
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        paymentIntentId: "pi_test",
      }),
    })
    expect(captureRedirectStatus("")).toBe("succeeded")
    expect(captureRedirect("")).toEqual({
      status: "succeeded",
      paymentIntentId: "pi_test",
    })
  })

  it("does not merge a URL status with a stored payment intent", () => {
    stubSession({
      "bookingFunnel:redirect": JSON.stringify({
        status: "failed",
        paymentIntentId: "pi_old",
      }),
    })
    expect(captureRedirect("?redirect_status=succeeded")).toEqual({
      status: "succeeded",
      paymentIntentId: null,
    })
  })
})

describe("takeFunnelRestore", () => {
  afterEach(() => {
    clearFunnelReturn()
    vi.unstubAllGlobals()
  })

  it("drops the module memo after clearFunnelReturn", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        paymentIntentId: "pi_test",
      }),
    })
    expect(takeFunnelRestore()?.snapshot.reservation.reservationId).toBe(
      "res-1"
    )
    clearFunnelReturn()
    expect(takeFunnelRestore()).toBeNull()
  })

  it("drops the module memo when a new funnel starts", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        paymentIntentId: "pi_test",
      }),
    })
    expect(takeFunnelRestore()).not.toBeNull()
    saveFunnelReturn({
      ...snapshot,
      reservation: { ...snapshot.reservation, reservationId: "res-2" },
    })
    expect(takeFunnelRestore()).toBeNull()
  })

  it("does not pair a new redirect status with the previous memo intent", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        paymentIntentId: "pi_test",
      }),
    })
    expect(takeFunnelRestore()).not.toBeNull()
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
    })
    expect(takeFunnelRestore("?redirect_status=processing")).toBeNull()
  })

  it("rejects a stored snapshot that does not match the Stripe payment intent", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        paymentIntentId: "pi_other",
      }),
    })
    expect(takeFunnelRestore()).toBeNull()
  })
})

describe("confirm lock", () => {
  it("can be acquired again after release", () => {
    const key = "res-1:pi_test"
    expect(tryAcquireConfirmLock(key)).toBe(true)
    expect(tryAcquireConfirmLock(key)).toBe(false)
    releaseConfirmLock(key)
    expect(tryAcquireConfirmLock(key)).toBe(true)
    releaseConfirmLock(key)
  })
})

describe("bookingReturnUrl", () => {
  it("strips Stripe redirect query keys", () => {
    expect(
      bookingReturnUrl(
        "https://eleva.care/en/ana/intake?redirect_status=succeeded&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_xxx&keep=1"
      )
    ).toBe("https://eleva.care/en/ana/intake?keep=1")
  })
})
