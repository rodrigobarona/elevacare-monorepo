"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  disconnectCalendarAction,
  loadSubCalendars,
  saveBusySources,
  saveDestinationCalendar,
} from "./actions"

interface ConnectedCal {
  id: string
  provider: "google" | "microsoft"
  accountEmail: string
  status: string
}

interface Props {
  calendars: ConnectedCal[]
  pipesWidgetToken: string
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Calendar",
}

export function CalendarManager({ calendars, pipesWidgetToken }: Props) {
  const router = useRouter()
  const t = useTranslations("calendars")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleDisconnect(id: string) {
    setPending(true)
    setError(null)
    try {
      const result = await disconnectCalendarAction(id)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    } catch {
      setError("disconnect-failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("connectTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("connectDescription")}
          </p>
          <div
            data-workos-pipes-widget
            data-auth-token={pipesWidgetToken}
            className="min-h-[200px]"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t("connectHint")}
          </p>
        </CardContent>
      </Card>

      {calendars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("connectedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {calendars.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {PROVIDER_LABEL[cal.provider] ?? cal.provider}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cal.accountEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      cal.status === "connected" ? "default" : "secondary"
                    }
                  >
                    {t(`status.${cal.status}`)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(cal.id)}
                    disabled={pending}
                  >
                    {t("disconnect")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
