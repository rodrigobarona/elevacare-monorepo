import { BRAND_SCALES as s } from "@eleva/config/brand-colors"
import type { TailwindConfig } from "react-email"

/**
 * Eleva email tokens — brand kit (`docs/eleva-v3/brand-book/email-system.md`)
 * plus v2 hex scales for status colors. Use px utilities only; email clients
 * do not reliably honor rem or web fonts.
 */
const colors = {
  canvas: "#F9FAFB",
  bg: "#FFFFFF",
  "bg-2": "#F0FDFF",
  "bg-muted": s.neutral[100],
  fg: "#4A5568",
  "fg-2": s.neutral[800],
  "fg-3": "#6B7280",
  "fg-inverted": "#FFFFFF",
  stroke: "#E2E8F0",
  "stroke-brand": "#E0F8FF",
  brand: "#006D77",
  "brand-dark": "#004D54",
  "brand-light": "#00A8B8",
  accent: s.coral[400],
  danger: s.danger[700],
  success: s.success[700],
} as const

export const elevaTailwindConfig: TailwindConfig = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
}
