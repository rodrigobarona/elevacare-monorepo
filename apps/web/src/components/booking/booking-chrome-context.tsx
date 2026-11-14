"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

/**
 * Shared between the checkout header and the booking funnel. Once the
 * member starts entering details (or holds a time), switching language
 * would reload the page and lose what she typed and her hold, so the
 * header hides the switch from then on.
 */
const BookingChromeContext = createContext<{
  languageLocked: boolean
  setLanguageLocked: (locked: boolean) => void
}>({ languageLocked: false, setLanguageLocked: () => {} })

export function BookingChromeProvider({ children }: { children: ReactNode }) {
  const [languageLocked, setLanguageLocked] = useState(false)
  return (
    <BookingChromeContext.Provider
      value={{ languageLocked, setLanguageLocked }}
    >
      {children}
    </BookingChromeContext.Provider>
  )
}

export function useBookingChrome() {
  return useContext(BookingChromeContext)
}
