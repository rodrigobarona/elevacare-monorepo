import { defineTheme } from "c15t/next"

/** Eleva brand v3 — teal primary aligned with @eleva/ui `--primary` (teal-700). */
export const elevaConsentTheme = defineTheme({
  colors: {
    primary: "#0f766e",
    primaryHover: "#0d5c56",
    background: "#faf9f7",
    backgroundElevated: "#ffffff",
    text: "#1c1917",
    textMuted: "#57534e",
    border: "#e7e5e4",
  },
  dark: {
    primary: "#2dd4bf",
    primaryHover: "#5eead4",
    background: "#1c1917",
    backgroundElevated: "#292524",
    text: "#fafaf9",
    textMuted: "#a8a29e",
    border: "#44403c",
  },
  radius: { md: "0.5rem", lg: "0.75rem" },
  typography: {
    fontFamily:
      '"DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  },
})
