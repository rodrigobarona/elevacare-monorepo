"use client"

import { WarningIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { useTranslations } from "next-intl"

interface RouteErrorProps {
  error: Error & { digest?: string }
  /** Re-fetches Server Components; plain `reset` would replay a stale RSC payload. */
  unstable_retry: () => void
}

/** Default `error.tsx` body. Shows the server digest so support can trace it. */
export function RouteError({ error, unstable_retry }: RouteErrorProps) {
  const t = useTranslations("routeStates")
  return (
    <div className="flex min-h-[50svh] items-center justify-center p-6">
      <EmptyState
        variant="error"
        className="max-w-lg"
        icon={<WarningIcon />}
        title={t("errorTitle")}
        description={
          <>
            {t("errorDescription")}
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs">
                {t("errorReference", { digest: error.digest })}
              </span>
            ) : null}
          </>
        }
        action={
          <Button size="sm" onPress={unstable_retry}>
            {t("retry")}
          </Button>
        }
      />
    </div>
  )
}
