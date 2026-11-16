import { describe, expect, it, vi } from "vitest"

vi.mock("@eleva/db", () => ({ auth: {}, db: vi.fn() }))

import { expertPracticeViolation } from "./expert-practice"

const practice = {
  orgId: "o1",
  slug: "patricia-mota-pt",
  name: "Patricia Mota PT",
}

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
