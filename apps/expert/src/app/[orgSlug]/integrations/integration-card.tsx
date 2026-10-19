"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  CalendarDotsIcon,
  PlugIcon,
  UsersIcon,
  VideoCameraIcon,
  WalletIcon,
} from "@eleva/icons"
import type {
  IntegrationCategory,
  IntegrationManifest,
} from "@eleva/integrations"
import { LinkButton } from "@eleva/ui/components/button"
import { StatusPill } from "@eleva/ui/components/status-pill"
import type { StatusTone } from "@eleva/ui/components/status-pill"

interface Props {
  manifest: IntegrationManifest
  status: string | null
  workspaceBase: string
}

type ConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error"
  | "expired"

const STATUS_TONE: Record<ConnectionStatus, StatusTone> = {
  connected: "positive",
  connecting: "neutral",
  disconnected: "neutral",
  error: "attention",
  expired: "attention",
}

function isConnectionStatus(value: string): value is ConnectionStatus {
  return value in STATUS_TONE
}

function categoryIcon(category: IntegrationCategory): ReactNode {
  switch (category) {
    case "calendar":
      return <CalendarDotsIcon />
    case "invoicing":
      return <WalletIcon />
    case "crm":
      return <UsersIcon />
    case "video":
      return <VideoCameraIcon />
    case "other":
      return <PlugIcon />
    default: {
      const _exhaustive: never = category
      return _exhaustive
    }
  }
}

export function IntegrationCard({ manifest, status, workspaceBase }: Props) {
  const t = useTranslations("integrations")
  const rawLocale = useLocale()
  const locale = (["en", "pt", "es"] as const).includes(
    rawLocale as "en" | "pt" | "es"
  )
    ? (rawLocale as "en" | "pt" | "es")
    : "en"
  const description = manifest.description[locale] ?? manifest.description.en
  const nameKey = `names.${manifest.slug}`
  const displayName = t.has(nameKey) ? t(nameKey) : manifest.displayName
  const knownStatus = status && isConnectionStatus(status) ? status : null
  const isCalendar = manifest.category === "calendar"

  return (
    <li className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-1">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200 [&_svg]:size-5"
        >
          {categoryIcon(manifest.category)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{displayName}</h3>
          <p className="text-xs text-muted-foreground">{manifest.publisher}</p>
        </div>
        {knownStatus ? (
          <StatusPill tone={STATUS_TONE[knownStatus]}>
            {t(`status.${knownStatus}`)}
          </StatusPill>
        ) : null}
      </div>

      <p className="flex-1 text-sm text-muted-foreground">{description}</p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {manifest.countries.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("availableIn", { countries: manifest.countries.join(", ") })}
          </p>
        ) : (
          <span />
        )}
        {isCalendar ? (
          <LinkButton
            href={`${workspaceBase}/calendars`}
            variant={knownStatus === "connected" ? "outline" : "default"}
            size="sm"
            aria-label={
              knownStatus === "connected"
                ? t("configureCalendarsNamed", { name: displayName })
                : t("connectCalendarNamed", { name: displayName })
            }
          >
            {knownStatus === "connected"
              ? t("configureCalendars")
              : t("connectCalendar")}
          </LinkButton>
        ) : null}
      </div>
    </li>
  )
}
