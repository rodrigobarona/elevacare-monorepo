import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email"
import { elevaTailwindConfig } from "../theme"
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
      title: "We're almost there",
      body: "Thank you for signing up for Eleva.care. Confirm this address to finish creating your account.",
      action: "Confirm email",
      ignore: "If you didn't create an account, you can ignore this email.",
    },
    pt: {
      title: "Estamos quase",
      body: "Obrigado por criar conta na Eleva.care. Confirme este endereço para concluir o registo.",
      action: "Confirmar email",
      ignore: "Se não criou uma conta, pode ignorar este email.",
    },
    es: {
      title: "Ya casi estamos",
      body: "Gracias por registrarte en Eleva.care. Confirma esta dirección para terminar de crear tu cuenta.",
      action: "Verificar correo",
      ignore: "Si no creaste una cuenta, puedes ignorar este correo.",
    },
  },
  "reset-password": {
    en: {
      title: "Reset your password",
      body: "Use the button below if you asked to reset your Eleva.care password.",
      action: "Reset password",
      ignore: "If you didn't request this, you can ignore this email.",
    },
    pt: {
      title: "Redefinir palavra-passe",
      body: "Use o botão abaixo se pediu para redefinir a palavra-passe Eleva.care.",
      action: "Redefinir",
      ignore: "Se não pediu isto, pode ignorar este email.",
    },
    es: {
      title: "Restablecer contraseña",
      body: "Usa el botón si pediste restablecer tu contraseña de Eleva.care.",
      action: "Restablecer",
      ignore: "Si no pediste esto, puedes ignorar este correo.",
    },
  },
  "magic-link": {
    en: {
      title: "Sign in to Eleva.care",
      body: "This one-time link signs you in. It expires soon.",
      action: "Sign in",
      ignore: "If you didn't request this, you can ignore this email.",
    },
    pt: {
      title: "Entrar na Eleva.care",
      body: "Esta ligação de uso único inicia a sessão. Expira em breve.",
      action: "Entrar",
      ignore: "Se não pediu isto, pode ignorar este email.",
    },
    es: {
      title: "Entrar en Eleva.care",
      body: "Este enlace de un solo uso inicia tu sesión. Caduca pronto.",
      action: "Entrar",
      ignore: "Si no pediste esto, puedes ignorar este correo.",
    },
  },
  "organization-invitation": {
    en: {
      title: "You are invited",
      body: "You were invited to join an Eleva.care organization.",
      action: "Accept invitation",
      ignore: "If you weren't expecting this, you can ignore this email.",
    },
    pt: {
      title: "Foi convidado",
      body: "Foi convidado para uma organização Eleva.care.",
      action: "Aceitar convite",
      ignore: "Se não esperava este email, pode ignorá-lo.",
    },
    es: {
      title: "Te invitaron",
      body: "Te invitaron a una organización Eleva.care.",
      action: "Aceptar invitación",
      ignore: "Si no esperabas este correo, puedes ignorarlo.",
    },
  },
  "two-factor-otp": {
    en: {
      title: "Your verification code",
      body: "Use this code to finish signing in. Do not share it.",
      action: "Open Eleva.care",
      ignore: "If you didn't request this, you can ignore this email.",
    },
    pt: {
      title: "O seu código",
      body: "Use este código para concluir o início de sessão. Não o partilhe.",
      action: "Abrir Eleva.care",
      ignore: "Se não pediu isto, pode ignorar este email.",
    },
    es: {
      title: "Tu código",
      body: "Usa este código para terminar de entrar. No lo compartas.",
      action: "Abrir Eleva.care",
      ignore: "Si no pediste esto, puedes ignorar este correo.",
    },
  },
}

/** Barebone-style activation layout (official React Email demo), Eleva tokens. */
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
    <Tailwind config={elevaTailwindConfig}>
      <Html lang={locale}>
        <Head />
        <Body className="bg-canvas m-0 text-center font-sans">
          <Preview>{copy.title}</Preview>
          <Container className="mx-auto mt-8 w-full max-w-[640px]">
            <Section className="bg-bg px-6 py-4">
              <Text className="text-brand m-0 text-left text-[16px] font-semibold tracking-tight">
                Eleva Care
              </Text>
            </Section>

            <Section className="bg-bg-2 rounded-[8px] px-[40px] py-[64px] text-center">
              <Heading
                as="h1"
                className="text-fg m-0 mb-4 text-[28px] leading-tight font-semibold"
              >
                {copy.title}
              </Heading>
              {name ? (
                <Text className="text-fg-2 m-0 mb-3 text-[16px]">{name}</Text>
              ) : null}
              <Text className="text-fg-2 mx-auto mt-0 mb-8 max-w-[380px] text-[16px] leading-relaxed">
                {copy.body}
              </Text>

              {isOtp && code ? (
                <Text className="text-fg m-0 mb-8 text-[32px] font-semibold tracking-[0.2em]">
                  {code}
                </Text>
              ) : null}

              {!isOtp && url ? (
                <Section className="mb-6 text-center">
                  <Button
                    href={url}
                    className="bg-brand text-fg-inverted inline-block rounded-lg px-8 py-4 text-center text-[16px] leading-6 font-semibold"
                  >
                    {copy.action}
                  </Button>
                </Section>
              ) : null}

              <Text className="text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-[13px] leading-relaxed">
                {copy.ignore}
              </Text>
            </Section>

            <Section className="bg-bg px-6 py-10">
              <Text className="text-fg-3 m-0 text-[12px] leading-5">
                Eleva Care · Lisbon, Portugal
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  )
}
