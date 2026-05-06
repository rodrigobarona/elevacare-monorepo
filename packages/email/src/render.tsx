import { render } from "react-email"
import {
  BookingConfirmedEmail,
  type BookingConfirmedProps,
} from "./templates/booking-confirmed"
import {
  BookingRescheduledEmail,
  type BookingRescheduledProps,
} from "./templates/booking-rescheduled"
import {
  BookingCancelledEmail,
  type BookingCancelledProps,
} from "./templates/booking-cancelled"

export async function renderBookingConfirmed(
  props: BookingConfirmedProps
): Promise<string> {
  return render(<BookingConfirmedEmail {...props} />)
}

export async function renderBookingRescheduled(
  props: BookingRescheduledProps
): Promise<string> {
  return render(<BookingRescheduledEmail {...props} />)
}

export async function renderBookingCancelled(
  props: BookingCancelledProps
): Promise<string> {
  return render(<BookingCancelledEmail {...props} />)
}
