import { defineConfig } from "vitest/config"

import sharedConfig from "../../vitest.shared"

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    include: ["lib/**/*.{test,spec}.ts"],
  },
})
