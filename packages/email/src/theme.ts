import type { TailwindConfig } from "react-email"

const colors = {
  canvas: "#F9FAFB",
  bg: "#FFFFFF",
  "bg-2": "#F3F4F6",
  fg: "#111827",
  "fg-2": "#374151",
  "fg-3": "#6B7280",
  "fg-inverted": "#FFFFFF",
  stroke: "#E5E7EB",
  brand: "#16A34A",
  "brand-dark": "#15803D",
  danger: "#DC2626",
  success: "#16A34A",
} as const

export const elevaTailwindConfig: TailwindConfig = {
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
}
