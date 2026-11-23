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
 *
 * `describedBy` (an element id) is read after the heading: "Clinic
 * verifications, Showing 26 to 50 of 112", so the change is said even
 * where the tab title is not announced.
 */
export function FocusHeadingOnChange({
  value,
  describedBy,
}: {
  value: string | number
  describedBy?: string
}) {
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
    if (describedBy) heading.setAttribute("aria-describedby", describedBy)
    heading.focus()
    // The description is this component's only while it is the one it set.
    return () => {
      if (
        describedBy &&
        heading.getAttribute("aria-describedby") === describedBy
      )
        heading.removeAttribute("aria-describedby")
    }
  }, [value, describedBy])
  return null
}
