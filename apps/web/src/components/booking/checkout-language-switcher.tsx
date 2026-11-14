"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LanguageSwitcher } from "../language-switcher"
import { useBookingChrome } from "./booking-chrome-context"

function SwitcherKeepingQuery() {
  const searchParams = useSearchParams()
  return <LanguageSwitcher query={searchParams.toString()} showCode />
}

/** Language switch in checkout: keeps the chosen mode and time, and steps
 * aside once the member has typed details or holds a time. */
export function CheckoutLanguageSwitcher() {
  const { languageLocked } = useBookingChrome()
  if (languageLocked) return null
  return (
    <Suspense fallback={null}>
      <SwitcherKeepingQuery />
    </Suspense>
  )
}
