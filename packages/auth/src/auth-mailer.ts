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
  sendOrgInvitation: (input: {
    email: string
    url: string
    orgId: string
    invitationId: string
  }) => Promise<void>
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
