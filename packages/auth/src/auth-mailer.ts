export type AuthMailerUser = {
  id?: string
  email: string
  name?: string | null
  locale?: "en" | "pt" | "es" | null
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

let mailer: AuthTransactionalMailer | undefined

export function setAuthTransactionalMailer(
  next: AuthTransactionalMailer
): void {
  mailer = next
}

export function getAuthTransactionalMailer(): AuthTransactionalMailer {
  if (!mailer) {
    throw new Error(
      "Auth transactional mailer is not injected. Call setAuthTransactionalMailer at API startup."
    )
  }
  return mailer
}
