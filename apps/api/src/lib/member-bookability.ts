import { assertMemberCanBook, BookingError } from "@eleva/scheduling"
import { secureJson } from "@/lib/security-headers"

export async function rejectIfMemberCannotBook(
  userId: string | undefined,
  headers: HeadersInit
): Promise<Response | null> {
  if (!userId) return null
  try {
    await assertMemberCanBook(userId)
    return null
  } catch (err) {
    if (err instanceof BookingError) {
      return secureJson({ error: err.code }, { status: 409, headers })
    }
    throw err
  }
}

export function paymentIntentBookabilityStatus(error: string): number | null {
  if (error === "ACCOUNT_DELETION_SCHEDULED" || error === "ACCOUNT_BANNED") {
    return 409
  }
  return null
}
