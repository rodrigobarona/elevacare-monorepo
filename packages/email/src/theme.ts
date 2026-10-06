import { BRAND_SCALES as s } from "@eleva/config/brand-colors"
import type { TailwindConfig } from "react-email"

/** Eleva email tokens — brand v2 hex scales; layout rules in `docs/eleva-v3/brand-book/email-system.md`. */
const colors = {
  canvas: s.neutral[50],
  bg: "#FFFFFF",
  "bg-2": s.neutral[100],
  fg: s.neutral[700],
  "fg-2": s.neutral[800],
  "fg-3": s.neutral[600],
  "fg-inverted": "#FFFFFF",
  stroke: s.neutral[200],
  brand: s.teal[700],
  "brand-dark": s.teal[800],
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
