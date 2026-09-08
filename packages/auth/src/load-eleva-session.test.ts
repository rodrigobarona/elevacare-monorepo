import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({
  db: () => ({ select: () => ({}) }),
  auth: {
    organization: { id: "id", type: "type", slug: "slug" },
    member: {
      role: "role",
      userId: "user_id",
      organizationId: "organization_id",
    },
  },
}))

import { pickMembershipRow } from "./load-eleva-session"

const rows = [
  { orgId: "org-a", orgSlug: "alice-space" },
  { orgId: "org-b", orgSlug: "clinic" },
]

describe("pickMembershipRow", () => {
  it("returns null when preferredOrgSlug does not match", () => {
    expect(
      pickMembershipRow(rows, {
        orgId: "org-a",
        preferredOrgSlug: "missing",
      })
    ).toBeNull()
  })

  it("returns the matching slug even when orgId differs", () => {
    expect(
      pickMembershipRow(rows, {
        orgId: "org-a",
        preferredOrgSlug: "clinic",
      })
    ).toEqual({ orgId: "org-b", orgSlug: "clinic" })
  })

  it("falls back to orgId then first row when no slug is requested", () => {
    expect(pickMembershipRow(rows, { orgId: "org-b" })).toEqual({
      orgId: "org-b",
      orgSlug: "clinic",
    })
    expect(pickMembershipRow(rows, { orgId: null })).toEqual(rows[0])
  })

  it("returns null for an empty membership list", () => {
    expect(pickMembershipRow([], { orgId: "org-a" })).toBeNull()
  })
})
