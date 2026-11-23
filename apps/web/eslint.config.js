import { nextJsConfig } from "@eleva/eslint-config/next-js"
import { boundariesConfig } from "@eleva/eslint-config/boundaries"
import { frontendDbReadsConfig } from "@eleva/eslint-config/frontend-db-reads"

/** @type {import("eslint").Linter.Config} */
export default [...nextJsConfig, ...boundariesConfig, ...frontendDbReadsConfig]
