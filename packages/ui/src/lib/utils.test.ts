import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("keeps custom type steps next to text colours", () => {
    expect(cn("text-display", "text-white")).toBe("text-display text-white")
    expect(cn("text-lead text-muted-foreground", "text-white/80")).toBe(
      "text-lead text-white/80"
    )
  })

  it("still lets a later size override an earlier one", () => {
    expect(cn("text-headline", "text-sm")).toBe("text-sm")
  })
})
