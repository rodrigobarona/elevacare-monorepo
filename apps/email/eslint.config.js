import { config } from "@eleva/eslint-config/base"
import { boundariesConfig } from "@eleva/eslint-config/boundaries"

/** @type {import("eslint").Linter.Config} */
export default [...config, ...boundariesConfig]
