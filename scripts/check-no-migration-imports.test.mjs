import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { findMigrationImportProblems } from "./check-no-migration-imports.mjs"

function repo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "migration-imports-"))
  mkdirSync(path.join(root, "apps"), { recursive: true })
  mkdirSync(path.join(root, "packages"), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.join(root, path.dirname(name)), { recursive: true })
    writeFileSync(
      path.join(root, name),
      typeof content === "string" ? content : JSON.stringify(content)
    )
  }
  return root
}

test("a clean repository passes and counts what it read", async () => {
  const root = repo({
    "apps/web/src/page.tsx": `import { db } from "@eleva/db"\n`,
    "packages/db/package.json": { dependencies: { zod: "catalog:" } },
  })
  assert.deepEqual(await findMigrationImportProblems(root), {
    problems: [],
    scanned: 1,
  })
})

test("an import by package name or by path is refused", async () => {
  const root = repo({
    "apps/api/src/a.ts": `import { guard } from "@eleva/infra-migration"\n`,
    "packages/db/src/b.ts": `const g = await import("../../../infra/migration/src/guard")\n`,
    "packages/db/src/c.js": `const g = require("@eleva/infra-migration/guard")\n`,
  })
  const { problems } = await findMigrationImportProblems(root)
  assert.equal(problems.length, 3)
  assert.match(problems.join("\n"), /apps\/api\/src\/a\.ts imports/)
})

test("a dependency entry is refused in every field, optional ones too", async () => {
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "devDependencies",
    "peerDependencies",
  ]) {
    const root = repo({
      "apps/web/package.json": {
        [field]: { "@eleva/infra-migration": "workspace:*" },
      },
    })
    const { problems } = await findMigrationImportProblems(root)
    assert.deepEqual(problems, [
      `apps/web/package.json lists @eleva/infra-migration in ${field}`,
    ])
  }
})

test("the internal playground is left out, as from every CI check", async () => {
  const root = repo({
    "apps/poc/src/lab.ts": `import "@eleva/infra-migration"\n`,
    "apps/poc/package.json": {
      dependencies: { "@eleva/infra-migration": "workspace:*" },
    },
  })
  assert.deepEqual((await findMigrationImportProblems(root)).problems, [])
})
