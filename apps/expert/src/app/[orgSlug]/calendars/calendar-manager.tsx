"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { authClient, CALENDAR_OAUTH_SCOPES } from "@eleva/auth/client"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { disconnectCalendarAction } from "./actions"

interface CalendarIntegration {
  id: string
  slug: string
  providerLabel: string
  accountIdentifier: string | null
  status: string
}

interface Props {
  integrations: CalendarIntegration[]
  callbackURL: string
}

export function CalendarManager({ integrations, callbackURL }: Props) {
  const router = useRouter()
  const t = useTranslations("calendars")
  const [pending, setPending] = React.useState<string | null>(null)

  function showError(key: string) {
    toast.error(t(`error.${key}` as Parameters<typeof t>[0]))
  }

  async function handleConnect(provider: "google" | "microsoft") {
    setPending(provider)
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL,
        scopes: [...CALENDAR_OAUTH_SCOPES[provider]],
      })
      if (result.error) {
        showError("connect-failed")
        return
      }
      if (result.data?.url) {
        window.location.assign(result.data.url)
        return
      }
      router.refresh()
    } catch {
      showError("connect-failed")
    } finally {
      setPending(null)
    }
  }

  async function handleDisconnect(id: string) {
    setPending(id)
    try {
      const result = await disconnectCalendarAction(id)
      if (result.ok) {
        router.refresh()
      } else {
        showError(result.error)
      }
    } catch {
      showError("disconnect-failed")
    } finally {
      setPending(null)
    }
  }

  const hasConnectedCalendar = integrations.some(
    (i) => i.status === "connected"
  )
  const connectedSlugs = new Set(integrations.map((i) => i.slug))

  return (
    <div className="space-y-6">
      {!hasConnectedCalendar ? (
        <Alert>
          <AlertDescription>{t("noCalendarFallback")}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("connectTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("connectDescription")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onPress={() => handleConnect("google")}
              isDisabled={pending !== null}
            >
              {connectedSlugs.has("google-calendar")
                ? t("reconnectGoogle")
                : t("connectGoogle")}
            </Button>
            <Button
              variant="secondary"
              onPress={() => handleConnect("microsoft")}
              isDisabled={pending !== null}
            >
              {connectedSlugs.has("microsoft-calendar")
                ? t("reconnectMicrosoft")
                : t("connectMicrosoft")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {integrations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("connectedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {integrations.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{cal.providerLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {cal.accountIdentifier ?? ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      cal.status === "connected" ? "default" : "secondary"
                    }
                  >
                    {t(`status.${cal.status}` as Parameters<typeof t>[0])}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => handleDisconnect(cal.id)}
                    isDisabled={pending !== null}
                  >
                    {t("disconnect")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
