"use client"

import type { ErrorInfo } from "next/error"
import { useTranslations } from "next-intl"

import { LEGAL_ENTITY } from "@eleva/config/legal-entity"
import { WarningIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import {
  ErrorReference,
  ErrorRetryLabel,
  errorDigest,
  errorSupportLinkClassName,
  useErrorRetry,
} from "@eleva/ui/components/error-recovery"

import { gatewayUrl } from "./gateway-url"

/**
 * Default `error.tsx` body, shown inside the dashboard shell.
 *
 * The props are Next's own (`ErrorInfo`), so a renamed prop fails typecheck
 * instead of leaving "Try again" without a handler. `retry` asks the server
 * again; plain `reset` would replay the payload that just failed.
 */
export function RouteError({
  error,
  retry,
}: Pick<ErrorInfo, "error" | "retry">) {
  const t = useTranslations("routeStates")
  const reference = errorDigest(error)
  const { offline, stillFailing, retryButtonProps } = useErrorRetry(retry)
  const email = LEGAL_ENTITY.supportEmail
  const subject = reference
    ? t("errorEmailSubject", { reference })
    : t("errorEmailSubjectNoReference")
  const supportLink = (chunks: React.ReactNode) => (
    <a
      href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
      className={errorSupportLinkClassName}
    >
      {chunks}
    </a>
  )

  return (
    <div
      className="flex min-h-[50svh] items-center justify-center py-6 sm:p-6"
      data-testid="route-error"
    >
      <section className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center text-balance md:p-12">
        <div
          aria-hidden="true"
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-subtle text-warning"
        >
          <WarningIcon className="size-6" />
        </div>
        {/* One alert: after a failed retry this page is a new one, and a status
            line that arrives already filled is often not announced. */}
        <div role="alert" className="mt-4 space-y-2">
          <h1 className="font-heading text-lg font-medium tracking-tight">
            {t("errorTitle")}
          </h1>
          <p className="text-sm/relaxed text-muted-foreground">
            {offline ? t("errorOffline") : t("errorDescription")}
          </p>
          {/* Always rendered, so the card keeps its height between states. */}
          <p className="min-h-10 text-sm text-foreground sm:min-h-5">
            {stillFailing ? t("retryFailed") : null}
          </p>
        </div>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Button {...retryButtonProps}>
            <ErrorRetryLabel
              isPending={retryButtonProps.isPending}
              label={t("retry")}
              pendingLabel={t("retrying")}
            />
          </Button>
          <a
            href={gatewayUrl("/dashboard")}
            className={buttonVariants({ variant: "ghost" })}
          >
            {t("goToDashboard")}
          </a>
        </div>
        <div className="mt-8 space-y-3 border-t pt-6">
          <p className="text-sm/relaxed text-muted-foreground">
            {t.rich(reference ? "errorSupport" : "errorSupportNoReference", {
              email,
              link: supportLink,
            })}
          </p>
          {reference ? (
            <ErrorReference
              label={t("errorReferenceLabel")}
              reference={reference}
              copyLabel={t("copyReference")}
              copiedLabel={t("copied")}
              copiedAnnouncement={t("referenceCopied")}
              copyFailedAnnouncement={t("referenceSelected")}
            />
          ) : null}
        </div>
      </section>
    </div>
  )
}
