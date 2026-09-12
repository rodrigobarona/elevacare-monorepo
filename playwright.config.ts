import { readFileSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

function parseEnvValue(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0]
    const end = value.indexOf(quote, 1)
    if (end !== -1) {
      const rest = value.slice(end + 1).trim()
      if (rest === "" || rest.startsWith("#")) {
        return value.slice(1, end)
      }
    }
  }
  const comment = value.indexOf(" #")
  return comment === -1 ? value : value.slice(0, comment).trim()
}

function loadEnvLocal(): void {
  let raw: string
  try {
    raw = readFileSync(".env.local", "utf8")
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return
    }
    throw error
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const eq = trimmed.indexOf("=")
    const key = trimmed.slice(0, eq).trim()
    const value = parseEnvValue(trimmed.slice(eq + 1))
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3002"
const accountUrl = process.env.E2E_ACCOUNT_URL ?? "http://localhost:3006"
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === "1"
const runAuth = process.env.E2E_AUTH === "1"
const runMember = process.env.E2E_MEMBER === "1"
const appUrl = process.env.E2E_APP_URL ?? "http://localhost:3001"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Local public marketplace is 10 req/min per IP. Parallel workers trip
  // Upstash and SSR turns those 429s into 404/500. CI has no DATABASE_URL
  // so seeded public tests skip; keep CI parallel.
  workers: process.env.CI ? undefined : 1,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "pnpm --filter=@eleva/web start",
          url: webUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "pnpm --filter=@eleva/api start",
          url: `${apiUrl}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        ...(runAuth || runMember
          ? [
              {
                command: "pnpm --filter=@eleva/account start",
                url: `${accountUrl}/login`,
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]
          : []),
        ...(runAuth
          ? [
              {
                command: "pnpm --filter=@eleva/admin start",
                url: process.env.E2E_ADMIN_URL ?? "http://localhost:3007",
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]
          : []),
        ...(runMember
          ? [
              {
                command: "pnpm --filter=@eleva/app start",
                url: appUrl,
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]
          : []),
      ],
})
