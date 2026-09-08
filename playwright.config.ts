import { readFileSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

function loadEnvLocal(): void {
  let raw: string
  try {
    raw = readFileSync(".env.local", "utf8")
  } catch {
    return
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const eq = trimmed.indexOf("=")
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) {
      value = value.slice(1, -1)
    } else {
      const comment = value.indexOf(" #")
      if (comment !== -1) value = value.slice(0, comment).trim()
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const webUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3002"
const accountUrl = process.env.E2E_ACCOUNT_URL ?? "http://localhost:3006"
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === "1"
const runAuth = process.env.E2E_AUTH === "1"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
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
        ...(runAuth
          ? [
              {
                command: "pnpm --filter=@eleva/account start",
                url: `${accountUrl}/login`,
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
              {
                command: "pnpm --filter=@eleva/admin start",
                url: process.env.E2E_ADMIN_URL ?? "http://localhost:3007",
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]
          : []),
      ],
})
