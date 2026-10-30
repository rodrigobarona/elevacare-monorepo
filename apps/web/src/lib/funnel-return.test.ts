import { afterEach, describe, expect, it, vi } from "vitest"
import {
  updateFunnelReturnPayment,
  bookingReturnUrl,
  captureRedirect,
  checkoutReturnPath,
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
    checkoutSessionId: "cs_test_1",
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
  it("treats a Checkout Session return as an attempt to confirm", () => {
    expect(parseRedirectStatus("?checkout_session_id=cs_test_1")).toBe(
      "succeeded"
    )
    expect(
      parseRedirectStatus(
        "checkout_session_id=cs_test_1&redirect_status=processing"
      )
    ).toBe("processing")
  })

  it("reads a failed redirect", () => {
    expect(
      parseRedirectStatus(
        "?checkout_session_id=cs_test_1&redirect_status=requires_payment_method"
      )
    ).toBe("failed")
  })

  it("ignores returns without a Checkout Session id", () => {
    expect(parseRedirectStatus("?redirect_status=succeeded")).toBeNull()
    expect(parseRedirectStatus("?checkout_session_id=pi_1")).toBeNull()
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
        checkoutSessionId: "cs_test_1",
      }),
    })
    expect(captureRedirectStatus("")).toBe("succeeded")
    expect(captureRedirect("")).toEqual({
      status: "succeeded",
      checkoutSessionId: "cs_test_1",
    })
  })

  it("prefers the session in the URL over a stored one", () => {
    stubSession({
      "bookingFunnel:redirect": JSON.stringify({
        status: "failed",
        checkoutSessionId: "cs_test_old",
      }),
    })
    expect(captureRedirect("?checkout_session_id=cs_test_new")).toEqual({
      status: "succeeded",
      checkoutSessionId: "cs_test_new",
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
        checkoutSessionId: "cs_test_1",
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
        checkoutSessionId: "cs_test_1",
      }),
    })
    expect(takeFunnelRestore()).not.toBeNull()
    saveFunnelReturn({
      ...snapshot,
      reservation: { ...snapshot.reservation, reservationId: "res-2" },
    })
    expect(takeFunnelRestore()).toBeNull()
  })

  it("does not pair a different session with the previous memo", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        checkoutSessionId: "cs_test_1",
      }),
    })
    expect(takeFunnelRestore()).not.toBeNull()
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
    })
    expect(takeFunnelRestore("?checkout_session_id=cs_test_other")).toBeNull()
  })

  it("keeps the snapshot after a failed redirect so a later success can restore", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
    })
    expect(
      takeFunnelRestore(
        "?redirect_status=requires_payment_method&checkout_session_id=cs_test_1"
      )?.status
    ).toBe("failed")
    expect(takeFunnelRestore("?checkout_session_id=cs_test_1")?.status).toBe(
      "succeeded"
    )
  })

  it("rejects a stored snapshot that does not match the Checkout Session", () => {
    stubSession({
      "bookingFunnel:v1": JSON.stringify(snapshot),
      "bookingFunnel:redirect": JSON.stringify({
        status: "succeeded",
        checkoutSessionId: "cs_test_other",
      }),
    })
    expect(takeFunnelRestore()).toBeNull()
  })
})

describe("confirm lock", () => {
  it("can be acquired again after release", () => {
    const key = "res-1:cs_test_1"
    expect(tryAcquireConfirmLock(key)).toBe(true)
    expect(tryAcquireConfirmLock(key)).toBe(false)
    releaseConfirmLock(key)
    expect(tryAcquireConfirmLock(key)).toBe(true)
    releaseConfirmLock(key)
  })
})

describe("bookingReturnUrl", () => {
  it("strips Stripe return query keys", () => {
    expect(
      bookingReturnUrl(
        "https://eleva.care/en/ana/intake?redirect_status=succeeded&checkout_session_id=cs_test_1&keep=1"
      )
    ).toBe("https://eleva.care/en/ana/intake?keep=1")
  })
})

describe("checkoutReturnPath", () => {
  it("returns a relative path with a literal Stripe template", () => {
    expect(
      checkoutReturnPath(
        "https://dev.eleva.care/pt/fisiomota/first-visit?checkout_session_id=cs_old"
      )
    ).toBe(
      "/pt/fisiomota/first-visit?checkout_session_id={CHECKOUT_SESSION_ID}"
    )
    expect(
      checkoutReturnPath("https://eleva.care/fisiomota/first-visit?link=abc")
    ).toBe(
      "/fisiomota/first-visit?link=abc&checkout_session_id={CHECKOUT_SESSION_ID}"
    )
  })
})

describe("updateFunnelReturnPayment", () => {
  afterEach(() => {
    clearFunnelReturn()
    vi.unstubAllGlobals()
  })

  it("points the snapshot at the replacement session and code", () => {
    const store = stubSession({ "bookingFunnel:v1": JSON.stringify(snapshot) })
    updateFunnelReturnPayment(
      { ...snapshot.payment, checkoutSessionId: "cs_test_promo" },
      "SPRING20"
    )
    const saved = JSON.parse(store.get("bookingFunnel:v1") ?? "{}")
    expect(saved.payment.checkoutSessionId).toBe("cs_test_promo")
    expect(saved.promoCode).toBe("SPRING20")
    expect(
      takeFunnelRestore("?checkout_session_id=cs_test_promo")
    ).not.toBeNull()
  })
})
