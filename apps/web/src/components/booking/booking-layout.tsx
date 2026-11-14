import type { ReactNode } from "react"
import { getLocale } from "next-intl/server"
import { CheckoutSiteFooter } from "@eleva/site-chrome/checkout-site-footer"
import { BookingChromeProvider } from "./booking-chrome-context"
import { CheckoutHeader } from "./checkout-header"

/**
 * Booking and checkout, from the first step to the thank-you page: a quiet
 * frame with no site navigation or marketing footer, so nothing pulls the
 * member out of the booking (design slice D1.1).
 */
export async function BookingLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  return (
    <BookingChromeProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <CheckoutHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <CheckoutSiteFooter locale={locale} />
      </div>
    </BookingChromeProvider>
  )
}
