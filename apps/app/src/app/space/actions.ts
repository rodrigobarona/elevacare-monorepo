"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  ApiClientError,
  type CancellationQuote,
  RescheduleMeBookingRequestSchema,
} from "@eleva/api-client"
import { spacePath } from "@eleva/config/routing"
import { getAuthedApiClient, requireMemberSpace } from "@/lib/member-api"

export type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string }

const UuidSchema = z.string().uuid()

function extraCode(err: ApiClientError): string | undefined {
  const body = err.body as { code?: unknown }
  return typeof body.code === "string" ? body.code : undefined
}

function mapGenericError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 401) return "unauthorized"
    if (err.status === 404) return "notFound"
    if (err.status === 422 || err.body.error === "validation")
      return "validation"
    const code = extraCode(err) ?? err.body.error
    switch (code) {
      case "POLICY_TOO_LATE":
        return "tooLate"
      case "INVALID_STATUS":
        return "invalidStatus"
      case "SLOT_TAKEN":
        return "slotTaken"
      case "not_found":
        return "notFound"
      default:
        return "generic"
    }
  }
  return "generic"
}

function revalidateMember() {
  revalidatePath(spacePath())
  revalidatePath(spacePath("sessions"))
  revalidatePath(spacePath("payments"))
}

export async function getCancellationQuoteAction(
  bookingId: string
): Promise<ActionResult<{ quote: CancellationQuote | null }>> {
  const id = UuidSchema.safeParse(bookingId)
  if (!id.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    const quote = await api.me.cancellationQuote(id.data)
    return { ok: true, quote }
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 409) {
      return { ok: true, quote: null }
    }
    console.error("getCancellationQuoteAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function cancelBookingAction(
  bookingId: string
): Promise<ActionResult<{ refund: CancellationQuote }>> {
  const id = UuidSchema.safeParse(bookingId)
  if (!id.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    const { refund } = await api.me.cancelBooking(id.data)
    revalidateMember()
    return { ok: true, refund }
  } catch (err) {
    console.error("cancelBookingAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function rescheduleBookingAction(
  bookingId: string,
  input: unknown
): Promise<ActionResult> {
  const id = UuidSchema.safeParse(bookingId)
  const body = RescheduleMeBookingRequestSchema.safeParse(input)
  if (!id.success || !body.success) {
    return { ok: false, error: "validation" }
  }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    await api.me.rescheduleBooking(id.data, body.data)
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("rescheduleBookingAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}
