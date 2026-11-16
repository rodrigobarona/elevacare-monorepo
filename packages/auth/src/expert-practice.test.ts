import { describe, expect, it, vi } from "vitest"

// Build real Drizzle SQL without a database connection.
vi.mock("@eleva/db", async () => {
  const actual = await vi.importActual<typeof import("@eleva/db")>("@eleva/db")
  const { drizzle } = await import("drizzle-orm/neon-http")
  return { ...actual, db: () => drizzle.mock() }
})

import {
  expertPracticeViolation,
  expertMembershipsQuery,
  pickOwnedPractice,
  secondExpertPracticeViolation,
} from "./expert-practice"

const practice = {
  orgId: "o1",
  slug: "patricia-mota-pt",
  name: "Patricia Mota PT",
}

describe("expertMembershipsQuery", () => {
  it("reads only this person's expert organizations", () => {
    const { params } = expertMembershipsQuery("user-1").toSQL()
    expect(params).toEqual(expect.arrayContaining(["user-1", "expert"]))
  })
})

describe("pickOwnedPractice", () => {
  const row = (role: string, slug = "patricia-mota-pt") => ({
    orgId: `org-${slug}`,
    slug,
    name: slug,
    role,
  })

  it("counts the practice the person owns, including role lists", () => {
    expect(pickOwnedPractice([row("owner")])?.slug).toBe("patricia-mota-pt")
    expect(pickOwnedPractice([row("owner,admin")])?.slug).toBe(
      "patricia-mota-pt"
    )
  })

  it("ignores an admin or member seat in someone else's practice", () => {
    expect(pickOwnedPractice([row("admin"), row("member", "other")])).toBeNull()
    expect(
      pickOwnedPractice([row("admin", "helping"), row("owner", "mine")])?.slug
    ).toBe("mine")
  })
})

describe("expertPracticeViolation", () => {
  it("refuses a second expert practice and names the first", () => {
    expect(expertPracticeViolation("expert", practice)).toContain(
      "patricia-mota-pt"
    )
  })

  it("allows a first practice and any team, academy or Space", () => {
    expect(expertPracticeViolation("expert", null)).toBeNull()
    for (const type of ["team", "academy", "personal"]) {
      expect(expertPracticeViolation(type, practice)).toBeNull()
    }
  })
})

describe("secondExpertPracticeViolation (Better Auth guard)", () => {
  it("refuses an owner's second practice", async () => {
    const find = vi.fn(async () => practice)
    await expect(
      secondExpertPracticeViolation({ type: "expert" }, "user-1", find)
    ).resolves.toContain("patricia-mota-pt")
    expect(find).toHaveBeenCalledWith("user-1")
  })

  it("lets someone with no practice of their own create one", async () => {
    // An admin, delegate or clinic member owns no expert practice.
    const find = vi.fn(async () => null)
    await expect(
      secondExpertPracticeViolation({ type: "expert" }, "user-2", find)
    ).resolves.toBeNull()
  })

  it("never looks anything up for other organization types", async () => {
    const find = vi.fn(async () => practice)
    for (const type of ["team", "academy", "personal"]) {
      await expect(
        secondExpertPracticeViolation({ type }, "user-1", find)
      ).resolves.toBeNull()
    }
    expect(find).not.toHaveBeenCalled()
  })
})
