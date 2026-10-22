/**
 * Copy en help trees to es for AI/native review (draft locale parity).
 * Run: node packages/content/scripts/seed-help-es-from-en.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const helpRoot = path.resolve(__dirname, "../content/help")
const portals = ["members", "experts", "clinics"]

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

for (const portal of portals) {
  const enDir = path.join(helpRoot, portal, "en")
  const esDir = path.join(helpRoot, portal, "es")
  if (!fs.existsSync(enDir)) continue
  if (fs.existsSync(esDir)) {
    fs.rmSync(esDir, { recursive: true, force: true })
  }
  copyDir(enDir, esDir)
  console.log("seeded", path.relative(helpRoot, esDir), "from en")
}

console.log("help es seed done (review before treating as native ES)")
