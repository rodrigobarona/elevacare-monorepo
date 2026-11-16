import { describe, expect, it } from "vitest"
import { findExistingPractice } from "./existing-practice"

const base = {
  orgSlug: "patricia-mota-pt",
  orgType: "expert",
  name: "Patricia Mota PT",
  productLabel: "expert" as const,
  membershipRole: "admin",
}

describe("findExistingPractice", () => {
  it("finds the expert practice the person runs", () => {
    const practice = findExistingPractice([
      {
        ...base,
        orgSlug: "space-abc",
        orgType: "personal",
        name: "Space",
        productLabel: "member",
      },
      base,
    ])
    expect(practice?.name).toBe("Patricia Mota PT")
    expect(practice?.href).toMatch(/\/expert\/patricia-mota-pt$/)
  })

  it("ignores clinic seats and people without a practice", () => {
    expect(
      findExistingPractice([
        {
          ...base,
          orgSlug: "clinica-mota",
          orgType: "team",
          membershipRole: "member",
        },
      ])
    ).toBeNull()
    expect(findExistingPractice([])).toBeNull()
  })
})
