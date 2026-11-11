import { describe, expect, it } from "vitest"
import {
  afterMeetingEnded,
  appendParticipantHistory,
  deriveAttendance,
  eventTimeFromDaily,
  lastLeftAt,
  nextLifecycleState,
  shouldApplyEvent,
  statusAfterAttendance,
  type LifecycleSession,
} from "./attendance"

/** A session booked 10:00–11:00 UTC on 16 November. */
const T = (clock: string) => new Date(`2026-11-16T${clock}:00.000Z`)
const booked = { start: T("10:00"), end: T("11:00") }

function was(
  role: "expert" | "member" | "delegate",
  from: string,
  to?: string
) {
  return {
    role,
    joinedAt: T(from).toISOString(),
    ...(to ? { leftAt: T(to).toISOString() } : {}),
  }
}

const met = [was("expert", "10:00", "10:50"), was("member", "10:02", "10:50")]

describe("deriveAttendance", () => {
  it("is both only when expert and member were in the room together", () => {
    expect(deriveAttendance(met, booked)).toBe("both")
    // Still in the room counts as there until now.
    expect(
      deriveAttendance([was("expert", "10:00"), was("member", "10:05")], booked)
    ).toBe("both")
  })

  it("names the one who came when the other never did", () => {
    expect(deriveAttendance([was("expert", "10:00", "10:20")], booked)).toBe(
      "expert_only"
    )
    expect(deriveAttendance([was("member", "10:00", "10:20")], booked)).toBe(
      "member_only"
    )
    expect(deriveAttendance([was("delegate", "10:00")], booked)).toBe("nobody")
    expect(deriveAttendance([], booked)).toBe("nobody")
  })

  it("does not call it a meeting when the two were never there together", () => {
    // The expert checked the room before the start and never came back.
    expect(
      deriveAttendance(
        [was("expert", "09:52", "09:55"), was("member", "10:00", "10:25")],
        booked
      )
    ).toBe("member_only")
    // The member waited the whole hour; the expert opened the room after.
    expect(
      deriveAttendance(
        [was("member", "10:00", "11:02"), was("expert", "11:05", "11:10")],
        booked
      )
    ).toBe("member_only")
    // The expert waited; the member came once the expert had left.
    expect(
      deriveAttendance(
        [was("expert", "10:00", "10:30"), was("member", "10:40", "10:45")],
        booked
      )
    ).toBe("expert_only")
    // Leaving as the other arrives is not meeting.
    expect(
      deriveAttendance(
        [was("expert", "10:00", "10:10"), was("member", "10:10", "10:20")],
        booked
      )
    ).toBe("nobody")
    // Neither was there during the booked time.
    expect(
      deriveAttendance(
        [was("expert", "09:40", "09:45"), was("member", "11:10", "11:20")],
        booked
      )
    ).toBe("nobody")
  })
})

describe("statusAfterAttendance", () => {
  it("marks no-show unless both sides joined", () => {
    expect(statusAfterAttendance("both")).toBe("ended")
    expect(statusAfterAttendance("expert_only")).toBe("no_show")
    expect(statusAfterAttendance("nobody")).toBe("no_show")
  })
})

describe("lastLeftAt", () => {
  it("is when the room last emptied", () => {
    expect(lastLeftAt(met)).toEqual(T("10:50"))
    expect(lastLeftAt([was("expert", "10:00")])).toBeNull()
    expect(lastLeftAt([])).toBeNull()
  })
})

describe("afterMeetingEnded", () => {
  it("keeps the session joinable when the room empties before the booked end", () => {
    // The expert checked the room ten minutes early and left.
    expect(
      afterMeetingEnded({
        status: "live",
        participants: [was("expert", "09:50", "09:52")],
        at: T("09:52"),
        booked,
      })
    ).toEqual({ final: false, status: "scheduled" })
    // Both dropped mid-session on a bad connection.
    expect(
      afterMeetingEnded({
        status: "live",
        participants: [
          was("expert", "10:00", "10:30"),
          was("member", "10:00", "10:30"),
        ],
        at: T("10:30"),
        booked,
      })
    ).toEqual({ final: false, status: "scheduled" })
  })

  it("closes a session that happened, once the booked end has passed", () => {
    expect(
      afterMeetingEnded({
        status: "live",
        participants: [
          was("expert", "10:00", "11:00"),
          was("member", "10:00", "11:00"),
        ],
        at: T("11:00"),
        booked,
      })
    ).toEqual({ final: true, status: "ended", attendance: "both" })
  })

  it("never declares a no-show: that waits for the join window to close", () => {
    // The member waited past the booked end and left; the expert may still come.
    expect(
      afterMeetingEnded({
        status: "live",
        participants: [was("member", "10:00", "11:05")],
        at: T("11:05"),
        booked,
      })
    ).toEqual({ final: false, status: "scheduled" })
    expect(
      afterMeetingEnded({
        status: "scheduled",
        participants: [],
        at: T("11:10"),
        booked,
      })
    ).toEqual({ final: false, status: "scheduled" })
  })

  it("never reopens or rewrites a session that is already closed", () => {
    for (const status of ["ended", "no_show", "cancelled", "completed"]) {
      for (const at of [T("10:30"), T("11:30")]) {
        expect(
          afterMeetingEnded({ status, participants: met, at, booked })
        ).toEqual({ final: false, status })
      }
    }
  })

  it("leaves a room that was never resolved as it is", () => {
    expect(
      afterMeetingEnded({
        status: "room_unresolved",
        participants: [],
        at: T("10:30"),
        booked,
      })
    ).toEqual({ final: false, status: "room_unresolved" })
  })
})

