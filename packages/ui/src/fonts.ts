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
 */
export const lora = localFont({
  src: "./fonts/files/lora-latin.woff2",
  display: "swap",
  weight: "400 600",
  variable: "--font-lora",
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

/** Apply on `<html>` to expose Eleva font CSS variables app-wide. */
export const fontClassName = [
  lora.variable,
  dmSans.variable,
  ibmPlexMono.variable,
].join(" ")
