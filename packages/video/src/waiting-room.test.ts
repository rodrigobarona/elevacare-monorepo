import { describe, expect, it } from "vitest"
import {
  AUTO_JOIN_PAUSES_MS,
  autoJoinDelay,
  minutesUntilOpen,
  opensAnotherDay,
  readJoinWindow,
  waitingPhase,
  type JoinWindow,
} from "./waiting-room"

const T = (iso: string) => Date.parse(iso)
const details = {
  startsAt: "2026-11-16T10:00:00.000Z",
  opensAt: "2026-11-16T09:45:00.000Z",
  closesAt: "2026-11-16T11:30:00.000Z",
  now: "2026-11-16T09:30:00.000Z",
}

function windowAt(deviceNow: string, overrides = {}): JoinWindow {
  const window = readJoinWindow({ ...details, ...overrides }, T(deviceNow))
  if (!window) throw new Error("expected a window")
  return window
}

describe("readJoinWindow", () => {
  it("reads the times and the gap between server and device clocks", () => {
    expect(readJoinWindow(details, T("2026-11-16T09:30:00.000Z"))).toEqual({
      startsAt: T(details.startsAt),
      opensAt: T(details.opensAt),
      closesAt: T(details.closesAt),
      skewMs: 0,
    })
    // Device clock five minutes fast.
    expect(readJoinWindow(details, T("2026-11-16T09:35:00.000Z"))?.skewMs).toBe(
      -5 * 60_000
    )
  })

  it("works without the newer fields", () => {
    expect(
      readJoinWindow(
        { startsAt: details.startsAt, opensAt: details.opensAt },
        T("2026-11-16T09:30:00.000Z")
      )
    ).toEqual({
      startsAt: T(details.startsAt),
      opensAt: T(details.opensAt),
      closesAt: null,
      skewMs: 0,
    })
  })

  it("refuses details it cannot trust", () => {
    expect(readJoinWindow({}, 0)).toBeNull()
    expect(readJoinWindow({ startsAt: "soon", opensAt: "later" }, 0)).toBeNull()
    expect(
      readJoinWindow(
        { startsAt: details.opensAt, opensAt: details.startsAt },
        0
      )
    ).toBeNull()
  })

  it("refuses dates no session could have", () => {
    expect(
      readJoinWindow({ ...details, startsAt: "+275760-09-13T00:00:00.000Z" }, 0)
    ).toBeNull()
    // An absurd server time is ignored: the device clock is used as it is.
    expect(
      windowAt(details.now, { now: "1970-01-01T00:00:00.000Z" }).skewMs
    ).toBe(0)
  })

  it("ignores a close time that is not after the start", () => {
    expect(
      windowAt(details.now, { closesAt: details.opensAt }).closesAt
    ).toBeNull()
  })
})

describe("waitingPhase", () => {
  it("is early until joining opens, then opening, then ended", () => {
    const window = windowAt(details.now)
    expect(waitingPhase(window, T("2026-11-16T09:44:59.000Z"))).toBe("early")
    expect(waitingPhase(window, T("2026-11-16T09:45:00.000Z"))).toBe("opening")
    expect(waitingPhase(window, T("2026-11-16T11:30:00.000Z"))).toBe("opening")
    expect(waitingPhase(window, T("2026-11-16T11:30:01.000Z"))).toBe("ended")
  })

  it("follows the server clock when the device clock is wrong", () => {
    // Device says 09:50 while the server says 09:30: still early at 10:04.
    const window = windowAt("2026-11-16T09:50:00.000Z")
    expect(waitingPhase(window, T("2026-11-16T10:04:59.000Z"))).toBe("early")
    expect(waitingPhase(window, T("2026-11-16T10:05:00.000Z"))).toBe("opening")
  })

  it("never calls a session ended when the API gave no close time", () => {
    const window = windowAt(details.now, { closesAt: undefined })
    expect(waitingPhase(window, T("2026-11-17T09:00:00.000Z"))).toBe("opening")
  })
})

describe("minutesUntilOpen", () => {
  it("rounds up and stops at zero", () => {
    const window = windowAt(details.now)
    expect(minutesUntilOpen(window, T("2026-11-16T09:30:00.000Z"))).toBe(15)
    expect(minutesUntilOpen(window, T("2026-11-16T09:44:01.000Z"))).toBe(1)
    expect(minutesUntilOpen(window, T("2026-11-16T09:45:00.000Z"))).toBe(0)
    expect(minutesUntilOpen(window, T("2026-11-16T10:00:00.000Z"))).toBe(0)
  })
})

describe("autoJoinDelay", () => {
  it("spreads the first try and then backs off", () => {
    expect(autoJoinDelay(0)).toBe(500)
    expect(autoJoinDelay(0, 0.999)).toBe(1_998)
    expect(autoJoinDelay(1, 0.999)).toBe(3_000)
    expect(autoJoinDelay(4)).toBe(20_000)
  })

  it("stops asking after the last pause", () => {
    expect(autoJoinDelay(AUTO_JOIN_PAUSES_MS.length)).toBeNull()
    // At most five automatic requests, well inside the public rate limit.
    expect(AUTO_JOIN_PAUSES_MS.length).toBeLessThanOrEqual(5)
  })
})

describe("opensAnotherDay", () => {
  it("compares calendar days in the viewer's time zone", () => {
    const window = windowAt(details.now)
    expect(
      opensAnotherDay(window, T("2026-11-16T09:30:00.000Z"), "Europe/Lisbon")
    ).toBe(false)
    expect(
      opensAnotherDay(window, T("2026-11-15T22:00:00.000Z"), "Europe/Lisbon")
    ).toBe(true)
  })
})
