import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, mergeConfig } from "vitest/config"
import sharedConfig from "../../vitest.shared"

const root = path.dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  sharedConfig,
  defineConfig({
    // The app's tsconfig leaves JSX for Next to compile; a test needs it
    // compiled here.
    oxc: { jsx: { runtime: "automatic" } },
    resolve: {
      alias: {
        "@": path.join(root, "src"),
      },
    },
  })
)
