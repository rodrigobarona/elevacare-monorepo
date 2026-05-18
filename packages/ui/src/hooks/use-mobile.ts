import * as React from "react"

const MOBILE_BREAKPOINT = 768

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot(): boolean {
  return false
}

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

/**
 * Subscribes to a `(max-width: 767px)` media query and returns whether the
 * viewport is currently mobile-sized. SSR-safe: returns `false` on the
 * server and hydrates to the real value on the client without triggering
 * cascading renders (uses `useSyncExternalStore` per React 18+ guidance).
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
