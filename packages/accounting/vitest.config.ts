import { defineConfig, mergeConfig } from "vitest/config"
import sharedConfig from "../../vitest.shared"

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    },
  })
)
