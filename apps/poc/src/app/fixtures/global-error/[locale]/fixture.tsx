"use client"

import type { Locale } from "@eleva/config/i18n-locales"
import { GlobalErrorContent } from "@eleva/ui/components/global-error"

const error = { digest: "3912845570" }

export function GlobalErrorFixture({ locale }: { locale: Locale }) {
  return (
    <div
      lang={locale}
      className="flex min-h-svh items-center justify-center bg-background p-6"
    >
      <GlobalErrorContent error={error} retry={() => {}} locale={locale} />
    </div>
  )
}
