import { describe, expect, it } from "vitest"
import { IssueInvoiceInput } from "./types"

const base = {
  bookingId: "00000000-0000-4000-8000-000000000010",
  expertProfileId: "00000000-0000-4000-8000-000000000001",
  member: {
    fiscalId: "999999990",
    name: "Member",
    country: "PT",
  },
  date: "2026-09-15",
}

describe("IssueInvoiceInput taxRate", () => {
  it("accepts a percentage without locking 23/13/6", () => {
    expect(
      IssueInvoiceInput.safeParse({
        ...base,
        lines: [
          {
            description: "Session",
            quantity: 1,
            unitPrice: 50,
            taxRate: 5,
            currency: "EUR",
          },
        ],
      }).success
    ).toBe(true)
  })

  it("rejects a taxRate that cannot be a percentage", () => {
    const parsed = IssueInvoiceInput.safeParse({
      ...base,
      lines: [
        {
          description: "Session",
          quantity: 1,
          unitPrice: 50,
          taxRate: 999,
          currency: "EUR",
        },
      ],
    })
    expect(parsed.success).toBe(false)
  })
})
