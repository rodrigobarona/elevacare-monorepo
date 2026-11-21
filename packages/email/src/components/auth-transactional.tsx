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
  /** `organization-invitation`: the clinic or practice that invites. */
  organizationName?: string
  /** `organization-invitation`: the person who sent the invitation. */
  inviterName?: string
}

type AuthCopy = { title: string; body: string; action: string; ignore: string }

/** Names shown in an email: one line, no links, at most 80 characters. */
function emailSafeName(value: string | undefined): string | null {
  const name = (value ?? "")
    .replace(/https?:\/\/\S*|www\.\S*/gi, "")
    // Control and invisible formatting characters (bidi overrides too).
    .replace(/[\p{Cc}\p{Cf}<>]/gu, " ")
    // "name.tld" would be turned into a link by mail apps: break the dot.
    .replace(/([\p{L}\d])\.(?=[\p{L}\d])/gu, "$1 ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return name || null
}

/**
 * The invitation names who invites and where, and says why the person got
 * the email: the invited person may not have an Eleva account yet.
 */
const INVITATION_COPY: Record<
  EmailLocale,
  (
    organization: string,
    inviter: string | null
  ) => AuthCopy & { subject: string }
> = {
  en: (organization, inviter) => ({
    subject: `You are invited to join ${organization} on Eleva Care`,
    title: `Join ${organization} on Eleva Care`,
    body: `${inviter ? `${inviter} invited you` : "You are invited"} to join ${organization} on Eleva Care. This invitation is valid for 7 days.`,
    action: "See the invitation",
    ignore: `${organization} gave us your email address to send you this invitation. If you were not expecting it, you can ignore this email and the invitation expires on its own. How Eleva uses personal data: eleva.care/legal/privacy`,
  }),
  pt: (organization, inviter) => ({
    subject: `Tem um convite para se juntar a ${organization} na Eleva Care`,
    title: `Junte-se a ${organization} na Eleva Care`,
    body: `${inviter ? `${inviter} enviou-lhe um convite` : "Tem um convite"} para se juntar a ${organization} na Eleva Care. O convite é válido durante 7 dias.`,
    action: "Ver o convite",
    ignore: `${organization} deu-nos o seu endereço de email para lhe enviar este convite. Se não o esperava, pode ignorar este email e o convite expira por si. Como a Eleva utiliza os dados pessoais: eleva.care/legal/privacy`,
  }),
  es: (organization, inviter) => ({
    subject: `Tienes una invitación para unirte a ${organization} en Eleva Care`,
    title: `Únete a ${organization} en Eleva Care`,
    body: `${inviter ? `${inviter} te ha enviado una invitación` : "Tienes una invitación"} para unirte a ${organization} en Eleva Care. La invitación es válida durante 7 días.`,
    action: "Ver la invitación",
    ignore: `${organization} nos ha dado tu correo electrónico para enviarte esta invitación. Si no la esperabas, puedes ignorar este correo y la invitación caducará sola. Cómo usa Eleva los datos personales: eleva.care/legal/privacy`,
  }),
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

type AuthCopyInput = Pick<
  AuthTransactionalProps,
  "kind" | "locale" | "organizationName" | "inviterName"
>

function authCopy(input: AuthCopyInput): AuthCopy & { subject: string } {
  const locale = input.locale ?? "en"
  const organization =
    input.kind === "organization-invitation"
      ? emailSafeName(input.organizationName)
      : null
  if (organization) {
    return (INVITATION_COPY[locale] ?? INVITATION_COPY.en)(
      organization,
      emailSafeName(input.inviterName)
    )
  }
  const copy = COPY[input.kind][locale] ?? COPY[input.kind].en
  return { ...copy, subject: AUTH_EMAIL_SUBJECT[input.kind][locale] }
}

export function authEmailText(input: AuthCopyInput): {
  subject: string
  title: string
  body: string
} {
  const copy = authCopy(input)
  return { subject: copy.subject, title: copy.title, body: copy.body }
}

export function AuthTransactionalEmail({
  kind,
  url,
  code,
  name,
  locale = "en",
  organizationName,
  inviterName,
}: AuthTransactionalProps) {
  const copy = authCopy({ kind, locale, organizationName, inviterName })
  const isOtp = kind === "two-factor-otp"

  return (
    <EmailLayout
      preview={copy.title}
      locale={locale}
      accountFooter={kind !== "organization-invitation"}
    >
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
