import { Resend } from "resend"
import { render } from "react-email"
import {
  AuthTransactionalEmail,
  type AuthEmailKind,
} from "./components/auth-transactional"

export type { AuthEmailKind }

function authFromAddress(): string {
  const candidates = [
    process.env.RESEND_FROM_EMAIL,
    process.env.RESEND_EMAIL_BOOKINGS_FROM,
  ]
  return (
    candidates.map((value) => value?.trim()).find((value) => value) ??
    "Eleva.care <noreply@eleva.care>"
  )
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  )
}

const SUBJECT: Record<AuthEmailKind, { en: string; pt: string; es: string }> = {
  "verify-email": {
    en: "Verify your Eleva.care email",
    pt: "Confirme o seu email Eleva.care",
    es: "Verifica tu correo de Eleva.care",
  },
  "reset-password": {
    en: "Reset your Eleva.care password",
    pt: "Redefina a sua palavra-passe Eleva.care",
    es: "Restablece tu contraseña de Eleva.care",
  },
  "magic-link": {
    en: "Your Eleva.care sign-in link",
    pt: "A sua ligação de início de sessão Eleva.care",
    es: "Tu enlace de acceso a Eleva.care",
  },
  "organization-invitation": {
    en: "You are invited to an Eleva.care organization",
    pt: "Foi convidado para uma organização Eleva.care",
    es: "Te invitaron a una organización Eleva.care",
  },
  "two-factor-otp": {
    en: "Your Eleva.care verification code",
    pt: "O seu código de verificação Eleva.care",
    es: "Tu código de verificación de Eleva.care",
  },
}

export async function sendAuthEmail(input: {
  kind: AuthEmailKind
  to: string
  url?: string
  code?: string
  name?: string
  locale?: "en" | "pt" | "es"
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.info(
      `[email] skip ${input.kind} to ${input.to} (no RESEND_API_KEY)`
    )
    return
  }

  const locale = input.locale ?? "en"
  const html = await render(
    AuthTransactionalEmail({
      kind: input.kind,
      url: input.url,
      code: input.code,
      name: input.name,
      locale,
    })
  )

  const resend = new Resend(apiKey)
  const from = authFromAddress()
  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: SUBJECT[input.kind][locale],
      html,
    })
    if (error) {
      throw new Error(error.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[email] ${input.kind} send failed: ${message}`)
    // Local/e2e uses @example.com; Resend rejects those. Token is already
    // persisted for Playwright. Fail the request only in production.
    if (isProductionRuntime()) {
      throw error instanceof Error ? error : new Error(message)
    }
  }
}
