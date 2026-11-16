import {
  assertConnectReadyForPayments,
  ConnectIncompleteError,
} from "@eleva/billing/server"
import type { Tx } from "@eleva/db"
import { getFlag } from "@eleva/flags"
import { secureJson } from "@/lib/security-headers"

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
