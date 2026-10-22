"use client"

import { ConsentGate as C15tConsentGate } from "c15t/next"
import type { ReactNode } from "react"
import { isConsentRuntimeConfigured } from "./env"

export type ConsentCategory =
  | "necessary"
  | "measurement"
  | "marketing"
  | "experience"

type Props = {
  category: ConsentCategory
  children: ReactNode
  /** Reserved for a click-to-load placeholder once c15t exposes a slot API. */
  placeholder?: ReactNode
}

/**
 * Blocks optional embeds until the member opts in. When c15t is not configured,
 * children render immediately (local dev without Inth URL).
 */
export function ConsentGate({ category, children, placeholder }: Props) {
  if (category === "necessary" || !isConsentRuntimeConfigured()) {
    return children
  }

  void placeholder

  return <C15tConsentGate category={category}>{children}</C15tConsentGate>
}
