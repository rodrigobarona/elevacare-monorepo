import { defineConfig, devices } from "@playwright/test"

const webUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3002"
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === "1"

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
      ],
})
