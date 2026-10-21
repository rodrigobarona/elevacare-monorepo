#!/usr/bin/env node
/**
 * Operator helper: print Google Cloud OAuth URIs Eleva expects and verify
 * GOOGLE_OAUTH_* + BETTER_AUTH_URL are present (never prints secret values).
 *
 * Usage: pnpm check:google-oauth
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

const STALE_REDIRECT_FRAGMENTS = [
  "/calendar/oauth/google/callback",
  "/calendar/google/callback",
]

const REQUIRED_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
]

const ENV_FILES = [".env.local", ".env"]

/** @type {Record<string, string>} */
const env = { ...process.env }

for (const file of ENV_FILES) {
  const full = path.join(ROOT, file)
  if (!existsSync(full)) continue
  for (const line of readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).replace(/^export\s+/, "")
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (env[key] === undefined || env[key] === "") env[key] = value
  }
}

function presence(key) {
  const value = env[key]?.trim() ?? ""
  if (!value) return { ok: false, detail: "MISSING" }
  return { ok: true, detail: `SET (len=${value.length})` }
}

function authCallback(betterAuthUrl) {
  const base = betterAuthUrl.replace(/\/+$/, "")
  return `${base}/callback/google`
}

const localOrigins = Array.from({ length: 10 }, (_, i) => 3000 + i).flatMap(
  (port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
)

const matrices = {
  local: {
    betterAuthUrl: "http://localhost:3002/auth",
    redirect: "http://localhost:3002/auth/callback/google",
    jsOrigins: localOrigins,
  },
  staging: {
    betterAuthUrl: "https://api.dev.eleva.care/auth",
    redirect: "https://api.dev.eleva.care/auth/callback/google",
    jsOrigins: ["https://dev.eleva.care", "https://api.dev.eleva.care"],
  },
  production: {
    betterAuthUrl: "https://api.eleva.care/auth",
    redirect: "https://api.eleva.care/auth/callback/google",
    jsOrigins: [
      "https://eleva.care",
      "https://www.eleva.care",
      "https://api.eleva.care",
    ],
  },
}

console.log("Eleva Google OAuth — Google Cloud checklist\n")
console.log("Consent scopes (add on OAuth consent screen):")
for (const scope of REQUIRED_SCOPES) console.log(`  - ${scope}`)
console.log("")

console.log(
  "Authorized redirect URIs (Web client — register all envs you use):"
)
for (const [name, row] of Object.entries(matrices)) {
  console.log(`  [${name}] ${row.redirect}`)
}
console.log("")

console.log("Authorized JavaScript origins (minimum):")
for (const [name, row] of Object.entries(matrices)) {
  console.log(`  [${name}]`)
  for (const origin of row.jsOrigins.slice(0, 4)) console.log(`    ${origin}`)
  if (row.jsOrigins.length > 4) {
    console.log(`    … +${row.jsOrigins.length - 4} more (localhost 3000–3009)`)
  }
}
console.log("")

console.log("Do NOT register these stale paths:")
for (const frag of STALE_REDIRECT_FRAGMENTS) console.log(`  - …${frag}`)
console.log("")

const checks = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "BETTER_AUTH_URL",
]

let failed = false
console.log("Local env presence (.env.local / .env / process.env):")
for (const key of checks) {
  const { ok, detail } = presence(key)
  console.log(`  ${key}: ${detail}`)
  if (!ok) failed = true
}

const betterAuthUrl = env.BETTER_AUTH_URL?.trim() ?? ""
if (betterAuthUrl) {
  const derived = authCallback(betterAuthUrl)
  console.log(`\nDerived Google redirect from BETTER_AUTH_URL:\n  ${derived}`)
  for (const frag of STALE_REDIRECT_FRAGMENTS) {
    if (betterAuthUrl.includes(frag) || derived.includes(frag)) {
      console.error(`\nERROR: BETTER_AUTH_URL uses stale fragment ${frag}`)
      failed = true
    }
  }
  const expected = Object.values(matrices).map((row) => row.redirect)
  if (!expected.includes(derived)) {
    console.warn(
      "\nWARN: derived redirect is not one of the canonical local/staging/prod URIs."
    )
    console.warn(
      "       Confirm it is registered on the Google OAuth Web client."
    )
  }
}

const deadRedirect = env.GOOGLE_OAUTH_REDIRECT?.trim()
if (deadRedirect) {
  console.warn(
    "\nWARN: GOOGLE_OAUTH_REDIRECT is set but unused by Eleva code; ignore it."
  )
  console.warn(`      value length=${deadRedirect.length}`)
}

console.log(
  "\nOperator guide: docs/eleva-v3/operator-tasks/google-oauth-setup.md"
)

if (failed) {
  console.error(
    "\nFAIL: set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and BETTER_AUTH_URL, then re-run."
  )
  process.exit(1)
}

console.log(
  "\nPASS: Google OAuth env presence looks set. Complete console + live proof checklists in the operator guide."
)
process.exit(0)
