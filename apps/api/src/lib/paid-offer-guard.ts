import {
  assertConnectReadyForPayments,
  ConnectIncompleteError,
} from "@eleva/billing/server"
import type { Tx } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import { secureJson } from "@/lib/security-headers"

/** A free service gets a price above zero. */
export function servicePriceBecomesPaid(input: {
  currentPriceAmount: number
  nextPriceAmount: number | undefined
}): boolean {
  return (
    input.nextPriceAmount !== undefined &&
    input.nextPriceAmount > 0 &&
    input.currentPriceAmount === 0
  )
}

/**
 * A delivery mode starts charging: it ends up active with its own price above
 * zero, and it was not already an active paid mode. `current` is null for a
 * new mode.
 */
export function modeBecomesPaid(input: {
  current: { active: boolean; priceCents: number | null } | null
  nextActive: boolean
  nextPriceCents: number | null | undefined
}): boolean {
  const wasPaid =
    input.current !== null &&
    input.current.active &&
    (input.current.priceCents ?? 0) > 0
  return !wasPaid && input.nextActive && (input.nextPriceCents ?? 0) > 0
}

/**
 * A published service that starts taking money (a price above zero, or a paid
 * way to meet) needs a ready Payments (Connect) account, the same rule publish
 * applies. Free services skip it.
 */
export async function assertPaymentsReadyForPaidChange(
  tx: Tx,
  input: {
    orgId: string
    published: boolean
    takesPayment: boolean
    stripeIdentityStatus: string | null | undefined
  }
): Promise<void> {
  if (!input.published || !input.takesPayment) return
  const identityRequired = await getFlag("ff.expert_identity_verification")
  await assertConnectReadyForPayments(tx, input.orgId, {
    identityRequired,
    fallbackIdentityStatus: input.stripeIdentityStatus,
  })
}

/** The 409 every service route returns when Payments setup is missing. */
export function connectIncompleteResponse(
  err: unknown,
  headers: HeadersInit
): Response | null {
  if (!(err instanceof ConnectIncompleteError)) return null
  return secureJson(
    {
      error: "CONNECT_INCOMPLETE",
      code: "CONNECT_INCOMPLETE",
      message: err.message,
    },
    { status: 409, headers }
  )
}
