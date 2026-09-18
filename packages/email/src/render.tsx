import { render } from "react-email"
import {
  AuthTransactionalEmail,
  AUTH_EMAIL_SUBJECT,
  authEmailText,
  type AuthEmailKind,
  type AuthTransactionalProps,
} from "./components/auth-transactional"
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
import {
  InvoiceClosedGateEmail,
  type InvoiceClosedGateProps,
} from "./templates/invoice-closed-gate"
import type { EmailLocale } from "./i18n"

export type AuthEmailContent = {
  subject: string
  html: string
  title: string
  body: string
}

export async function renderAuthEmail(
  input: AuthTransactionalProps & { kind: AuthEmailKind }
): Promise<AuthEmailContent> {
  const locale: EmailLocale = input.locale ?? "en"
  const text = authEmailText(input.kind, locale)
  const html = await render(
    <AuthTransactionalEmail
      kind={input.kind}
      url={input.url}
      code={input.code}
      name={input.name}
      locale={locale}
    />
  )
  return {
    subject: AUTH_EMAIL_SUBJECT[input.kind][locale],
    html,
    title: text.title,
    body: text.body,
  }
}

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

export async function renderInvoiceClosedGate(
  props: InvoiceClosedGateProps
): Promise<string> {
  return render(<InvoiceClosedGateEmail {...props} />)
}
