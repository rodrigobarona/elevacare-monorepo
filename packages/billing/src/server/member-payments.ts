import {
  cacheBookingPaymentReceipt,
  listMemberPayments,
  type MemberListResult,
  type MemberPaymentListItem,
} from "@eleva/db"
import { retrieveChargeReceipt } from "./receipts"

const RECEIPT_CONCURRENCY = 5

export async function listMemberPaymentsWithReceipts(input: {
  userId: string
  cursor?: string
  limit?: number
}): Promise<MemberListResult<MemberPaymentListItem>> {
  const listed = await listMemberPayments(input)
  const items = await mapPool(
    listed.items,
    RECEIPT_CONCURRENCY,
    resolvePaymentReceipt
  )
  return { items, nextCursor: listed.nextCursor }
}

function needsReceipt(payment: MemberPaymentListItem): boolean {
  return (
    !payment.receiptUrl &&
    Boolean(payment.stripeChargeId ?? payment.stripePaymentIntentId)
  )
}

async function resolvePaymentReceipt(
  payment: MemberPaymentListItem
): Promise<MemberPaymentListItem> {
  if (!needsReceipt(payment)) return payment
  try {
    const receipt = await retrieveChargeReceipt({
      stripeChargeId: payment.stripeChargeId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
    })
    if (!receipt) return payment
    await cacheBookingPaymentReceipt({
      paymentId: payment.id,
      orgId: payment.orgId,
      receiptUrl: receipt.receiptUrl,
      stripeChargeId: receipt.stripeChargeId,
    })
    return {
      ...payment,
      receiptUrl: receipt.receiptUrl,
      stripeChargeId: receipt.stripeChargeId,
    }
  } catch (err) {
    console.warn(
      "[me/payments] receipt retrieve failed",
      payment.id,
      err instanceof Error ? err.message : err
    )
    return payment
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      out[index] = await fn(items[index] as T)
    }
  }
  const workers = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return out
}
