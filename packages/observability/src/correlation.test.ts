import { describe, expect, it } from "vitest"
import {
  correlationIdHeader,
  generateCorrelationId,
  getCorrelationId,
  withCorrelationId,
} from "./correlation"

describe("correlation id ALS", () => {
  it("returns undefined outside a withCorrelationId scope", () => {
    expect(getCorrelationId()).toBeUndefined()
  })

  it("sets + reads the id inside the scope", () => {
    const seen: Array<string | undefined> = []
    withCorrelationId("abc", () => {
      seen.push(getCorrelationId())
    })
    expect(seen).toEqual(["abc"])
  })

  it("restores the outer scope after return", () => {
    withCorrelationId("a", () => {
      expect(getCorrelationId()).toBe("a")
      withCorrelationId("b", () => {
        expect(getCorrelationId()).toBe("b")
      })
      expect(getCorrelationId()).toBe("a")
    })
    expect(getCorrelationId()).toBeUndefined()
  })

  it("exposes the canonical header name", () => {
    expect(correlationIdHeader()).toBe("x-correlation-id")
  })

  it("generates 24-char URL-safe ids", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) ids.add(generateCorrelationId())
    expect(ids.size).toBe(100)
    for (const id of ids) {
      expect(id.length).toBe(24)
      expect(id).toMatch(/^[A-Za-z0-9]+$/)
    }
  })
})
