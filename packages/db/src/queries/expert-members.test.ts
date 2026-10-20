import { beforeEach, describe, expect, it, vi } from "vitest"

const { rows } = vi.hoisted(() => ({ rows: { current: [] as unknown[] } }))

vi.mock("../context", () => ({
  withOrgContext: async (_orgId: string, fn: (tx: unknown) => unknown) => {
    const chain = {
      select: () => chain,
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      limit: async () => rows.current,
    }
    return fn(chain)
  },
}))

import { getExpertMember, listExpertMembers } from "./expert-members"

const title = { en: "First visit" }

function booking(input: {
  id: string
  startsAt: string
  memberUserId?: string | null
  guestName?: string | null
  guestEmail?: string | null
  userName?: string | null
  userEmail?: string | null
}) {
  const startsAt = new Date(input.startsAt)
  return {
    id: input.id,
    status: "confirmed",
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
    sessionMode: "online",
    memberUserId: input.memberUserId ?? null,
    guestName: input.guestName ?? null,
    guestEmail: input.guestEmail ?? null,
    userName: input.userName ?? null,
    userEmail: input.userEmail ?? null,
    eventTypeTitle: title,
  }
}

const NOW = new Date("2026-10-20T12:00:00.000Z")

describe("listExpertMembers", () => {
  beforeEach(() => {
    rows.current = []
  })

  // Grouping, counts and the status allowlist run in SQL; this covers the
  // row mapping. Live check: summed sessionCount equals eligible bookings.
  it("maps aggregated rows to dates and numbers", async () => {
    rows.current = [
      {
        memberUserId: "u1",
        name: "Ana Silva",
        email: "ana@example.test",
        sessionCount: "3",
        lastSessionAt: "2026-10-01T09:00:00.000Z",
        nextSessionAt: "2026-11-01T09:00:00.000Z",
      },
      {
        memberUserId: null,
        name: "Rui Costa",
        email: "Rui@Example.test",
        sessionCount: 2,
        lastSessionAt: "2026-10-10T09:00:00.000Z",
        nextSessionAt: null,
      },
    ]

    expect(await listExpertMembers("org-1", "exp-1", NOW)).toEqual([
      {
        memberUserId: "u1",
        name: "Ana Silva",
        email: "ana@example.test",
        sessionCount: 3,
        lastSessionAt: new Date("2026-10-01T09:00:00.000Z"),
        nextSessionAt: new Date("2026-11-01T09:00:00.000Z"),
      },
      {
        memberUserId: null,
        name: "Rui Costa",
        email: "Rui@Example.test",
        sessionCount: 2,
        lastSessionAt: new Date("2026-10-10T09:00:00.000Z"),
        nextSessionAt: null,
      },
    ])
  })
})

describe("getExpertMember", () => {
  it("returns null when the member has no bookings with this expert", async () => {
    rows.current = []
    expect(await getExpertMember("org-1", "exp-1", "u1")).toBeNull()
  })

  it("prefers the booking guest name over the account name", async () => {
    rows.current = [
      booking({
        id: "b1",
        startsAt: "2026-10-01T09:00:00Z",
        memberUserId: "u1",
        guestName: "Ana S.",
        userName: "Ana Silva",
        userEmail: "ana@example.test",
      }),
    ]
    const detail = await getExpertMember("org-1", "exp-1", "u1")
    expect(detail).toMatchObject({
      memberUserId: "u1",
      name: "Ana S.",
      email: "ana@example.test",
    })
    expect(detail?.sessions.map((s) => s.id)).toEqual(["b1"])
  })
})
