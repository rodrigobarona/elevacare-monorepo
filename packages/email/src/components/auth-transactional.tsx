import { Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import { EmailButton } from "./email-button"
import { EmailBodyText, EmailHeading } from "./email-heading"
import { EmailCard } from "./email-card"
import type { EmailLocale } from "../i18n"

export type AuthEmailKind =
  | "verify-email"
  | "reset-password"
  | "magic-link"
  | "organization-invitation"
  | "two-factor-otp"

export interface AuthTransactionalProps {
  kind: AuthEmailKind
  url?: string
  code?: string
  name?: string
  locale?: EmailLocale
}

const COPY: Record<
  AuthEmailKind,
  Record<
    EmailLocale,
    { title: string; body: string; action: string; ignore: string }
  >
> = {
  "verify-email": {
    en: {
      title: "Confirm your email",
      body: "Thank you for creating an Eleva Care account. Confirm this address to finish signing up.",
      action: "Confirm email",
      ignore: "If you didn't create an account, you can ignore this email.",
    },
    pt: {
      title: "Confirme o seu email",
      body: "Obrigado por criar conta na Eleva Care. Confirme este endereço para concluir o registo.",
      action: "Confirmar email",
      ignore: "Se não criou uma conta, pode ignorar este email.",
    },
    es: {
      title: "Confirma tu correo",
      body: "Gracias por crear una cuenta en Eleva Care. Confirma esta dirección para terminar el registro.",
      action: "Verificar correo",
      ignore: "Si no creaste una cuenta, puedes ignorar este correo.",
    },
  },
  "reset-password": {
    en: {
      title: "Reset your password",
      body: "Use the button below if you asked to reset your Eleva Care password.",
      action: "Reset password",
      ignore: "If you didn't request this, you can ignore this email.",
    },
    pt: {
      title: "Redefinir palavra-passe",
      body: "Use o botão abaixo se pediu para redefinir a palavra-passe Eleva Care.",
      action: "Redefinir",
      ignore: "Se não pediu isto, pode ignorar este email.",
    },
    es: {
      title: "Restablecer contraseña",
      body: "Usa el botón si pediste restablecer tu contraseña de Eleva Care.",
      action: "Restablecer",
      ignore: "Si no pediste esto, puedes ignorar este correo.",
    },
  },
  "magic-link": {
    en: {
      title: "Sign in to Eleva Care",
      body: "This one-time link signs you in. It expires soon.",
      action: "Sign in",
      ignore: "If you didn't request this, you can ignore this email.",
    },
    pt: {
      title: "Entrar na Eleva Care",
      body: "Esta ligação de uso único inicia a sessão. Expira em breve.",
      action: "Entrar",
      ignore: "Se não pediu isto, pode ignorar este email.",
    },
    es: {
      title: "Entrar en Eleva Care",
      body: "Este enlace de un solo uso inicia tu sesión. Caduca pronto.",
      action: "Entrar",
      ignore: "Si no pediste esto, puedes ignorar este correo.",
    },
  },
  "organization-invitation": {
    en: {
      title: "You are invited",
      body: "You were invited to join an Eleva Care organization.",
      action: "Accept invitation",
      ignore: "If you weren't expecting this, you can ignore this email.",
    },
    pt: {
      title: "Foi convidado",
      body: "Foi convidado para uma organização Eleva Care.",
      action: "Aceitar convite",
      ignore: "Se não esperava este email, pode ignorá-lo.",
    },
    es: {
      title: "Te invitaron",
      body: "Te invitaron a una organización Eleva Care.",
      action: "Aceptar invitación",
      ignore: "Si no esperabas este correo, puedes ignorarlo.",
    },
  },
  "two-factor-otp": {
    en: {
      title: "Your verification code",
      body: "Use this code to finish signing in. Do not share it.",
      action: "Open Eleva Care",
      ignore: "If you didn't request this, you can ignore this email.",
    },
    pt: {
      title: "O seu código",
      body: "Use este código para concluir o início de sessão. Não o partilhe.",
      action: "Abrir Eleva Care",
      ignore: "Se não pediu isto, pode ignorar este email.",
    },
    es: {
      title: "Tu código",
      body: "Usa este código para terminar de entrar. No lo compartas.",
      action: "Abrir Eleva Care",
      ignore: "Si no pediste esto, puedes ignorar este correo.",
    },
  },
}

export const AUTH_EMAIL_SUBJECT: Record<
  AuthEmailKind,
  Record<EmailLocale, string>
> = {
  "verify-email": {
    en: "Verify your Eleva Care email",
    pt: "Confirme o seu email Eleva Care",
    es: "Verifica tu correo de Eleva Care",
  },
  "reset-password": {
    en: "Reset your Eleva Care password",
    pt: "Redefina a sua palavra-passe Eleva Care",
    es: "Restablece tu contraseña de Eleva Care",
  },
  "magic-link": {
    en: "Your Eleva Care sign-in link",
    pt: "A sua ligação de início de sessão Eleva Care",
    es: "Tu enlace de acceso a Eleva Care",
  },
  "organization-invitation": {
    en: "You are invited to an Eleva Care organization",
    pt: "Foi convidado para uma organização Eleva Care",
    es: "Te invitaron a una organización Eleva Care",
  },
  "two-factor-otp": {
    en: "Your Eleva Care verification code",
    pt: "O seu código de verificação Eleva Care",
    es: "Tu código de verificación de Eleva Care",
  },
}

export function authEmailText(
  kind: AuthEmailKind,
  locale: EmailLocale = "en"
): { title: string; body: string } {
  const copy = COPY[kind][locale] ?? COPY[kind].en
  return { title: copy.title, body: copy.body }
}

export function AuthTransactionalEmail({
  kind,
  url,
  code,
  name,
  locale = "en",
}: AuthTransactionalProps) {
  const copy = COPY[kind][locale] ?? COPY[kind].en
  const isOtp = kind === "two-factor-otp"

  return (
    <EmailLayout preview={copy.title} locale={locale}>
      <EmailHeading>{copy.title}</EmailHeading>
      {name ? <EmailBodyText className="mb-[8px]">{name}</EmailBodyText> : null}
      <EmailBodyText className="mb-[24px]">{copy.body}</EmailBodyText>

      {isOtp && code ? (
        <EmailCard>
          <Text className="text-brand m-0 text-center text-[28px] leading-[36px] font-semibold">
            {code}
          </Text>
        </EmailCard>
      ) : null}

      {!isOtp && url ? (
        <Section className="mb-[24px]">
          <EmailButton href={url}>{copy.action}</EmailButton>
        </Section>
      ) : null}

      <Text className="text-fg-3 m-0 mt-[24px] text-[13px] leading-[20px]">
        {copy.ignore}
      </Text>
    </EmailLayout>
  )
}
