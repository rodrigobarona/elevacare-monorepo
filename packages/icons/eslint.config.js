import { baseImportBansWithout, config } from "@eleva/eslint-config/base"

/** This package wraps the vendor icon set, so it keeps every base ban except icons. */
export default [
  ...config,
  {
    rules: {
      "no-restricted-imports": baseImportBansWithout((module) =>
        /^(lucide-react|@phosphor-icons\/react)(\/|$)/.test(module)
      ),
    },
  },
]
