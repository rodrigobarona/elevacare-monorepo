import { BRAND_SCALES as s } from "@eleva/config/brand-colors"
import type { TailwindConfig } from "react-email"

/**
 * Eleva email tokens — brand v3 warm editorial
 * (`docs/eleva-v3/brand-book/email-system.md`). Use px utilities only; email
 * clients do not reliably honor rem or web fonts, so headings use Georgia as
 * the email-safe serif stand-in for Fraunces.
 */
const colors = {
  canvas: s.sand[100],
  bg: "#FFFFFF",
  "bg-2": s.teal[50],
  "bg-muted": s.sand[50],
  fg: s.neutral[800],
  "fg-2": s.neutral[950],
  "fg-3": s.neutral[700],
  "fg-inverted": "#FFFFFF",
  stroke: s.sand[200],
  "stroke-brand": s.teal[100],
  brand: s.teal[700],
  "brand-dark": s.teal[800],
  "brand-light": s.teal[500],
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
        serif: ["Georgia", "Times New Roman", "Times", "serif"],
      },
    },
  },
}
