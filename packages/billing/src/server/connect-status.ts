import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { main, type Tx } from "@eleva/db"

export type ConnectCapabilityStatus = string

export type ConnectCapabilities = {
  transfers?: ConnectCapabilityStatus
  card_payments?: ConnectCapabilityStatus
}

export type ConnectStatusSnapshot = {
  stripeConnectAccountId: string
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirementsCurrentlyDue: string[]
  connectCapabilities: ConnectCapabilities
  identityStatus?: string | null
}

export function capabilitiesFromAccount(
  account: Stripe.Account
): ConnectCapabilities {
  return {
    transfers: account.capabilities?.transfers,
    card_payments: account.capabilities?.card_payments,
  }
}

export function snapshotFromAccount(
  account: Stripe.Account,
  extras: { identityStatus?: string | null } = {}
): ConnectStatusSnapshot {
  return {
    stripeConnectAccountId: account.id,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
    connectCapabilities: capabilitiesFromAccount(account),
    identityStatus: extras.identityStatus,
  }
}

export function isConnectPublishReady(input: {
  detailsSubmitted: boolean
  payoutsEnabled: boolean
  transfersStatus: string | undefined
  identityRequired: boolean
  identityStatus: string | null | undefined
}): boolean {
  if (!input.detailsSubmitted) return false
  if (!input.payoutsEnabled) return false
  if (input.transfersStatus !== "active") return false
  if (input.identityRequired && input.identityStatus !== "verified") {
    return false
  }
  return true
}

export async function persistConnectStatus(
  tx: Tx,
  orgId: string,
  snapshot: ConnectStatusSnapshot
): Promise<void> {
  const patch: Partial<typeof main.billingCustomers.$inferInsert> = {
    stripeConnectAccountId: snapshot.stripeConnectAccountId,
    payoutsEnabled: snapshot.payoutsEnabled,
    detailsSubmitted: snapshot.detailsSubmitted,
    requirementsCurrentlyDue: snapshot.requirementsCurrentlyDue,
    connectCapabilities: snapshot.connectCapabilities,
    updatedAt: new Date(),
  }
  if (snapshot.identityStatus !== undefined) {
    patch.identityStatus = snapshot.identityStatus
  }

  const updated = await tx
    .update(main.billingCustomers)
    .set(patch)
    .where(eq(main.billingCustomers.orgId, orgId))
    .returning({ orgId: main.billingCustomers.orgId })
  requireUpdatedBillingCustomer(updated, orgId)
}

export async function persistIdentityStatus(
  tx: Tx,
  orgId: string,
  identityStatus: string
): Promise<void> {
  const updated = await tx
    .update(main.billingCustomers)
    .set({
      identityStatus,
      updatedAt: new Date(),
    })
    .where(eq(main.billingCustomers.orgId, orgId))
    .returning({ orgId: main.billingCustomers.orgId })
  requireUpdatedBillingCustomer(updated, orgId)
}

export function requireUpdatedBillingCustomer(
  updated: ReadonlyArray<unknown>,
  orgId: string
): void {
  if (updated.length === 0) {
    throw new Error(`billing_customers row missing for org ${orgId}`)
  }
}
