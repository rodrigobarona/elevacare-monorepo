export type CapturedEmail = {
  kind: "verify" | "reset" | "magic-link" | "otp"
  to: string
  url: string
  token: string
}

const emails: CapturedEmail[] = []

export function captureEmail(email: CapturedEmail): void {
  emails.push(email)
}

export function lastEmail(
  kind?: CapturedEmail["kind"]
): CapturedEmail | undefined {
  const list = kind ? emails.filter((item) => item.kind === kind) : emails
  return list.at(-1)
}

export function allEmails(): readonly CapturedEmail[] {
  return emails
}
