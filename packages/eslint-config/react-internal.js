import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginReactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

import { config as baseConfig } from "./base.js"

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * eslint-plugin-react is removed because v7.37.x is incompatible with
 * ESLint 10 (getFilename API removed). eslint-plugin-react-hooks
 * covers the critical hook-ordering rules; JSX-specific rules
 * (react-in-jsx-scope, prop-types) were already disabled.
 *
 * @type {import("eslint").Linter.Config} */
export const config = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
    },
  },
]
