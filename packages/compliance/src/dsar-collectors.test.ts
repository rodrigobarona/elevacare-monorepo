import { afterEach, describe, expect, it } from "vitest"
import {
  listDsarCollectors,
  registerDsarCollector,
  resetDsarCollectorsForTests,
  type DsarCollector,
} from "./dsar-collectors"

afterEach(() => {
  resetDsarCollectorsForTests()
})

const fakeCollector = (id: string): DsarCollector => ({
  id,
  collect: async (userId: string) => ({
    filename: `${id}.json`,
    json: { userId },
  }),
})

describe("DSAR collector registry", () => {
  it("starts empty and lists registered collectors in insert order", () => {
    expect(listDsarCollectors()).toEqual([])
    registerDsarCollector(fakeCollector("profile"))
    registerDsarCollector(fakeCollector("extra"))
    expect(listDsarCollectors().map((collector) => collector.id)).toEqual([
      "profile",
      "extra",
    ])
  })

  it("rejects a duplicate collector id", () => {
    registerDsarCollector(fakeCollector("profile"))
    expect(() => registerDsarCollector(fakeCollector("profile"))).toThrow(
      /already registered: profile/
    )
  })
})
