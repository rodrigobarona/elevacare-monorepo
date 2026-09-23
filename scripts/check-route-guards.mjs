#!/usr/bin/env node
/**
 * CI guard: every apps/api route.ts must export a real ROUTE_POLICY object.
 */
import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

const ROOT = path.resolve(import.meta.dirname, "..")
const APP_DIR = path.join(ROOT, "apps/api/src/app")
const AUTH_MODES = new Set(["public", "session", "signature", "internal"])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      files.push(...(await walk(full)))
    } else if (entry.name === "route.ts") {
      files.push(full)
    }
  }
  return files
}

function unwrap(node) {
  let current = node
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function readLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}

function extractPolicy(source) {
  const sf = ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  let policy = null

  function visit(node) {
    if (ts.isVariableStatement(node)) {
      const exported = node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
      if (exported) {
        for (const decl of node.declarationList.declarations) {
          if (
            !ts.isIdentifier(decl.name) ||
            decl.name.text !== "ROUTE_POLICY"
          ) {
            continue
          }
          if (!decl.initializer) continue
          const init = unwrap(decl.initializer)
          if (!ts.isObjectLiteralExpression(init)) continue
          const fields = {}
          for (const prop of init.properties) {
            if (ts.isSpreadAssignment(prop)) {
              policy = null
              return
            }
            if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
              continue
            }
            fields[prop.name.text] = readLiteral(unwrap(prop.initializer))
          }
          policy = fields
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)
  return policy
}

function isValidPolicy(policy) {
  return (
    policy !== null &&
    AUTH_MODES.has(policy.auth) &&
    typeof policy.rateLimit === "boolean" &&
    typeof policy.botId === "boolean"
  )
}

const routes = await walk(APP_DIR)
const missing = []

for (const file of routes) {
  const content = await readFile(file, "utf8")
  if (!isValidPolicy(extractPolicy(content))) {
    missing.push(path.relative(ROOT, file))
  }
}

if (missing.length > 0) {
  console.error(
    "Route guard check failed. Each apps/api route.ts must export ROUTE_POLICY with auth, rateLimit, and botId:\n"
  )
  for (const file of missing) console.error(`  ${file}`)
  process.exit(1)
}

// Authenticated expert resources use singular `/expert/*`. Plural `/experts/*`
// is reserved for public reads under `public/experts` only (Phase 04B).
const authenticatedExpertsDir = path.join(APP_DIR, "experts")
if (existsSync(authenticatedExpertsDir)) {
  console.error(
    "Route guard check failed. Authenticated routes must live under apps/api/src/app/expert/ (singular).\n" +
      "Found apps/api/src/app/experts/ — move routes or keep only public reads under public/experts/.\n"
  )
  process.exit(1)
}

console.log(`Route guard check passed (${routes.length} routes).`)
