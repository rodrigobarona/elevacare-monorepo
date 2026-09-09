import type { TailwindConfig } from "react-email"

/** Eleva email tokens — brand book (`docs/eleva-v3/brand-book/email-system.md`). */
const colors = {
  canvas: "#F9FAFB",
  bg: "#FFFFFF",
  "bg-2": "#F3F4F6",
  fg: "#4A5568",
  "fg-2": "#374151",
  "fg-3": "#6B7280",
  "fg-inverted": "#FFFFFF",
  stroke: "#E2E8F0",
  brand: "#006D77",
  "brand-dark": "#004D54",
  danger: "#B91C1C",
  success: "#15803D",
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
