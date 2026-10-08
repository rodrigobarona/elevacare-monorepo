import { describe, expect, it } from "vitest"
import {
  JOIN_LEAD_MS,
  JOIN_TRAIL_MS,
  ROOM_NAME_PREFIX,
  buildSessionRoomBody,
  isElevaRoomName,
  roomMatchesContract,
  roomNameForBooking,
  roomUrlFor,
  tokenExpUnix,
  unixSeconds,
} from "./room-options"

const BOOKING_ID = "11111111-1111-4111-8111-111111111111"

describe("roomNameForBooking", () => {
  it("prefixes a UUID with eleva-", () => {
    expect(roomNameForBooking(BOOKING_ID)).toBe(
      `${ROOM_NAME_PREFIX}${BOOKING_ID}`
    )
  })

  it("rejects a non-UUID so we never mint a room for an arbitrary string", () => {
    expect(() => roomNameForBooking("not-a-uuid")).toThrow(/UUID/)
  })

  it("lowercases the UUID so case variants share one room name", () => {
    expect(roomNameForBooking(BOOKING_ID.toUpperCase())).toBe(
      `${ROOM_NAME_PREFIX}${BOOKING_ID}`
    )
  })
})

describe("isElevaRoomName", () => {
  it("only matches the product prefix", () => {
    expect(isElevaRoomName(`eleva-${BOOKING_ID}`)).toBe(true)
    expect(isElevaRoomName("random-room")).toBe(false)
  })
})

describe("buildSessionRoomBody", () => {
  const startAt = new Date("2026-10-07T10:00:00.000Z")
  const endAt = new Date("2026-10-07T11:00:00.000Z")

  it("builds a private room with recording off and the join window", () => {
    const body = buildSessionRoomBody({
      bookingId: BOOKING_ID,
      startAt,
      endAt,
    })

    expect(body.name).toBe(`eleva-${BOOKING_ID}`)
    expect(body.privacy).toBe("private")
    expect(body.properties).not.toHaveProperty("enable_recording")
    expect(body.properties).not.toHaveProperty("enable_recording_ui")
    expect(body.properties).not.toHaveProperty("start_cloud_recording")
    expect(body.properties.eject_at_room_exp).toBe(true)
    expect(body.properties.max_participants).toBe(2)
    expect(body.properties.nbf).toBe(
      unixSeconds(new Date(startAt.getTime() - JOIN_LEAD_MS))
    )
    expect(body.properties.exp).toBe(
      unixSeconds(new Date(endAt.getTime() + JOIN_TRAIL_MS))
    )
    expect(body.properties.lang).toBe("pt")
  })

  it("adds extra participants to the cap", () => {
    const body = buildSessionRoomBody({
      bookingId: BOOKING_ID,
      startAt,
      endAt,
      extraParticipants: 1,
      lang: "en",
    })
    expect(body.properties.max_participants).toBe(3)
    expect(body.properties.lang).toBe("en")
  })

  it("rejects inverted times", () => {
    expect(() =>
      buildSessionRoomBody({
        bookingId: BOOKING_ID,
        startAt: endAt,
        endAt: startAt,
      })
    ).toThrow(/endAt/)
  })

  it("rejects invalid dates", () => {
    expect(() =>
      buildSessionRoomBody({
        bookingId: BOOKING_ID,
        startAt: new Date("not-a-date"),
        endAt,
      })
    ).toThrow(/valid dates/)
  })
})

describe("tokenExpUnix", () => {
  it("caps at two hours from now when the window is longer", () => {
    const now = new Date("2026-10-07T10:00:00.000Z")
    const endAt = new Date("2026-10-07T18:00:00.000Z")
    expect(tokenExpUnix(now, endAt)).toBe(
      unixSeconds(new Date(now.getTime() + 2 * 60 * 60 * 1000))
    )
  })

  it("uses the room trail when that is sooner", () => {
    const now = new Date("2026-10-07T10:50:00.000Z")
    const endAt = new Date("2026-10-07T11:00:00.000Z")
    expect(tokenExpUnix(now, endAt)).toBe(
      unixSeconds(new Date(endAt.getTime() + JOIN_TRAIL_MS))
    )
  })
})

describe("roomUrlFor", () => {
  it("uses the full host when a domain is already qualified", () => {
    expect(roomUrlFor("eleva-x", "eleva.daily.co")).toBe(
      "https://eleva.daily.co/eleva-x"
    )
  })

  it("appends .daily.co when only the subdomain is stored", () => {
    expect(roomUrlFor("eleva-x", "eleva")).toBe(
      "https://eleva.daily.co/eleva-x"
    )
  })
})

describe("roomMatchesContract", () => {
  const expected = buildSessionRoomBody({
    bookingId: BOOKING_ID,
    startAt: new Date("2026-10-07T10:00:00.000Z"),
    endAt: new Date("2026-10-07T11:00:00.000Z"),
  }).properties

  it("accepts a private room with recording off and matching window", () => {
    expect(
      roomMatchesContract(
        {
          privacy: "private",
          config: {
            nbf: expected.nbf,
            exp: expected.exp,
            max_participants: expected.max_participants,
            enable_recording: "",
            eject_at_room_exp: true,
          },
        },
        expected
      )
    ).toBe(true)
  })

  it("rejects a recording UI leftover and a stale window", () => {
    expect(
      roomMatchesContract(
        {
          privacy: "private",
          config: {
            ...expected,
            enable_recording_ui: true,
          },
        },
        expected
      )
    ).toBe(false)
    expect(
      roomMatchesContract(
        {
          privacy: "private",
          config: {
            ...expected,
            nbf: expected.nbf - 60,
          },
        },
        expected
      )
    ).toBe(false)
  })

  it("rejects a room whose participant cap is above the requested limit", () => {
    expect(
      roomMatchesContract(
        {
          privacy: "private",
          config: {
            ...expected,
            max_participants: expected.max_participants + 3,
          },
        },
        expected
      )
    ).toBe(false)
  })

  it("rejects a room that does not eject at expiry", () => {
    expect(
      roomMatchesContract(
        {
          privacy: "private",
          config: {
            ...expected,
            eject_at_room_exp: false,
          },
        },
        expected
      )
    ).toBe(false)
  })

  it("rejects recording-on rooms so we never adopt a HIPAA-style leftover", () => {
    expect(
      roomMatchesContract(
        {
          privacy: "private",
          config: {
            nbf: expected.nbf,
            exp: expected.exp,
            max_participants: expected.max_participants,
            enable_recording: "cloud",
            enable_recording_ui: false,
          },
        },
        expected
      )
    ).toBe(false)
  })
})
