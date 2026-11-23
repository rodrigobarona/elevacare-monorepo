import { config } from "@eleva/eslint-config/base"

export default [
  ...config,
  {
    // This package's variables are set by an operator for one run and are
    // not part of any build: they are deliberately absent from turbo.json.
    rules: { "turbo/no-undeclared-env-vars": "off" },
  },
]
