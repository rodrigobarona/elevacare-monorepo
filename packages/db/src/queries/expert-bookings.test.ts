import { describe, expect, it } from "vitest"
import { memberFirstName } from "./expert-bookings"

describe("memberFirstName", () => {
  it("uses the name typed at booking", () => {
    expect(memberFirstName("Ana Maria Silva", null)).toBe("Ana")
    expect(memberFirstName("  Ana  ", "Other Name")).toBe("Ana")
  })

  it("uses the account name for a member who booked signed in", () => {
    expect(memberFirstName(null, "Rui Costa")).toBe("Rui")
    expect(memberFirstName("   ", "Rui Costa")).toBe("Rui")
  })

  it("is null when there is no name at all", () => {
    expect(memberFirstName(null, null)).toBeNull()
    expect(memberFirstName("", "  ")).toBeNull()
  })
})
