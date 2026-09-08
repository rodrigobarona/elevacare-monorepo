import { Heading, Link, Text } from "react-email"
import { EmailLayout } from "./layout"
import type { EmailLocale } from "../i18n"

type AuthEmailKind =
  | "verify-email"
  | "reset-password"
  | "magic-link"
  | "organization-invitation"
  | "two-factor-otp"

const COPY: Record<
  AuthEmailKind,
  Record<EmailLocale, { title: string; body: string; action: string }>
> = {
  "verify-email": {
    en: {
      title: "Verify your email",
      body: "Confirm this address to finish creating your Eleva.care account.",
      action: "Verify email",
    },
    pt: {
      title: "Confirme o seu email",
      body: "Confirme este endereço para concluir a criação da sua conta Eleva.care.",
      action: "Confirmar email",
    },
    es: {
      title: "Verifica tu correo",
      body: "Confirma esta dirección para terminar de crear tu cuenta Eleva.care.",
      action: "Verificar correo",
    },
  },
  "reset-password": {
    en: {
      title: "Reset your password",
      body: "Use the button below if you asked to reset your Eleva.care password.",
      action: "Reset password",
    },
    pt: {
      title: "Redefinir palavra-passe",
      body: "Use o botão abaixo se pediu para redefinir a palavra-passe Eleva.care.",
      action: "Redefinir",
    },
    es: {
      title: "Restablecer contraseña",
      body: "Usa el botón si pediste restablecer tu contraseña de Eleva.care.",
      action: "Restablecer",
    },
  },
  "magic-link": {
    en: {
      title: "Sign in to Eleva.care",
      body: "This one-time link signs you in. It expires soon.",
      action: "Sign in",
    },
    pt: {
      title: "Entrar na Eleva.care",
      body: "Esta ligação de uso único inicia a sessão. Expira em breve.",
      action: "Entrar",
    },
    es: {
      title: "Entrar en Eleva.care",
      body: "Este enlace de un solo uso inicia tu sesión. Caduca pronto.",
      action: "Entrar",
    },
  },
  "organization-invitation": {
    en: {
      title: "Organization invitation",
      body: "You were invited to join an Eleva.care organization.",
      action: "Accept invitation",
    },
    pt: {
      title: "Convite para organização",
      body: "Foi convidado para uma organização Eleva.care.",
      action: "Aceitar convite",
    },
    es: {
      title: "Invitación a la organización",
      body: "Te invitaron a una organización Eleva.care.",
      action: "Aceptar invitación",
    },
  },
  "two-factor-otp": {
    en: {
      title: "Verification code",
      body: "Use this code to finish signing in. Do not share it.",
      action: "Open Eleva.care",
    },
    pt: {
      title: "Código de verificação",
      body: "Use este código para concluir o início de sessão. Não o partilhe.",
      action: "Abrir Eleva.care",
    },
    es: {
      title: "Código de verificación",
      body: "Usa este código para terminar de entrar. No lo compartas.",
      action: "Abrir Eleva.care",
    },
  },
}

export function AuthTransactionalEmail({
  kind,
  url,
  name,
  locale = "en",
}: {
  kind: AuthEmailKind
  url?: string
  name?: string
  locale?: EmailLocale
}) {
  const copy = COPY[kind][locale]
  return (
    <EmailLayout preview={copy.title} locale={locale}>
      <Heading as="h1">{copy.title}</Heading>
      {name ? <Text>Hi {name},</Text> : null}
      <Text>{copy.body}</Text>
      {url ? (
        <Link href={url} style={{ fontWeight: 600 }}>
          {copy.action}
        </Link>
      ) : null}
    </EmailLayout>
  )
}
