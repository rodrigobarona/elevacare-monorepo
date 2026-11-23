import { config } from "@eleva/eslint-config/base"
import { boundaryImportBansWithout } from "@eleva/eslint-config/boundaries"

/**
 * ADR-023: Plate / Slate / Radix are allowed here. Every other vendor
 * boundary from `@eleva/eslint-config/boundaries` stays, so the editor
 * package cannot import Stripe, Better Auth, S3, Twilio, Resend, etc.
 */
export default [
  ...config,
  {
    rules: {
      "no-restricted-imports": boundaryImportBansWithout((module) =>
        /^(platejs|@platejs|slate|slate-\*|@udecode\/slate|@udecode\/slate-\*|@radix-ui)(\/|$)/.test(
          module
        )
      ),
    },
  },
]
