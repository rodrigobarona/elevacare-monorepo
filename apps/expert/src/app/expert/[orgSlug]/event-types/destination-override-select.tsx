"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  setEventTypeDestinationAction,
  setEventTypeModeDestinationAction,
} from "./destination-actions"

export type CalendarIntegrationOption = {
  id: string
  providerLabel: string
  accountIdentifier: string | null
}

export type DestinationOverrideValue = {
  destinationIntegrationId: string | null
  destinationExternalCalendarId: string | null
}

export type SubCalendarOption = {
  id: string
  name: string
  primary: boolean
}

const INHERIT_KEY = "__inherit__"

function destinationKey(
  integrationId: string,
  externalCalendarId: string
): string {
  return `${integrationId}::${externalCalendarId}`
}

function parseDestinationKey(
  key: string
): { integrationId: string; externalCalendarId: string } | null {
  const sep = key.indexOf("::")
  if (sep <= 0) return null
  return {
    integrationId: key.slice(0, sep),
    externalCalendarId: key.slice(sep + 2),
  }
}

interface Props {
  eventTypeId: string
  modeId?: string
  integrations: CalendarIntegrationOption[]
  subCalendarsByIntegration: Record<string, SubCalendarOption[]>
  value: DestinationOverrideValue
  inheritLabel: string
  testId?: string
}

export function DestinationOverrideSelect({
  eventTypeId,
  modeId,
  integrations,
  subCalendarsByIntegration,
  value,
  inheritLabel,
  testId,
}: Props) {
  const t = useTranslations("eventTypes.destination")
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [selected, setSelected] = React.useState(() =>
    value.destinationIntegrationId && value.destinationExternalCalendarId
      ? destinationKey(
          value.destinationIntegrationId,
          value.destinationExternalCalendarId
        )
      : INHERIT_KEY
  )

  React.useEffect(() => {
    setSelected(
      value.destinationIntegrationId && value.destinationExternalCalendarId
        ? destinationKey(
            value.destinationIntegrationId,
            value.destinationExternalCalendarId
          )
        : INHERIT_KEY
    )
  }, [value.destinationIntegrationId, value.destinationExternalCalendarId])

  async function handleChange(key: string | number | null) {
    if (typeof key !== "string" || pending) return
    const previous = selected
    setSelected(key)
    setPending(true)

    const payload =
      key === INHERIT_KEY
        ? {
            destinationIntegrationId: null,
            destinationExternalCalendarId: null,
          }
        : (() => {
            const parsed = parseDestinationKey(key)
            if (!parsed) return null
            return {
              destinationIntegrationId: parsed.integrationId,
              destinationExternalCalendarId: parsed.externalCalendarId,
            }
          })()

    if (!payload) {
      setSelected(previous)
      setPending(false)
      return
    }

    const result = modeId
      ? await setEventTypeModeDestinationAction(eventTypeId, modeId, payload)
      : await setEventTypeDestinationAction(eventTypeId, payload)

    setPending(false)
    if (!result.ok) {
      setSelected(previous)
      switch (result.error) {
        case "unauthorized-calendar":
          toast.error(t("error.unauthorized-calendar"))
          break
        case "not-found":
          toast.error(t("error.not-found"))
          break
        case "validation":
        case "invalid-input":
          toast.error(t("error.validation"))
          break
        default:
          toast.error(t("error.destination-failed"))
      }
      return
    }
    toast.success(t("saved"))
    router.refresh()
  }

  if (integrations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={testId}>
        {t("noCalendars")}
      </p>
    )
  }

  return (
    <Select
      selectedKey={selected}
      onSelectionChange={handleChange}
      isDisabled={pending}
    >
      <Label>{t("label")}</Label>
      <SelectTrigger data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem id={INHERIT_KEY} textValue={inheritLabel}>
          {inheritLabel}
        </SelectItem>
        {integrations.map((integration) => {
          const calendars = subCalendarsByIntegration[integration.id] ?? []
          const account =
            integration.accountIdentifier ?? integration.providerLabel
          return calendars.map((cal) => {
            const id = destinationKey(integration.id, cal.id)
            const label = `${account} — ${cal.name}${cal.primary ? ` (${t("primary")})` : ""}`
            return (
              <SelectItem key={id} id={id} textValue={label}>
                {label}
              </SelectItem>
            )
          })
        })}
      </SelectContent>
    </Select>
  )
}
