"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { ArrowSquareOutIcon, WarningIcon } from "@eleva/icons"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { LinkButton } from "@eleva/ui/components/button"

/**
 * A change the API refused because published services still rely on it.
 * Shown next to Save and focused when it appears, so keyboard and
 * screen-reader users hear it. Services open in a new tab so the edit in
 * progress is not lost.
 */
export function BlockedByServices({
  message,
  servicesHref,
}: {
  message: string
  servicesHref: string
}) {
  const t = useTranslations("publicProfile")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [message])

  return (
    <div ref={ref} tabIndex={-1} className="mt-5 outline-none">
      <Alert variant="destructive" role="alert">
        <WarningIcon aria-hidden weight="duotone" />
        <AlertDescription className="space-y-3">
          <p>{message}</p>
          <LinkButton
            href={servicesHref}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
          >
            {t("practice.openServices")}
            <ArrowSquareOutIcon aria-hidden className="ms-1.5 size-4" />
            <span className="sr-only">{t("newTab")}</span>
          </LinkButton>
        </AlertDescription>
      </Alert>
    </div>
  )
}

/** "“A”, “B” and “C”" in the reader's language. */
export function quotedList(locale: string, items: string[]): string {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(
    items.map((item) => `“${item}”`)
  )
}

/** "A, B and C" in the reader's language. */
export function plainList(locale: string, items: string[]): string {
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(items)
}
