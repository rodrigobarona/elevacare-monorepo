import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

/**
 * Whatever writes an event to the outbox says so (`domainEventWritten()`
 * from `@eleva/db`), so that the request that wrote it publishes it. The
 * job that publishes the outbox runs once an hour: a writer that does not
 * say so leaves its email, calendar entry or call room waiting for it.
 */
const ROOT = path.resolve(import.meta.dirname, "..")
const WRITE = /\.insert\(\s*main\.domainEventsOutbox\s*\)/g
const SAID = /\bdomainEventWritten\(\)/g

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".next", "dist", ".turbo"].includes(entry.name)) {
      return []
    }
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return sources(file)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [file]
      : []
  })
}

/** Each file that writes to the outbox: how often it writes, how often it says so. */
function writers(root) {
  return ["packages", "apps", "infra"]
    .flatMap((dir) => sources(path.join(root, dir)))
    .map((file) => {
      const text = readFileSync(file, "utf8")
      return {
        file: path.relative(root, file),
        writes: (text.match(WRITE) ?? []).length,
        said: (text.match(SAID) ?? []).length,
      }
    })
    .filter((one) => one.writes > 0)
}

test("the writers are found", () => {
  const found = writers(ROOT).map((one) => one.file)
  assert.ok(found.length >= 8, found.join(", "))
  for (const known of [
    "packages/scheduling/src/emit-domain-event.ts",
    "packages/billing/src/emit-domain-event.ts",
    "packages/db/src/queries/clinic-verifications.ts",
  ]) {
    assert.ok(found.includes(known), known)
  }
})

test("every write of an event to the outbox says that an event was written", () => {
  const silent = writers(ROOT)
    .filter((one) => one.said < one.writes)
    .map(
      (one) => `${one.file}: ${one.writes} write(s), said ${one.said} time(s)`
    )
  assert.deepEqual(silent, [])
})

test("a write is recognised however it is laid out", () => {
  const count = (text) => (text.match(WRITE) ?? []).length
  assert.equal(count("await tx.insert(main.domainEventsOutbox).values(x)"), 1)
  assert.equal(
    count("await tx\n  .insert(\n    main.domainEventsOutbox\n  )"),
    1
  )
  assert.equal(count("tx.insert(main.domainEventDeliveries)"), 0)
  assert.equal(count("tx.select().from(main.domainEventsOutbox)"), 0)
})
