import { describe, expect, it } from "vitest"
import { pickUpcomingSlotRows, type UpcomingModeSlots } from "./upcoming-slots"

const FIRST: UpcomingModeSlots = {
  eventSlug: "first-visit",
  eventTitle: "Primera visita",
  modeId: "mode-video",
  mode: "online",
  locationLabel: null,
  starts: [
    "2026-10-13T08:00:00.000Z",
    "2026-10-13T08:30:00.000Z",
    "2026-10-13T09:00:00.000Z",
  ],
}

const FOLLOW: UpcomingModeSlots = {
  eventSlug: "follow-up",
  eventTitle: "Seguimiento",
  modeId: "mode-madrid",
  mode: "in_person",
  locationLabel: "Clínica, Madrid",
  starts: ["2026-10-13T10:00:00.000Z"],
}

describe("pickUpcomingSlotRows", () => {
  it("shows one soonest slot per offer when several exist", () => {
    const rows = pickUpcomingSlotRows([FIRST, FOLLOW])
    expect(rows.map((row) => row.eventSlug)).toEqual([
      "first-visit",
      "follow-up",
    ])
    expect(rows.map((row) => row.start)).toEqual([
      "2026-10-13T08:00:00.000Z",
      "2026-10-13T10:00:00.000Z",
    ])
  })

  it("fills extra times when the expert has a single offer", () => {
    const rows = pickUpcomingSlotRows([FIRST])
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.eventSlug === "first-visit")).toBe(true)
    expect(rows[2]?.start).toBe("2026-10-13T09:00:00.000Z")
  })

  it("omits offers with no upcoming slots", () => {
    const rows = pickUpcomingSlotRows([{ ...FOLLOW, starts: [] }, FIRST])
    expect(rows.map((row) => row.eventSlug)).toEqual([
      "first-visit",
      "first-visit",
      "first-visit",
    ])
  })

  it("picks the earlier mode when one offer has several", () => {
    const laterVideo: UpcomingModeSlots = {
      ...FIRST,
      starts: ["2026-10-14T08:00:00.000Z"],
    }
    const rows = pickUpcomingSlotRows([laterVideo, FOLLOW])
    expect(rows[0]).toMatchObject({
      eventSlug: "follow-up",
      start: "2026-10-13T10:00:00.000Z",
    })
    expect(rows[1]?.eventSlug).toBe("first-visit")
  })
})
