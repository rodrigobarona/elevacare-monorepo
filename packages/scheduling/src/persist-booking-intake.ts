import { persistBookingIntake } from "@eleva/records"

export async function persistIntakeAfterConfirm(
  bookingId: string
): Promise<void> {
  try {
    await persistBookingIntake(bookingId)
  } catch (err) {
    console.error("[bookings/confirm] persist intake failed", err)
  }
}
