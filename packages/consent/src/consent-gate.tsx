"use client"

import { ConsentGate as C15tConsentGate } from "c15t/next"
import type { ReactNode } from "react"
import { isConsentRuntimeConfigured } from "./env"

export type ConsentCategory =
  | "necessary"
  | "measurement"
  | "marketing"
  | "functionality"
  | "experience"

type Props = {
  category: ConsentCategory
  children: ReactNode
  /** Replaces the built-in c15t placeholder while the category is not allowed. */
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

  return (
    <C15tConsentGate category={category} placeholder={placeholder}>
      {children}
    </C15tConsentGate>
  )
}
