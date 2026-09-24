import { setAuthTransactionalMailer } from "@eleva/auth/server/auth"
import { createAuthMailer } from "@eleva/notifications"

let ensured = false

/**
 * Belt-and-suspenders for Turbopack: instrumentation may not have finished
 * (or may have set the mailer on a different module graph) before the first
 * `/auth/*` request. Idempotent via `globalThis` inside
 * `setAuthTransactionalMailer`.
 */
export function ensureAuthTransactionalMailer(): void {
  if (ensured) return
  setAuthTransactionalMailer(createAuthMailer())
  ensured = true
}
