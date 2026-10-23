#!/usr/bin/env node
/**
 * Delete stuck Better Auth secondary-storage rate-limit keys from Upstash Redis.
 *
 * BA keys are `${ip}|${path}` (e.g. `no-trusted-ip|/sign-in/social`). Before
 * `secondaryStorage.increment` applied EXPIRE NX, counters never reset and
 * permanently 429'd Google / email sign-in after 3 hits.
 *
 * Usage (from repo root, with prod KV in the environment):
 *   vercel env pull /tmp/eleva.env --environment=production --yes \
 *     --scope <team> --project elevacare-api
 *   set -a && source /tmp/eleva.env && set +a
 *   pnpm clear:better-auth-rate-limits
 *   rm -f /tmp/eleva.env
 *
 * Or: KV_REST_API_URL=… KV_REST_API_TOKEN=… pnpm clear:better-auth-rate-limits
 *
 * Pass `--dry-run` to list hashed keys without deleting.
 */
import { createHash } from "node:crypto"

const dryRun = process.argv.includes("--dry-run")

const url = process.env.KV_REST_API_URL?.replace(/\/$/, "")
const token = process.env.KV_REST_API_TOKEN

if (!url || !token) {
  console.error(
    "KV_REST_API_URL and KV_REST_API_TOKEN are required (pull from elevacare-api production)."
  )
  process.exit(1)
}

async function redisCmd(cmd) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  })
  if (!res.ok) {
    throw new Error(`Upstash ${res.status}: ${await res.text()}`)
  }
  const body = await res.json()
  return body.result ?? body
}

function isBaRateLimitKey(key) {
  if (!key.includes("|")) return false
  const path = key.slice(key.indexOf("|") + 1)
  return (
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/change-password") ||
    path.startsWith("/change-email") ||
    path.startsWith("/forget-password") ||
    path.startsWith("/two-factor") ||
    path.startsWith("/magic-link") ||
    path === "/request-password-reset" ||
    path === "/send-verification-email" ||
    path === "/email-otp/send-verification-otp" ||
    path === "/email-otp/request-password-reset" ||
    key.startsWith("no-trusted-ip|")
  )
}

function hashIp(ip) {
  return createHash("sha256").update(ip).digest("hex").slice(0, 10)
}

const found = []
let cursor = "0"
do {
  const [next, keys] = await redisCmd([
    "SCAN",
    cursor,
    "MATCH",
    "*|*",
    "COUNT",
    "500",
  ])
  cursor = String(next)
  for (const key of keys) {
    if (typeof key === "string" && isBaRateLimitKey(key)) found.push(key)
  }
} while (cursor !== "0")

const unique = [...new Set(found)].toSorted()
console.log(`found_keys=${unique.length}`)
for (const key of unique) {
  const sep = key.indexOf("|")
  console.log(`  ${hashIp(key.slice(0, sep))}|${key.slice(sep + 1)}`)
}

if (dryRun || unique.length === 0) {
  console.log(dryRun ? "dry-run: no deletes" : "deleted=0")
  process.exit(0)
}

let deleted = 0
for (let i = 0; i < unique.length; i += 50) {
  const chunk = unique.slice(i, i + 50)
  deleted += Number(await redisCmd(["DEL", ...chunk])) || 0
}
console.log(`deleted=${deleted}`)
