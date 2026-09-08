type AccountUrlEnv = {
  ACCOUNT_URL?: string
  NEXT_PUBLIC_ACCOUNT_URL?: string
}

export function invitationAcceptUrl(
  invitationId: string,
  env: AccountUrlEnv = {
    ACCOUNT_URL: process.env.ACCOUNT_URL,
    NEXT_PUBLIC_ACCOUNT_URL: process.env.NEXT_PUBLIC_ACCOUNT_URL,
  }
): string {
  const base = (
    env.ACCOUNT_URL ||
    env.NEXT_PUBLIC_ACCOUNT_URL ||
    "http://localhost:3006"
  ).replace(/\/$/, "")
  return `${base}/accept-invitation?id=${encodeURIComponent(invitationId)}`
}
