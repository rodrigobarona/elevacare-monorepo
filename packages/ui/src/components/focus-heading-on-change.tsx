"use client"

import { useEffect } from "react"

// The last value seen on each page address. Kept outside React: a loading
// skeleton unmounts the page between two values, and the page that comes
// back is a new one.
const seen = new Map<string, string>()

/**
 * Moves focus to the page's heading when `value` changes on the same
 * address (another page of a list, another filter), so a keyboard or
 * screen reader user continues from the top of the new content and not
 * from a control that is gone. Does nothing on the first visit.
 */
export function FocusHeadingOnChange({ value }: { value: string | number }) {
  useEffect(() => {
    const address = window.location.pathname
    const previous = seen.get(address)
    const current = String(value)
    seen.set(address, current)
    if (previous === undefined || previous === current) return
    const heading = document.querySelector<HTMLElement>("main h1")
    if (!heading) return
    if (!heading.hasAttribute("tabindex"))
      heading.setAttribute("tabindex", "-1")
    heading.focus()
  }, [value])
  return null
}
