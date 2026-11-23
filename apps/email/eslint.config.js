import { config } from "@eleva/eslint-config/base"
import { boundariesConfig } from "@eleva/eslint-config/boundaries"
import { frontendDbReadsConfig } from "@eleva/eslint-config/frontend-db-reads"

/** @type {import("eslint").Linter.Config} */
export default [...config, ...boundariesConfig, ...frontendDbReadsConfig]
