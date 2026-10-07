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

/** Default `not-found.tsx` body. */
export async function RouteNotFound() {
  const t = await getTranslations("routeStates")
  return (
    <div className="flex min-h-[60svh] items-center justify-center p-6">
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
