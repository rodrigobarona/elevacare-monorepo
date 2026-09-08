#!/usr/bin/env node
/**
 * Compare message-key sets across each app's required locales.
 * Required lists come from packages/config/src/i18n-locales.ts — never hardcoded here.
 */
import { runI18nParityCli } from "../packages/config/src/i18n-parity.ts"

const code = await runI18nParityCli()
process.exit(code)
