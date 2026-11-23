import { afterEach, describe, expect, it, vi } from "vitest"
import { domainEventWritten, onDomainEventWritten } from "./domain-event-signal"

describe("saying that an event was written", () => {
  afterEach(() => onDomainEventWritten(null))

  it("is fine with nobody listening", () => {
    expect(() => domainEventWritten()).not.toThrow()
  })

  it("tells whoever the app set, each time", () => {
    const heard = vi.fn()
    onDomainEventWritten(heard)
    domainEventWritten()
    domainEventWritten()
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it("never fails the write it is part of", () => {
    onDomainEventWritten(() => {
      throw new Error("the listener broke")
    })
    expect(() => domainEventWritten()).not.toThrow()
  })

  it("stops telling once the app says so", () => {
    const heard = vi.fn()
    onDomainEventWritten(heard)
    onDomainEventWritten(null)
    domainEventWritten()
    expect(heard).not.toHaveBeenCalled()
  })

  it("is one listener for every copy of this module a server loads", async () => {
    const heard = vi.fn()
    onDomainEventWritten(heard)
    vi.resetModules()
    const again = await import("./domain-event-signal")
    again.domainEventWritten()
    expect(heard).toHaveBeenCalledTimes(1)
  })
})
