import { createHash } from "node:crypto"
import {
  renderAuthEmail,
  type AuthEmailKind,
  type EmailLocale,
} from "@eleva/email"
import { loadUserByEmail } from "./claim-delivery"
import {
  sendNotification,
  type NotificationRecipient,
  type SendNotificationResult,
} from "./send-notification"

export type AuthMailerSend = (input: {
  kind: AuthEmailKind
  to: string
  url?: string
  code?: string
  name?: string
  locale?: EmailLocale
  recipient: NotificationRecipient
  orgId?: string
  idempotencyKey: string
}) => Promise<SendNotificationResult | void>

export type AuthTransactionalMailer = {
  sendVerifyEmail: (input: {
    user: { id?: string; email: string; name?: string | null }
    url: string
  }) => Promise<void>
  sendResetPassword: (input: {
    user: { id?: string; email: string; name?: string | null }
    url: string
  }) => Promise<void>
  sendMagicLink: (input: { email: string; url: string }) => Promise<void>
  sendTwoFactorOtp: (input: {
    user: { id?: string; email: string; name?: string | null }
    otp: string
  }) => Promise<void>
  sendOrgInvitation: (input: {
    email: string
    url: string
    orgId: string
    invitationId: string
  }) => Promise<void>
}

export type CreateAuthMailerDeps = {
  send?: AuthMailerSend
  loadUser?: typeof loadUserByEmail
}

const KIND_TO_NOTIFICATION = {
  "verify-email": "auth.verify_email",
  "reset-password": "auth.reset_password",
  "magic-link": "auth.magic_link",
  "two-factor-otp": "auth.two_factor_otp",
  "organization-invitation": "auth.org_invitation",
} as const

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

function toLocale(value: string | null | undefined): EmailLocale {
  if (value === "pt" || value === "es" || value === "en") return value
  return "en"
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  )
}

function recipientForUser(user: {
  id?: string
  email: string
}): NotificationRecipient {
  if (user.id) return { userId: user.id }
  return { email: user.email }
}

async function defaultSend(
  input: Parameters<AuthMailerSend>[0]
): Promise<SendNotificationResult> {
  const content = await renderAuthEmail({
    kind: input.kind,
    url: input.url,
    code: input.code,
    name: input.name,
    locale: input.locale,
  })
  const notificationKind = KIND_TO_NOTIFICATION[input.kind]
  if (notificationKind === "auth.org_invitation") {
    if (!input.orgId) {
      throw new Error("auth.org_invitation requires orgId")
    }
    return sendNotification({
      kind: "auth.org_invitation",
      orgId: input.orgId,
      recipient: input.recipient,
      ctx: {
        title: content.title,
        body: content.body,
        subject: content.subject,
        html: content.html,
      },
      idempotencyKey: input.idempotencyKey,
    })
  }
  return sendNotification({
    kind: notificationKind,
    recipient: input.recipient,
    ctx: {
      title: content.title,
      body: content.body,
      subject: content.subject,
      html: content.html,
    },
    idempotencyKey: input.idempotencyKey,
  })
}

export function createAuthMailer(
  deps: CreateAuthMailerDeps = {}
): AuthTransactionalMailer {
  const send = deps.send ?? defaultSend
  const loadUser = deps.loadUser ?? loadUserByEmail

  async function deliver(input: Parameters<AuthMailerSend>[0]): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      if (isProductionRuntime()) {
        throw new Error("RESEND_API_KEY is required in production")
      }
      console.info(`[notifications] skip ${input.kind} (no RESEND_API_KEY)`)
      return
    }
    try {
      await send(input)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[notifications] ${input.kind} send failed: ${message}`)
      if (isProductionRuntime()) {
        throw error instanceof Error ? error : new Error(message)
      }
    }
  }

  return {
    async sendVerifyEmail({ user, url }) {
      await deliver({
        kind: "verify-email",
        to: user.email,
        url,
        name: user.name ?? undefined,
        recipient: recipientForUser(user),
        idempotencyKey: `auth.verify_email:${user.email}:${digest(url)}`,
      })
    },
    async sendResetPassword({ user, url }) {
      await deliver({
        kind: "reset-password",
        to: user.email,
        url,
        name: user.name ?? undefined,
        recipient: recipientForUser(user),
        idempotencyKey: `auth.reset_password:${user.email}:${digest(url)}`,
      })
    },
    async sendMagicLink({ email, url }) {
      await deliver({
        kind: "magic-link",
        to: email,
        url,
        recipient: { email },
        idempotencyKey: `auth.magic_link:${email}:${digest(url)}`,
      })
    },
    async sendTwoFactorOtp({ user, otp }) {
      await deliver({
        kind: "two-factor-otp",
        to: user.email,
        code: otp,
        name: user.name ?? undefined,
        recipient: recipientForUser(user),
        idempotencyKey: `auth.two_factor_otp:${user.email}:${digest(otp)}`,
      })
    },
    async sendOrgInvitation({ email, url, orgId, invitationId }) {
      const existing = await loadUser(email)
      await deliver({
        kind: "organization-invitation",
        to: email,
        url,
        locale: toLocale(existing?.locale),
        orgId,
        recipient: existing ? { userId: existing.userId } : { email },
        idempotencyKey: `auth.org_invitation:${invitationId}`,
      })
    },
  }
}
