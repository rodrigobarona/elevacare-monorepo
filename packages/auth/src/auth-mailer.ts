export type AuthMailerUser = {
  id?: string
  email: string
  name?: string | null
  locale?: string | null
}

export type AuthTransactionalMailer = {
  sendVerifyEmail: (input: {
    user: AuthMailerUser
    url: string
  }) => Promise<void>
  sendResetPassword: (input: {
    user: AuthMailerUser
    url: string
  }) => Promise<void>
  sendMagicLink: (input: { email: string; url: string }) => Promise<void>
  sendTwoFactorOtp: (input: {
    user: AuthMailerUser
    otp: string
  }) => Promise<void>
  /**
   * Resolves true when the email was handed to the mail provider, false
   * when it was held back (suppressed address, or a send already running).
   */
  sendOrgInvitation: (input: {
    email: string
    url: string
    orgId: string
    invitationId: string
    /** Shown in the email, so the invited person knows who is asking. */
    organizationName?: string
    inviterName?: string
    /** Language when the invited address has no Eleva account yet. */
    fallbackLocale?: string | null
    /**
     * Changes each time the invitation is sent again, so the renewal is
     * delivered instead of being taken for a repeat of the first email.
     */
    sendKey?: string
  }) => Promise<boolean>
}

// Cache on `globalThis` so Turbopack/Next instrumentation and route
// handlers share one instance (module-level `let` is duplicated across
// the instrumentation graph vs the request graph in monorepo dev).
const globalForAuthMailer = globalThis as unknown as {
  __elevaAuthTransactionalMailer?: AuthTransactionalMailer
}

export function setAuthTransactionalMailer(
  next: AuthTransactionalMailer
): void {
  globalForAuthMailer.__elevaAuthTransactionalMailer = next
}

export function getAuthTransactionalMailer(): AuthTransactionalMailer {
  const mailer = globalForAuthMailer.__elevaAuthTransactionalMailer
  if (!mailer) {
    throw new Error(
      "Auth transactional mailer is not injected. Call setAuthTransactionalMailer at API startup."
    )
  }
  return mailer
}
