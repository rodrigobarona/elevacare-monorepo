import { describe, expect, it } from "vitest"
import { pickServiceSlots, type UpcomingModeSlots } from "./upcoming-slots"

const base = {
  locationLabel: null,
  mode: "online" as const,
}

describe("pickServiceSlots", () => {
  it("merges every mode of one service, soonest first", () => {
    const modes: UpcomingModeSlots[] = [
      {
        ...base,
        eventSlug: "first-visit",
        modeId: "video",
        starts: ["2026-11-10T10:00:00Z", "2026-11-09T09:00:00Z"],
      },
      {
        ...base,
        eventSlug: "first-visit",
        modeId: "clinic",
        mode: "in_person",
        locationLabel: "Lisbon",
        starts: ["2026-11-09T08:00:00Z"],
      },
      {
        ...base,
        eventSlug: "follow-up",
        modeId: "other",
        starts: ["2026-11-08T08:00:00Z"],
      },
    ]

    const slots = pickServiceSlots(modes, "first-visit")

    expect(slots.map((slot) => [slot.modeId, slot.start])).toEqual([
      ["clinic", "2026-11-09T08:00:00Z"],
      ["video", "2026-11-09T09:00:00Z"],
      ["video", "2026-11-10T10:00:00Z"],
    ])
    expect(slots[0]?.locationLabel).toBe("Lisbon")
  })

  it("keeps one time per way to meet when two start together", () => {
    const start = "2026-11-09T09:00:00Z"
    const slots = pickServiceSlots(
      [
        { ...base, eventSlug: "a", modeId: "video", starts: [start] },
        {
          ...base,
          eventSlug: "a",
          modeId: "lisbon",
          mode: "in_person",
          locationLabel: "Lisbon",
          starts: [start],
        },
        {
          ...base,
          eventSlug: "a",
          modeId: "porto",
          mode: "in_person",
          locationLabel: "Porto",
          starts: [start],
        },
      ],
      "a"
    )
    expect(slots.map((slot) => slot.modeId).sort()).toEqual([
      "lisbon",
      "porto",
      "video",
    ])
    expect(slots.every((slot) => slot.start === start)).toBe(true)
  })

  it("caps the list", () => {
    const starts = Array.from(
      { length: 10 },
      (_, index) => `2026-11-${String(10 + index).padStart(2, "0")}T09:00:00Z`
    )
    const slots = pickServiceSlots(
      [{ ...base, eventSlug: "a", modeId: "m", starts }],
      "a",
      4
    )
    expect(slots).toHaveLength(4)
    expect(slots[0]?.start).toBe(starts[0])
  })

  it("returns nothing for a service without times", () => {
    expect(
      pickServiceSlots(
        [{ ...base, eventSlug: "a", modeId: "m", starts: [] }],
        "a"
      )
    ).toEqual([])
  })
})
