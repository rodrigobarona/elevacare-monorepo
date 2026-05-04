import type { ReactNode } from "react"

/**
 * Root layout — required by Next.js App Router but kept thin: the real
 * `<html>` tag lives in `app/[locale]/layout.tsx` so we can set the
 * `lang` attribute per locale and load locale-aware fonts/messages.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
