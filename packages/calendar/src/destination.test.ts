import { describe, expect, it } from "vitest"
import { resolveCalendarDestination } from "./destination"

const mode = {
  destinationIntegrationId: "mode-int",
  destinationExternalCalendarId: "mode-cal",
}
const eventType = {
  destinationIntegrationId: "et-int",
  destinationExternalCalendarId: "et-cal",
}
const expertDefault = {
  expertIntegrationId: "default-int",
  externalCalendarId: "default-cal",
}

describe("resolveCalendarDestination", () => {
  it("prefers mode override over event type and default", () => {
    expect(
      resolveCalendarDestination({
        modeOverride: mode,
        eventTypeOverride: eventType,
        expertDefault,
      })
    ).toEqual({
      expertIntegrationId: "mode-int",
      externalCalendarId: "mode-cal",
    })
  })

  it("falls back to event type override when mode has none", () => {
    expect(
      resolveCalendarDestination({
        modeOverride: {
          destinationIntegrationId: null,
          destinationExternalCalendarId: null,
        },
        eventTypeOverride: eventType,
        expertDefault,
      })
    ).toEqual({
      expertIntegrationId: "et-int",
      externalCalendarId: "et-cal",
    })
  })

  it("falls back to expert default when overrides are empty", () => {
    expect(
      resolveCalendarDestination({
        modeOverride: null,
        eventTypeOverride: null,
        expertDefault,
      })
    ).toEqual(expertDefault)
  })

  it("returns null when nothing is configured (ICS e-mail fallback)", () => {
    expect(
      resolveCalendarDestination({
        modeOverride: null,
        eventTypeOverride: null,
        expertDefault: null,
      })
    ).toBeNull()
  })

  it("treats partial override pairs as absent", () => {
    expect(
      resolveCalendarDestination({
        modeOverride: {
          destinationIntegrationId: "mode-int",
          destinationExternalCalendarId: null,
        },
        eventTypeOverride: eventType,
        expertDefault,
      })
    ).toEqual({
      expertIntegrationId: "et-int",
      externalCalendarId: "et-cal",
    })
  })
})
