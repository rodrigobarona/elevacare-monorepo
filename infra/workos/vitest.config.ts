import { defineConfig, mergeConfig } from "vitest/config"
import sharedConfig from "../../vitest.shared"

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ["**/*.{test,spec}.ts"],
      exclude: ["node_modules", "dist", ".next", ".turbo"],
    },
  })
)
