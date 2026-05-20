import { DM_Sans, IBM_Plex_Mono, Lora } from "next/font/google"

export const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600"],
  variable: "--font-lora",
  preload: true,
  adjustFontFallback: true,
})

export const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  preload: true,
  adjustFontFallback: true,
})

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  preload: false,
  adjustFontFallback: true,
})

/** Apply on `<html>` to expose Eleva font CSS variables app-wide. */
export const fontClassName = [
  lora.variable,
  dmSans.variable,
  ibmPlexMono.variable,
].join(" ")
