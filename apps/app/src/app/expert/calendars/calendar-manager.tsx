"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@eleva/ui/components/button"
import { Badge } from "@eleva/ui/components/badge"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { startCalendarOAuth, disconnectCalendarAction } from "./actions"

interface ConnectedCal {
  id: string
  provider: "google" | "microsoft"
  accountEmail: string
  status: string
}

interface Props {
  calendars: ConnectedCal[]
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Calendar",
}

export function CalendarManager({ calendars }: Props) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConnect(provider: "google" | "microsoft") {
    setPending(true)
    setError(null)
    try {
      const result = await startCalendarOAuth(provider)
      if (result.ok) {
        window.location.href = result.authorizationUrl
        return
      }
      setError(result.error)
    } catch {
      setError("connection-failed")
    } finally {
      setPending(false)
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Disconnect this calendar?")) return
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
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {calendars.length > 0 && (
        <div className="space-y-3">
          {calendars.map((cal) => (
            <Card key={cal.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-0.5">
                  <CardTitle className="text-base">
                    {PROVIDER_LABEL[cal.provider] ?? cal.provider}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {cal.accountEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      cal.status === "connected" ? "default" : "secondary"
                    }
                  >
                    {cal.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(cal.id)}
                    disabled={pending}
                  >
                    Disconnect
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => handleConnect("google")}
          disabled={pending}
        >
          Connect Google Calendar
        </Button>
        <Button
          variant="outline"
          onClick={() => handleConnect("microsoft")}
          disabled={pending}
        >
          Connect Microsoft Calendar
        </Button>
      </div>
    </div>
  )
}
