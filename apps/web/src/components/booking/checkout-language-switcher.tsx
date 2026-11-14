"use client"

import { Suspense } from "react"
import { LanguageSwitcher } from "../language-switcher"
import { useBookingChrome } from "./booking-chrome-context"

/** Language switch in checkout: keeps the chosen mode and time, and steps
 * aside once the member is entering details or paying. */
export function CheckoutLanguageSwitcher() {
  const { languageLocked } = useBookingChrome()
  if (languageLocked) return null
  return (
    <Suspense fallback={null}>
      <LanguageSwitcher keepQuery showCode />
    </Suspense>
  )
}
