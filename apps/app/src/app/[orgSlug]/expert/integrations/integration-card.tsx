"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import type { IntegrationManifest } from "@eleva/integrations"

interface Props {
  manifest: IntegrationManifest
  status: string | null
  integrationId: string | null
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> =
  {
    connected: "default",
    connecting: "secondary",
    disconnected: "secondary",
    error: "destructive",
    expired: "destructive",
  }

export function IntegrationCard({ manifest, status, integrationId }: Props) {
  const t = useTranslations("integrations")
  const rawLocale = useLocale()
  const locale = (["en", "pt", "es"] as const).includes(
    rawLocale as "en" | "pt" | "es"
  )
    ? (rawLocale as "en" | "pt" | "es")
    : "en"
  const description = manifest.description[locale] ?? manifest.description.en

  const isConnected = status === "connected"

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium">
            {manifest.displayName}
          </CardTitle>
          {status && (
            <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
              {status in STATUS_VARIANT
                ? t(`status.${status}` as Parameters<typeof t>[0])
                : status}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{manifest.publisher}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>

        {manifest.category === "calendar" && isConnected && integrationId && (
          <Link
            href="/expert/calendars"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("configureCalendars")}
          </Link>
        )}

        {!isConnected && manifest.connectType === "pipes" && (
          <p className="text-xs text-muted-foreground">
            {t("connectViaPipes")}
          </p>
        )}

        {manifest.countries.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("availableIn", {
              countries: manifest.countries.join(", "),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
