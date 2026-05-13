"use client"

import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("common.errors")

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
        {t("generic")}
      </h1>
      <div className="mt-6">
        <Button onClick={reset} variant="outline">
          {t("generic")}
        </Button>
      </div>
    </section>
  )
}
