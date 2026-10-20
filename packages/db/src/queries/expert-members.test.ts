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

  it("groups bookings per member, newest first, with last and next session", async () => {
    rows.current = [
      booking({
        id: "b4",
        startsAt: "2026-11-10T09:00:00.000Z",
        memberUserId: "u1",
        userName: "Ana Silva",
        userEmail: "ana@example.test",
      }),
      booking({
        id: "b3",
        startsAt: "2026-11-01T09:00:00.000Z",
        memberUserId: "u1",
        userName: "Ana Silva",
      }),
      booking({
        id: "b2",
        startsAt: "2026-10-10T09:00:00.000Z",
        guestName: "Rui Costa",
        guestEmail: "Rui@Example.test",
      }),
      booking({
        id: "b1",
        startsAt: "2026-10-01T09:00:00.000Z",
        memberUserId: "u1",
        userName: "Ana Silva",
      }),
      booking({
        id: "b0",
        startsAt: "2026-09-01T09:00:00.000Z",
        guestName: "Rui",
        guestEmail: "rui@example.test",
      }),
    ]

    const members = await listExpertMembers("org-1", "exp-1", NOW)

    expect(members).toEqual([
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

  it("skips bookings with no member id and no email", async () => {
    rows.current = [booking({ id: "b1", startsAt: "2026-10-01T09:00:00Z" })]
    expect(await listExpertMembers("org-1", "exp-1", NOW)).toEqual([])
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
