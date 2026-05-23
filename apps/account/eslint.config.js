import { nextJsConfig } from "@eleva/eslint-config/next-js"
import { boundariesConfig } from "@eleva/eslint-config/boundaries"
import { apiFirstActionsConfig } from "@eleva/eslint-config/api-first-actions"

/** @type {import("eslint").Linter.Config} */
export default [...nextJsConfig, ...boundariesConfig, ...apiFirstActionsConfig]