describe("nextLifecycleState", () => {
  const fresh: LifecycleSession<string> = {
    status: "scheduled",
    startedAt: null,
    endedAt: null,
    lastEventAt: null,
    participants: [],
    booked,
  }

  /** Apply events in order, carrying the session forward as the webhook does. */
  function play(
    events: { type: string; at: Date; participants?: typeof met }[],
    from: LifecycleSession<string> = fresh
  ) {
    let session = from
    let closedWith: string | null = null
    for (const event of events) {
      if (event.participants)
        session = { ...session, participants: event.participants }
      const next = nextLifecycleState(session, event)
      if (next.attendance) closedWith = next.attendance
      session = { ...session, ...next }
    }
    return { session, closedWith }
  }

  it("survives an early room check: start, empty, start again, finish", () => {
    const { session, closedWith } = play([
      { type: "meeting.started", at: T("09:50") },
      {
        type: "meeting.ended",
        at: T("09:52"),
        participants: [was("expert", "09:50", "09:52")],
      },
      { type: "meeting.started", at: T("10:00") },
      {
        type: "meeting.ended",
        at: T("11:01"),
        participants: [
          was("expert", "09:50", "09:52"),
          was("expert", "10:00", "11:01"),
          was("member", "10:01", "11:01"),
        ],
      },
    ])
    expect(session.status).toBe("ended")
    expect(closedWith).toBe("both")
    // The first start is kept; the end is the event that closed it.
    expect(session.startedAt).toEqual(T("09:50"))
    expect(session.endedAt).toEqual(T("11:01"))
  })

  it("goes back to scheduled, with no end time, when the room only emptied", () => {
    const { session, closedWith } = play([
      { type: "meeting.started", at: T("10:00") },
      { type: "meeting.ended", at: T("10:30"), participants: met },
    ])
    expect(session.status).toBe("scheduled")
    expect(session.endedAt).toBeNull()
    expect(closedWith).toBeNull()
    expect(session.lastEventAt).toEqual(T("10:30"))
  })

  it("ignores an event older than the last one applied", () => {
    const { session } = play([
      { type: "meeting.started", at: T("10:00") },
      { type: "meeting.ended", at: T("10:30"), participants: met },
      // A late duplicate of the first start must not make it live again.
      { type: "meeting.started", at: T("10:00") },
    ])
    expect(session.status).toBe("scheduled")
    expect(session.lastEventAt).toEqual(T("10:30"))
  })

  it("does not reopen a session the sweep already closed", () => {
    const closed = { ...fresh, status: "no_show", endedAt: T("11:30") }
    const { session } = play(
      [
        { type: "meeting.started", at: T("11:40") },
        { type: "meeting.ended", at: T("11:45"), participants: met },
      ],
      closed
    )
    expect(session.status).toBe("no_show")
    expect(session.endedAt).toEqual(T("11:30"))
  })

  it("closes at the booked end exactly", () => {
    const { session } = play([
      { type: "meeting.started", at: T("10:00") },
      { type: "meeting.ended", at: T("11:00"), participants: met },
    ])
    expect(session.status).toBe("ended")
  })
})

describe("appendParticipantHistory", () => {
  it("appends a join and closes the latest matching leave", () => {
    const joined = appendParticipantHistory([], {
      role: "member",
      userId: "m1",
      at: new Date("2026-10-07T10:02:00.000Z"),
      kind: "joined",
    })
    expect(joined).toEqual([
      {
        role: "member",
        userId: "m1",
        joinedAt: "2026-10-07T10:02:00.000Z",
      },
    ])
    expect(
      appendParticipantHistory(joined, {
        role: "member",
        userId: "m1",
        at: new Date("2026-10-07T10:31:00.000Z"),
        kind: "left",
      })[0]?.leftAt
    ).toBe("2026-10-07T10:31:00.000Z")
  })
})

describe("shouldApplyEvent", () => {
  it("rejects an older event timestamp", () => {
    expect(
      shouldApplyEvent(
        new Date("2026-10-07T10:31:00.000Z"),
        new Date("2026-10-07T10:02:00.000Z")
      )
    ).toBe(false)
    expect(
      shouldApplyEvent(
        new Date("2026-10-07T10:02:00.000Z"),
        new Date("2026-10-07T10:31:00.000Z")
      )
    ).toBe(true)
    expect(
      shouldApplyEvent(
        new Date("2026-10-07T10:31:00.000Z"),
        new Date("2026-10-07T10:31:00.000Z")
      )
    ).toBe(false)
  })
})

describe("eventTimeFromDaily clock check", () => {
  const received = T("10:00")

  it("distrusts a time further ahead than clocks drift", () => {
    expect(eventTimeFromDaily(T("10:04").getTime(), received)).toEqual(
      T("10:04")
    )
    expect(eventTimeFromDaily(T("11:30").getTime(), received)).toEqual(received)
  })

  it("accepts a late delivery of an earlier event", () => {
    expect(eventTimeFromDaily(T("09:30").getTime(), received)).toEqual(
      T("09:30")
    )
  })
})

describe("eventTimeFromDaily", () => {
  it("accepts unix seconds and milliseconds", () => {
    // Received a few seconds after it happened.
    const received = new Date("2024-02-21T14:34:00.000Z")
    const seconds = eventTimeFromDaily(1708526032, received)
    const millis = eventTimeFromDaily(1708526032000, received)
    expect(seconds.getTime()).toBe(millis.getTime())
    expect(seconds.toISOString()).toBe("2024-02-21T14:33:52.000Z")
  })

  it("falls back to when we received it if the time is missing", () => {
    const received = new Date("2024-02-21T14:34:00.000Z")
    expect(eventTimeFromDaily(undefined, received)).toBe(received)
    expect(eventTimeFromDaily(Number.NaN, received)).toBe(received)
  })
})
