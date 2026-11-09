import { describe, expect, it } from "vitest"
import {
  addDaysToKey,
  dateKeyInZone,
  groupSlotsByDay,
  zoneCity,
  zoneOffsetLabel,
} from "./slot-groups"

describe("dateKeyInZone", () => {
  it("keeps a Lisbon afternoon on the same civil day", () => {
    expect(dateKeyInZone("2026-09-15T14:00:00.000Z", "Europe/Lisbon")).toBe(
      "2026-09-15"
    )
  })

  it("rolls a late UTC slot into the next Sao Paulo day", () => {
    expect(dateKeyInZone("2026-09-16T02:30:00.000Z", "America/Sao_Paulo")).toBe(
      "2026-09-15"
    )
  })
})

describe("groupSlotsByDay", () => {
  it("groups and sorts slots by civil day in the member timezone", () => {
    const groups = groupSlotsByDay(
      [
        { start: "2026-09-16T09:00:00.000Z", end: "2026-09-16T10:00:00.000Z" },
        { start: "2026-09-15T14:00:00.000Z", end: "2026-09-15T15:00:00.000Z" },
        { start: "2026-09-16T08:00:00.000Z", end: "2026-09-16T09:00:00.000Z" },
      ],
      "Europe/Lisbon"
    )
    expect(groups.map((group) => group.dateKey)).toEqual([
      "2026-09-15",
      "2026-09-16",
    ])
    expect(groups[1]?.slots.map((slot) => slot.start)).toEqual([
      "2026-09-16T08:00:00.000Z",
      "2026-09-16T09:00:00.000Z",
    ])
  })
})

describe("zone labels", () => {
  it("names the city of a zone", () => {
    expect(zoneCity("Europe/Lisbon")).toBe("Lisbon")
    expect(zoneCity("America/Sao_Paulo")).toBe("Sao Paulo")
    expect(zoneCity("UTC")).toBe("UTC")
  })

  it("gives the UTC offset at an instant", () => {
    const winter = new Date("2026-01-15T12:00:00.000Z")
    const summer = new Date("2026-07-15T12:00:00.000Z")
    expect(zoneOffsetLabel("Europe/Lisbon", winter)).toBe("UTC+00:00")
    expect(zoneOffsetLabel("Europe/Lisbon", summer)).toBe("UTC+01:00")
    expect(zoneOffsetLabel("Europe/Madrid", winter)).toBe("UTC+01:00")
  })
})

describe("addDaysToKey", () => {
  it("crosses month and year ends", () => {
    expect(addDaysToKey("2026-11-30", 2)).toBe("2026-12-02")
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28")
  })
})
