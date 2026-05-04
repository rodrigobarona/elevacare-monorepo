"use client"

import { useEffect, useState, type ReactNode } from "react"
import { loadConnectAndInitialize } from "@stripe/connect-js"
import type { StripeConnectInstance } from "@stripe/connect-js"
import { ConnectComponentsProvider } from "@stripe/react-connect-js"
import { elevaConnectAppearance } from "./appearance"

/**
 * Top-level wrapper for any page that renders Stripe Embedded
 * Components.
 *
 * Responsibilities:
 *   1. Calls back to the API to mint an AccountSession (the
 *      `fetchClientSecret` callback). Stripe automatically refreshes
 *      while the page is open by re-invoking this callback.
 *   2. Applies the Eleva Appearance tokens (see appearance.ts).
 *   3. Locks the publishable key + locale at mount time.
 *
 * Caller SHOULD pass `fetchClientSecret = () => fetch(API_URL +
 * '/stripe/account-session', { credentials: 'include' })...` so the
 * AccountSession endpoint runs server-side with the WorkOS session
 * cookie scoped on `.eleva.care`.
 */

export interface ConnectProviderProps {
  /** Stripe publishable key (from STRIPE_PUBLISHABLE_KEY in env). */
  publishableKey: string
  /** Server callback returning a fresh AccountSession client secret. */
  fetchClientSecret: () => Promise<string>
  /** Locale hint ('en', 'pt', 'es'). Defaults to browser locale. */
  locale?: string
  children: ReactNode
}

export function ElevaConnectProvider({
  publishableKey,
  fetchClientSecret,
  locale,
  children,
}: ConnectProviderProps) {
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null)

  useEffect(() => {
    let cancelled = false
    const next = loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      appearance: elevaConnectAppearance,
      locale: locale ?? undefined,
    })
    if (!cancelled) setInstance(next)
    return () => {
      cancelled = true
    }
  }, [publishableKey, fetchClientSecret, locale])

  if (!instance) return null

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      {children}
    </ConnectComponentsProvider>
  )
}
