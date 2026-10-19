"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { authClient, CALENDAR_OAUTH_SCOPES } from "@eleva/auth/client"
import { CalendarDotsIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { RadioGroup, RadioGroupItem } from "@eleva/ui/components/radio-group"
import { StatusPill } from "@eleva/ui/components/status-pill"
import type { StatusTone } from "@eleva/ui/components/status-pill"
import {
  disconnectCalendarAction,
  loadSubCalendars,
  saveBusySources,
  saveDestinationCalendar,
} from "./actions"

const STATUS_TONE: Record<string, StatusTone> = {
  connected: "positive",
  connecting: "neutral",
  disconnected: "neutral",
  error: "attention",
  expired: "attention",
}

const PROVIDERS = [
  { provider: "google", slug: "google-calendar", name: "Google Calendar" },
  {
    provider: "microsoft",
    slug: "microsoft-calendar",
    name: "Microsoft Calendar",
  },
] as const

interface CalendarIntegration {
  id: string
  slug: string
  providerLabel: string
  accountIdentifier: string | null
  status: string
}

interface BusySource {
  expertIntegrationId: string
  externalCalendarId: string
  displayName: string
}

interface Destination {
  expertIntegrationId: string
  externalCalendarId: string
  displayName: string
}

interface SubCalendar {
  id: string
  name: string
  primary: boolean
  email?: string
}

interface Props {
  integrations: CalendarIntegration[]
  callbackURL: string
  initialBusySources: BusySource[]
  initialDestination: Destination | null
}

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

export function CalendarManager({
  integrations,
  callbackURL,
  initialBusySources,
  initialDestination,
}: Props) {
  const router = useRouter()
  const t = useTranslations("calendars")
  const [pending, setPending] = React.useState<string | null>(null)
  const [subCalendars, setSubCalendars] = React.useState<
    Record<string, SubCalendar[]>
  >({})
  const [loadErrors, setLoadErrors] = React.useState<Record<string, boolean>>(
    {}
  )
  const [loadedIds, setLoadedIds] = React.useState<Record<string, boolean>>({})
  const [busyByIntegration, setBusyByIntegration] = React.useState(() => {
    const map: Record<string, Set<string>> = {}
    for (const source of initialBusySources) {
      if (!map[source.expertIntegrationId]) {
        map[source.expertIntegrationId] = new Set()
      }
      map[source.expertIntegrationId]!.add(source.externalCalendarId)
    }
    return map
  })
  const [destination, setDestination] = React.useState<string | null>(
    initialDestination
      ? destinationKey(
          initialDestination.expertIntegrationId,
          initialDestination.externalCalendarId
        )
      : null
  )

  const connectedIds = integrations
    .filter((i) => i.status === "connected")
    .map((i) => i.id)
    .join(",")

  React.useEffect(() => {
    const ids = connectedIds.split(",").filter(Boolean)
    if (ids.length === 0) return

    let cancelled = false

    async function loadAll() {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return { id, result: await loadSubCalendars(id) }
          } catch {
            return {
              id,
              result: { ok: false as const, error: "load-failed" },
            }
          }
        })
      )
      if (cancelled) return

      const next: Record<string, SubCalendar[]> = {}
      const errors: Record<string, boolean> = {}
      const loaded: Record<string, boolean> = {}
      for (const { id, result } of results) {
        loaded[id] = true
        if (result.ok) {
          next[id] = result.calendars
          errors[id] = false
        } else {
          errors[id] = true
        }
      }
      setSubCalendars((prev) => ({ ...prev, ...next }))
      setLoadErrors((prev) => ({ ...prev, ...errors }))
      setLoadedIds((prev) => ({ ...prev, ...loaded }))
    }

    void loadAll()
    return () => {
      cancelled = true
    }
  }, [connectedIds])

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

  async function toggleBusy(
    integrationId: string,
    calendar: SubCalendar,
    selected: boolean
  ) {
    const current = new Set(busyByIntegration[integrationId] ?? [])
    if (selected) {
      current.add(calendar.id)
    } else {
      current.delete(calendar.id)
    }

    const calendars = subCalendars[integrationId] ?? []
    const sources = [...current].map((id) => {
      const match = calendars.find((c) => c.id === id)
      return {
        externalCalendarId: id,
        displayName: match?.name ?? id,
      }
    })

    const previous = busyByIntegration[integrationId]
    setBusyByIntegration((prev) => ({
      ...prev,
      [integrationId]: current,
    }))
    setPending(`busy:${integrationId}`)

    try {
      const result = await saveBusySources(integrationId, sources)
      if (!result.ok) {
        setBusyByIntegration((prev) => ({
          ...prev,
          [integrationId]: previous ?? new Set(),
        }))
        showError(result.error)
        return
      }
      toast.success(t("busySaved"))
    } catch {
      setBusyByIntegration((prev) => ({
        ...prev,
        [integrationId]: previous ?? new Set(),
      }))
      showError("save-failed")
    } finally {
      setPending(null)
    }
  }

  async function handleDestinationChange(key: string) {
    const parsed = parseDestinationKey(key)
    if (!parsed) return

    const previous = destination
    setDestination(key)
    setPending(`dest:${key}`)
    try {
      const result = await saveDestinationCalendar(
        parsed.integrationId,
        parsed.externalCalendarId
      )
      if (!result.ok) {
        setDestination(previous)
        showError(result.error)
        return
      }
      toast.success(t("destinationSaved"))
    } catch {
      setDestination(previous)
      showError("save-failed")
    } finally {
      setPending(null)
    }
  }

  const hasConnectedCalendar = integrations.some(
    (i) => i.status === "connected"
  )
  const connectedSlugs = new Set(integrations.map((i) => i.slug))
  const needsReconnect = integrations.some(
    (i) => i.status === "error" || i.status === "expired"
  )

  return (
    <div className="space-y-8">
      {!hasConnectedCalendar ? (
        <p className="flex items-start gap-3 rounded-3xl bg-sand-100 p-5 text-sm text-muted-foreground dark:bg-muted/40">
          <CalendarDotsIcon
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-teal-700 dark:text-teal-300"
          />
          {t("noCalendarFallback")}
        </p>
      ) : null}

      {needsReconnect ? (
        <p
          role="status"
          className="rounded-3xl border border-coral-200 bg-coral-50 p-5 text-sm text-coral-900 dark:border-coral-900 dark:bg-coral-950/40 dark:text-coral-100"
        >
          {t("reconnectBanner")}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-medium tracking-tight">
            {t("connectTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("connectDescription")}
          </p>
        </div>
        <ul className="divide-y rounded-3xl border bg-card shadow-1">
          {PROVIDERS.map((item) => {
            const isLinked = connectedSlugs.has(item.slug)
            return (
              <li
                key={item.provider}
                className="flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200"
                  >
                    <CalendarDotsIcon className="size-5" />
                  </span>
                  <span className="font-medium">{item.name}</span>
                </div>
                <Button
                  variant={isLinked ? "outline" : "default"}
                  size="sm"
                  onPress={() => handleConnect(item.provider)}
                  isDisabled={pending !== null}
                >
                  {item.provider === "google"
                    ? isLinked
                      ? t("reconnectGoogle")
                      : t("connectGoogle")
                    : isLinked
                      ? t("reconnectMicrosoft")
                      : t("connectMicrosoft")}
                </Button>
              </li>
            )
          })}
        </ul>
      </section>

      {integrations.length > 0 ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-medium tracking-tight">
              {t("connectedTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("configureHint")}
            </p>
          </div>
          <RadioGroup
            value={destination}
            onChange={handleDestinationChange}
            aria-label={t("destinationLabel")}
            isDisabled={pending !== null}
            className="gap-4"
          >
            {integrations.map((cal) => {
              const calendars = subCalendars[cal.id] ?? []
              const busyIds = busyByIntegration[cal.id] ?? new Set()
              const canConfigure = cal.status === "connected"
              const failed = loadErrors[cal.id] === true
              const loaded = loadedIds[cal.id] === true

              return (
                <div
                  key={cal.id}
                  className="space-y-4 rounded-3xl border bg-card p-5 shadow-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">{cal.providerLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cal.accountIdentifier ?? ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={STATUS_TONE[cal.status] ?? "neutral"}>
                        {t(`status.${cal.status}` as Parameters<typeof t>[0])}
                      </StatusPill>
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

                  {canConfigure ? (
                    failed ? (
                      <p className="text-sm text-muted-foreground">
                        {t("error.load-failed")}
                      </p>
                    ) : !loaded ? (
                      <p className="text-sm text-muted-foreground">
                        {t("loadingCalendars")}
                      </p>
                    ) : calendars.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("noSubCalendars")}
                      </p>
                    ) : (
                      <ul className="divide-y rounded-2xl bg-sand-50 dark:bg-muted/40">
                        {calendars.map((sub) => {
                          const key = destinationKey(cal.id, sub.id)
                          return (
                            <li
                              key={sub.id}
                              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {sub.name}
                                  {sub.primary ? (
                                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                                      ({t("primary")})
                                    </span>
                                  ) : null}
                                </p>
                                {sub.email ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {sub.email}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-4">
                                <CheckboxField
                                  id={`busy-${cal.id}-${sub.id}`}
                                  label={t("useForBusy")}
                                  isSelected={busyIds.has(sub.id)}
                                  isDisabled={pending !== null}
                                  onChange={(selected) =>
                                    toggleBusy(cal.id, sub, selected)
                                  }
                                />
                                <RadioGroupItem
                                  value={key}
                                  className="flex aspect-auto size-auto w-auto items-center gap-2 rounded-md border-0 bg-transparent p-0 text-sm text-foreground after:hidden data-selected:bg-transparent data-selected:text-foreground"
                                >
                                  {t("useAsDestination")}
                                </RadioGroupItem>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )
                  ) : null}
                </div>
              )
            })}
          </RadioGroup>
        </section>
      ) : null}
    </div>
  )
}
