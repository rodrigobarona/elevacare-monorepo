import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  CONNECT_WEBHOOK_EVENTS,
  PLATFORM_WEBHOOK_EVENTS,
  WEBHOOK_EVENTS,
} from "./webhook-events"

const here = dirname(fileURLToPath(import.meta.url))

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

describe("webhook event SSOT", () => {
  it("WEBHOOK_EVENTS is the union of platform and connect lists", () => {
    expect(uniqueSorted(WEBHOOK_EVENTS)).toEqual(
      uniqueSorted([...PLATFORM_WEBHOOK_EVENTS, ...CONNECT_WEBHOOK_EVENTS])
    )
  })

  it("dispatcher switch cases equal WEBHOOK_EVENTS", () => {
    const src = readFileSync(join(here, "webhook.ts"), "utf8")
    const cases = [...src.matchAll(/case "((?:[a-z_]+\.)+[a-z_]+)":/g)].map(
      (match) => match[1]!
    )
    expect(uniqueSorted(cases)).toEqual(uniqueSorted(WEBHOOK_EVENTS))
  })
})
