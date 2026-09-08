import { sendAuthEmail } from "@eleva/email"

export async function sendVerificationEmail(input: {
  user: { email: string; name?: string | null }
  url: string
}): Promise<void> {
  await sendAuthEmail({
    kind: "verify-email",
    to: input.user.email,
    url: input.url,
    name: input.user.name ?? undefined,
  })
}

export async function sendResetPasswordEmail(input: {
  user: { email: string; name?: string | null }
  url: string
}): Promise<void> {
  await sendAuthEmail({
    kind: "reset-password",
    to: input.user.email,
    url: input.url,
    name: input.user.name ?? undefined,
  })
}

export async function sendMagicLinkEmail(input: {
  email: string
  url: string
}): Promise<void> {
  await sendAuthEmail({
    kind: "magic-link",
    to: input.email,
    url: input.url,
  })
}
