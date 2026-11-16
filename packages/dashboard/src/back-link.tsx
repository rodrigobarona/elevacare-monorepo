import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "@eleva/icons"

/**
 * "← Services": the quiet link above a detail page's headline that says
 * where the page sits and leads back to its list (the navigation cannot
 * say it on a phone).
 */
export function BackLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {children}
    </Link>
  )
}
