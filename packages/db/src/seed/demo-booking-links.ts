import { createHash } from "node:crypto"

/** Plaintext tokens for local/e2e only. The DB stores sha256 hex. */
export const DEMO_BOOKING_LINK_TOKENS = {
  open: "e2e_fisiomota_private_invite_open",
  exhausted: "e2e_fisiomota_private_invite_used",
} as const

export const DEMO_PRIVATE_INVITE_SLUG = "private-invite"

export const DEMO_PRIVATE_INVITE_NOTE =
  "Private invite — this closed agenda is only reachable from the link."

export const DEMO_PRIVATE_INVITE_PRICE_CENTS = 4000

export const DEMO_BOOKING_LINK_EXPIRES_AT = new Date("2030-01-01T00:00:00.000Z")

export function hashDemoBookingLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
