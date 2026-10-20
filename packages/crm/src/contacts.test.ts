import { describe, expect, it } from "vitest"
import type { ExpertMemberListItem } from "@eleva/db"
import type { CrmContactRow } from "@eleva/db/schema"
import { DEFAULT_MEMBER_STAGE, mergeContactList } from "./contacts"

const now = new Date("2026-10-20T10:00:00Z")

function row(overrides: Partial<CrmContactRow>): CrmContactRow {
  return {
    id: "c-1",
    orgId: "org-1",
    memberUserId: null,
    name: null,
    emailEncrypted: null,
    phoneEncrypted: null,
    lifecycleStage: "lead",
    tags: [],
    createdBy: "expert-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const member: ExpertMemberListItem = {
  memberUserId: "user-1",
  name: "Ana",
  email: "ana@example.test",
  sessionCount: 3,
  lastSessionAt: new Date("2026-10-01T09:00:00Z"),
  nextSessionAt: null,
}

const guest: ExpertMemberListItem = {
  memberUserId: null,
  name: "Guest",
  email: "guest@example.test",
  sessionCount: 1,
  lastSessionAt: null,
  nextSessionAt: new Date("2026-11-01T09:00:00Z"),
}

describe("mergeContactList", () => {
  it("defaults members without a CRM row to active and keeps booking stats", () => {
    const [item] = mergeContactList({
      members: [member],
      memberRows: [],
      leads: [],
      openFollowUps: new Map(),
    })
    expect(item).toMatchObject({
      id: null,
      source: "member",
      lifecycleStage: DEFAULT_MEMBER_STAGE,
      sessionCount: 3,
      lastSessionAt: "2026-10-01T09:00:00.000Z",
      openFollowUps: 0,
    })
  })

  it("overlays stage, tags and open follow-ups from the member's row", () => {
    const [item] = mergeContactList({
      members: [member],
      memberRows: [
        row({
          id: "c-9",
          memberUserId: "user-1",
          lifecycleStage: "dormant",
          tags: ["knee"],
        }),
      ],
      leads: [],
      openFollowUps: new Map([["c-9", 2]]),
    })
    expect(item).toMatchObject({
      id: "c-9",
      name: "Ana",
      lifecycleStage: "dormant",
      tags: ["knee"],
      openFollowUps: 2,
    })
  })

  it("lists leads first, then members and guests in booking order", () => {
    const list = mergeContactList({
      members: [member, guest],
      memberRows: [],
      leads: [
        {
          ...row({ id: "lead-1", name: "Rui" }),
          email: "rui@example.test",
          phone: null,
        },
      ],
      openFollowUps: new Map(),
    })
    expect(list.map((item) => item.source)).toEqual(["lead", "member", "guest"])
    expect(list[0]).toMatchObject({ name: "Rui", email: "rui@example.test" })
    expect(list[2]).toMatchObject({ id: null, memberUserId: null })
  })
})
