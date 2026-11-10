import { defineTheme } from "c15t/next"

/**
 * Eleva brand v3 for the consent banner and dialog: the same teal, sand
 * and paper tokens as `@eleva/ui` (`packages/ui/src/styles/globals.css`),
 * and a soft rounded card. The theme only carries tokens: `ConsentTheme`
 * turns it into CSS variables. Button modes and part styles are provider
 * options ({@link elevaConsentActions}, {@link elevaConsentComponents}).
 */
const TEAL_700 = "oklch(0.488 0.084 205.9)"
const TEAL_800 = "oklch(0.404 0.07 209.3)"
const TEAL_400 = "oklch(0.735 0.106 205.9)"
const SAND_50 = "oklch(0.985 0.007 80)"
const SAND_200 = "oklch(0.93 0.021 76)"
const NEUTRAL_900 = "oklch(0.315 0.01 215)"
const NEUTRAL_950 = "oklch(0.235 0.008 215)"

export const elevaConsentTheme = defineTheme({
  colors: {
    primary: TEAL_700,
    primaryHover: TEAL_800,
    background: SAND_50,
    backgroundElevated: "#ffffff",
    text: "#1c1917",
    textMuted: "#57534e",
    border: SAND_200,
  },
  dark: {
    primary: TEAL_400,
    primaryHover: "oklch(0.8 0.09 205.9)",
    background: NEUTRAL_950,
    backgroundElevated: NEUTRAL_900,
    text: "#fafaf9",
    textMuted: "#a8a29e",
    border: "#44403c",
  },
  radius: { md: "0.75rem", lg: "1.5rem" },
  typography: {
    fontFamily:
      '"DM Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  },
})

/**
 * "Reject optional" and "Accept all" carry equal weight (no nudge, EDPB
 * guidance on deceptive design); "Customize" is a quiet ghost button.
 */
export const elevaConsentActions = {
  reject: { variant: "neutral", mode: "stroke" },
  accept: { variant: "neutral", mode: "stroke" },
  customize: { variant: "neutral", mode: "ghost" },
} as const

const PILL = { style: { borderRadius: "9999px" } }

/** Pill buttons like the rest of the site, and a compact card. */
export const elevaConsentComponents = {
  button: { primary: PILL, secondary: PILL },
  banner: {
    card: {
      style: {
        maxWidth: "26rem",
        boxShadow: "0 12px 40px -12px rgb(28 25 23 / 0.18)",
      },
    },
  },
}
