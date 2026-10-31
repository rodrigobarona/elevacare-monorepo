import localFont from "next/font/local"

/**
 * Self-hosted Eleva brand fonts via `next/font/local`.
 *
 * Prefer local over `next/font/google`: Turbopack on Next.js 16.2 can fail CI
 * builds with `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`
 * / `next/font/google queries have exactly one entry` when multiple apps fetch
 * Google Fonts in parallel (flaky on GHA; already seen on main after #98).
 *
 * Latin subset covers Eleva locales (en/pt/es); Latin-1 accents (ã, ç, ñ, …)
 * are included. Paths are relative to this file.
 *
 * Preload the body and display faces. Fraunces headings set the hero, so a
 * late swap moves the whole block and shows up as layout shift. The italic
 * face goes unused below `lg` on auth (aside is `hidden`), which costs a
 * “preloaded but not used” console note there.
 */
export const fraunces = localFont({
  src: [
    {
      path: "./fonts/files/fraunces-latin.woff2",
      weight: "300 700",
      style: "normal",
    },
    {
      path: "./fonts/files/fraunces-italic-latin.woff2",
      weight: "300 700",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-fraunces",
  preload: true,
  // localFont accepts a metric-override family name or false (not `true`).
  adjustFontFallback: "Times New Roman",
})

export const dmSans = localFont({
  src: "./fonts/files/dm-sans-latin.woff2",
  display: "swap",
  weight: "400 700",
  variable: "--font-dm-sans",
  preload: true,
  adjustFontFallback: "Arial",
})

export const ibmPlexMono = localFont({
  src: [
    {
      path: "./fonts/files/ibm-plex-mono-400-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/files/ibm-plex-mono-500-latin.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-ibm-plex-mono",
  preload: false,
  // Mono metrics: only Arial | Times New Roman are accepted by localFont.
  adjustFontFallback: "Arial",
})

/**
 * Google Sans Medium for the "Continue with Google" button only (Google
 * Identity branding guidelines). Not part of `fontClassName`; apply via
 * `googleSans.className` on the button.
 */
export const googleSans = localFont({
  src: "./fonts/files/google-sans-medium-latin.woff2",
  weight: "500",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
})

/**
 * Apply on `<html>`: DM Sans `className` so the preloaded body face is used on
 * first paint (CSS-variable-only application can leave the preload unused),
 * plus CSS variables for Tailwind `font-sans` / `font-heading` / `font-mono`.
 */
export const fontClassName = [
  dmSans.className,
  fraunces.variable,
  dmSans.variable,
  ibmPlexMono.variable,
].join(" ")
