import { describe, expect, it } from "vitest"
import { requestedConnectCapabilities } from "./connect"

describe("requestedConnectCapabilities (D-05)", () => {
  it("PT Custom is transfers-only", () => {
    expect(
      requestedConnectCapabilities({
        country: "PT",
        controllerDashboard: "custom",
      })
    ).toEqual({ transfers: { requested: true } })
  })

  it("keeps card_payments on Express (hosted onboarding unproven)", () => {
    expect(
      requestedConnectCapabilities({
        country: "PT",
        controllerDashboard: "express",
      })
    ).toEqual({
      card_payments: { requested: true },
      transfers: { requested: true },
    })
  })

  it("US Custom still requests card_payments", () => {
    expect(
      requestedConnectCapabilities({
        country: "US",
        controllerDashboard: "custom",
      })
    ).toEqual({
      card_payments: { requested: true },
      transfers: { requested: true },
    })
  })
})
