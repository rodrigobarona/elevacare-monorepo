import localFont from "next/font/local"

/**
 * Faces the brand lab tries beside Fraunces and DM Sans. All three are under
 * the SIL Open Font Licence 1.1 and self-hosted (latin subset, variable).
 */
export const bricolage = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-bricolage",
  preload: false,
})

export const figtree = localFont({
  src: "./fonts/figtree.woff2",
  weight: "300 900",
  display: "swap",
  variable: "--font-figtree",
  preload: false,
})

export const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader.woff2", weight: "200 800", style: "normal" },
    {
      path: "./fonts/newsreader-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-newsreader",
  preload: false,
})

export const labFontVariables = [
  bricolage.variable,
  figtree.variable,
  newsreader.variable,
].join(" ")
