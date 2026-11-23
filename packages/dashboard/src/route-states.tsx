import { MagnifyingGlassIcon } from "@eleva/icons"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { Skeleton } from "@eleva/ui/components/skeleton"
import { getTranslations } from "next-intl/server"

import { gatewayUrl } from "./gateway-url"

/** Default `loading.tsx` body: page-header + content skeleton. */
export async function RouteLoading() {
  const t = await getTranslations("routeStates")
  return (
    <div role="status" aria-live="polite" className="space-y-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

/**
 * `loading.tsx` body for a page that is a table (a queue, a list): the page
 * header, a card with a header row and rows in columns, and the footer
 * line, so the layout does not jump when the rows arrive.
 */
export async function RouteTableLoading() {
  const t = await getTranslations("routeStates")
  const columns = (
    <div className="grid w-full grid-cols-4 gap-4">
      <Skeleton className="h-5" />
      <Skeleton className="h-5" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  )
  return (
    <div role="status" className="mx-auto max-w-5xl space-y-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-10 space-y-3">
        <Skeleton className="h-11 w-72 max-w-full" />
        <Skeleton className="h-7 w-[32rem] max-w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-1">
        <div className="flex h-12 items-center border-b px-3">{columns}</div>
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} className="border-b p-3">
            {columns}
          </div>
        ))}
        {/* The range line only: most queues fit on one page and have no
            controls. */}
        <div className="flex min-h-14 items-center p-3">
          <Skeleton className="h-5 w-44" />
        </div>
      </div>
    </div>
  )
}

/** Default `not-found.tsx` body. */
export async function RouteNotFound() {
  const t = await getTranslations("routeStates")
  return (
    <div
      className="flex min-h-[60svh] items-center justify-center p-6"
      data-testid="route-not-found"
    >
      <EmptyState
        variant="no-results"
        className="max-w-lg"
        icon={<MagnifyingGlassIcon />}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
        action={
          <a
            href={gatewayUrl("/dashboard")}
            className={buttonVariants({ size: "sm" })}
          >
            {t("goToDashboard")}
          </a>
        }
      />
    </div>
  )
}
