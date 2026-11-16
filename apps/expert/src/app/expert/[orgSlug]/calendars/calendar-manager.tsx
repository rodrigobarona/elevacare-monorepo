"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { authClient, CALENDAR_OAUTH_SCOPES } from "@eleva/auth/client"
import { CALENDAR_REMINDER_MINUTES } from "@eleva/config/calendar-reminder"
import {
  ArrowSquareOutIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  EyeSlashIcon,
  PlusIcon,
  ShieldCheckIcon,
  WarningIcon,
} from "@eleva/icons"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { Badge } from "@eleva/ui/components/badge"
import { Button } from "@eleva/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import {
  GoogleCalendarLogo,
  OutlookLogo,
} from "@eleva/ui/components/provider-logo"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { Label } from "@eleva/ui/components/label"
import { Skeleton } from "@eleva/ui/components/skeleton"
import { Switch } from "@eleva/ui/components/switch"
import {
  disconnectCalendarAction,
  loadSubCalendars,
  saveBusySources,
  saveCalendarReminder,
  saveDestinationCalendar,
} from "./actions"
import { calendarDisplayName } from "./calendar-names"

type Provider = "google" | "microsoft"

const PROVIDERS: { provider: Provider; slug: string }[] = [
  { provider: "google", slug: "google-calendar" },
  { provider: "microsoft", slug: "microsoft-calendar" },
]

function providerForSlug(slug: string): Provider | null {
  return PROVIDERS.find((p) => p.slug === slug)?.provider ?? null
}

/**
 * Where people remove an app's access at the provider. Disconnecting in
 * Eleva stops Eleva using the connection; this removes the grant itself.
 * Microsoft keeps personal and work or school accounts in different places,
 * and the email alone can't tell them apart (a personal account can use any
 * address), so both are offered.
 */
const ACCESS_SETTINGS: Record<
  Provider,
  {
    key:
      | "disconnectRevokeLink"
      | "disconnectRevokePersonalLink"
      | "disconnectRevokeWorkLink"
    href: string
  }[]
> = {
  google: [
    {
      key: "disconnectRevokeLink",
      href: "https://myaccount.google.com/connections",
    },
  ],
  microsoft: [
    {
      key: "disconnectRevokePersonalLink",
      href: "https://account.live.com/consent/Manage",
    },
    {
      key: "disconnectRevokeWorkLink",
      href: "https://myaccount.microsoft.com/",
    },
  ],
}

/** Back from Google or Microsoft: `connected` or `failed`. */
const LINK_PARAM = "calendarLink"

/**
 * Every calendar shows, so the expert sees what is checked without opening
 * anything. Only an unusually long list folds, keeping the main calendar,
 * the ones in use and the first few others.
 */
const FOLD_ABOVE = 20
const VISIBLE_WHEN_FOLDED = 8

/** Select key for "the calendar's usual reminder" (no override sent). */
const REMINDER_DEFAULT_KEY = "default"

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
  writable: boolean
  email?: string
}

interface Props {
  integrations: CalendarIntegration[]
  callbackURL: string
  initialBusySources: BusySource[]
  initialDestination: Destination | null
  initialReminderMinutes: number | null
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

function ProviderLogo({
  provider,
  className,
}: {
  provider: Provider | null
  className?: string
}) {
  if (provider === "google") return <GoogleCalendarLogo className={className} />
  if (provider === "microsoft") return <OutlookLogo className={className} />
  return <CalendarDotsIcon aria-hidden className={className} />
}

/**
 * The address people know the account by: the email they signed in with
 * (stored when the account is linked), else the main calendar's owner, else
 * the provider's name. Older rows hold a numeric or GUID account ID.
 */
function accountLabel(
  integration: CalendarIntegration,
  calendars: SubCalendar[] | undefined
): string {
  const stored = integration.accountIdentifier
  if (stored?.includes("@")) return stored
  const main = calendars?.find((c) => c.primary)
  if (main?.email) return main.email
  if (main?.id.includes("@")) return main.id
  return integration.providerLabel
}

/** Main calendar first, then the ones in use, then the rest by name. */
function sortCalendars(
  calendars: SubCalendar[],
  inUse: (id: string) => boolean,
  nameOf: (calendar: SubCalendar) => string
): SubCalendar[] {
  const rank = (c: SubCalendar) => (c.primary ? 0 : inUse(c.id) ? 1 : 2)
  return [...calendars].sort(
    (a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b))
  )
}

export function CalendarManager({
  integrations,
  callbackURL,
  initialBusySources,
  initialDestination,
  initialReminderMinutes,
}: Props) {
  const router = useRouter()
  const t = useTranslations("calendars")
  const [pending, setPending] = React.useState<string | null>(null)
  const [reminderMinutes, setReminderMinutes] = React.useState<number | null>(
    initialReminderMinutes
  )
  // A refresh keeps client state: take the server's value when it changes
  // (another tab saved), unless a save from this tab is still in flight.
  const [serverReminder, setServerReminder] = React.useState(
    initialReminderMinutes
  )
  if (initialReminderMinutes !== serverReminder) {
    setServerReminder(initialReminderMinutes)
    if (pending !== "reminder") setReminderMinutes(initialReminderMinutes)
  }
  const [subCalendars, setSubCalendars] = React.useState<
    Record<string, SubCalendar[]>
  >({})
  const [loadErrors, setLoadErrors] = React.useState<Record<string, boolean>>(
    {}
  )
  const [loadedIds, setLoadedIds] = React.useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
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
  /** The connect dialog: which provider, or "choose" before one is picked. */
  const [connectStep, setConnectStep] = React.useState<
    Provider | "choose" | null
  >(null)
  const [disconnecting, setDisconnecting] =
    React.useState<CalendarIntegration | null>(null)
  /** Set when Google or Microsoft sends the expert back after a connect. */
  const applyDefaultsRef = React.useRef(false)

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

  // Back from Google or Microsoft: read the marker once, then drop it so a
  // refresh does not repeat the toast or the defaults.
  React.useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get(LINK_PARAM)
    if (!outcome) return
    const error = url.searchParams.get("error")
    url.searchParams.delete(LINK_PARAM)
    url.searchParams.delete("error")
    router.replace(`${url.pathname}${url.search}`)
    if (outcome === "connected") {
      applyDefaultsRef.current = true
    } else if (error === "access_denied") {
      // The expert said no at Google or Microsoft: nothing went wrong.
      toast(t("connectCancelled"))
    } else {
      toast.error(t("error.connect-failed"))
    }
  }, [router, t])

  async function persistBusy(
    integrationId: string,
    ids: Set<string>
  ): Promise<boolean> {
    const calendars = subCalendars[integrationId] ?? []
    const sources = [...ids].map((id) => ({
      externalCalendarId: id,
      displayName: calendars.find((c) => c.id === id)?.name ?? id,
    }))
    const previous = busyByIntegration[integrationId]
    setBusyByIntegration((prev) => ({ ...prev, [integrationId]: ids }))
    try {
      const result = await saveBusySources(integrationId, sources)
      if (result.ok) return true
      showError(result.error)
    } catch {
      showError("save-failed")
    }
    setBusyByIntegration((prev) => ({
      ...prev,
      [integrationId]: previous ?? new Set(),
    }))
    return false
  }

  async function persistDestination(
    integrationId: string,
    calendarId: string
  ): Promise<boolean> {
    const key = destinationKey(integrationId, calendarId)
    const previous = destination
    setDestination(key)
    try {
      const result = await saveDestinationCalendar(integrationId, calendarId)
      if (result.ok) return true
      showError(result.error)
    } catch {
      showError("save-failed")
    }
    setDestination(previous)
    return false
  }

  // Right after a connection: check the main calendar for conflicts and,
  // when no destination is set yet, send new sessions there too. Say so.
  React.useEffect(() => {
    if (!applyDefaultsRef.current) return
    const ids = connectedIds.split(",").filter(Boolean)
    if (ids.length === 0 || ids.some((id) => !loadedIds[id])) return
    applyDefaultsRef.current = false

    const fresh = ids.find(
      (id) =>
        (busyByIntegration[id]?.size ?? 0) === 0 &&
        subCalendars[id]?.some((c) => c.primary)
    )
    if (!fresh) return
    const main = subCalendars[fresh]!.find((c) => c.primary)!

    void (async () => {
      setPending("defaults")
      try {
        const busyOk = await persistBusy(fresh, new Set([main.id]))
        if (!busyOk) return
        if (destination === null && main.writable) {
          const destOk = await persistDestination(fresh, main.id)
          if (destOk) {
            toast.success(t("defaultsApplied", { calendar: nameOf(main) }))
            return
          }
        }
        toast.success(t("defaultsAppliedBusy", { calendar: nameOf(main) }))
      } finally {
        setPending(null)
      }
    })()
    // persistBusy/persistDestination read the latest state when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedIds, loadedIds, subCalendars])

  async function startConnect(provider: Provider) {
    setPending(`connect:${provider}`)
    try {
      // Better Auth redirects here from api.eleva.care after Google or
      // Microsoft, so the return address must be absolute: a relative
      // path resolves against the API host and 404s.
      const base = new URL(callbackURL, window.location.origin)
      const back = new URL(base)
      back.searchParams.set(LINK_PARAM, "connected")
      const failed = new URL(base)
      failed.searchParams.set(LINK_PARAM, "failed")
      const result = await authClient.linkSocial({
        provider,
        callbackURL: back.toString(),
        errorCallbackURL: failed.toString(),
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

  async function confirmDisconnect() {
    if (!disconnecting) return
    const id = disconnecting.id
    setPending(`disconnect:${id}`)
    try {
      const result = await disconnectCalendarAction(id)
      if (result.ok) {
        setDisconnecting(null)
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
    calendarId: string,
    selected: boolean
  ) {
    const next = new Set(busyByIntegration[integrationId] ?? [])
    if (selected) next.add(calendarId)
    else next.delete(calendarId)
    setPending(`busy:${integrationId}`)
    try {
      if (await persistBusy(integrationId, next)) {
        toast.success(t("busySaved"))
      }
    } finally {
      setPending(null)
    }
  }

  async function handleDestinationChange(key: string) {
    const parsed = parseDestinationKey(key)
    if (!parsed || key === destination) return
    setPending("destination")
    try {
      const ok = await persistDestination(
        parsed.integrationId,
        parsed.externalCalendarId
      )
      if (!ok) return
      // The calendar sessions go to always counts as busy.
      const busy = busyByIntegration[parsed.integrationId] ?? new Set()
      if (!busy.has(parsed.externalCalendarId)) {
        await persistBusy(
          parsed.integrationId,
          new Set([...busy, parsed.externalCalendarId])
        )
      }
      toast.success(t("destinationSaved"))
    } finally {
      setPending(null)
    }
  }

  async function handleReminderChange(key: string) {
    const next = key === REMINDER_DEFAULT_KEY ? null : Number(key)
    if (next === reminderMinutes) return
    const previous = reminderMinutes
    setReminderMinutes(next)
    setPending("reminder")
    try {
      const result = await saveCalendarReminder(next)
      if (result.ok) {
        toast.success(t("reminderSaved"))
        return
      }
      showError(result.error)
    } catch {
      showError("save-failed")
    } finally {
      setPending(null)
    }
    setReminderMinutes(previous)
  }

  const nameOf = (calendar: { name: string; primary: boolean }) =>
    calendarDisplayName(calendar, {
      main: t("main"),
      imported: (host) => t("imported", { host }),
      importedUnknown: t("importedUnknown"),
    })

  const isBusy = pending !== null
  const parsedDestination = destination
    ? parseDestinationKey(destination)
    : null

  const destinationGroups = integrations
    .filter((i) => i.status === "connected")
    .map((integration) => ({
      integration,
      calendars: sortCalendars(
        (subCalendars[integration.id] ?? []).filter((c) => c.writable),
        () => false,
        nameOf
      ),
    }))
    .filter((group) => group.calendars.length > 0)
  const destinationsLoading = integrations.some(
    (i) => i.status === "connected" && !loadedIds[i.id]
  )
  const disconnectingProvider = disconnecting
    ? providerForSlug(disconnecting.slug)
    : null

  if (integrations.length === 0) {
    return (
      <>
        <EmptyState
          isBusy={isBusy}
          onConnect={(provider) => setConnectStep(provider)}
        />
        <ConnectDialog
          step={connectStep}
          onStepChange={setConnectStep}
          onContinue={startConnect}
          isBusy={isBusy}
        />
      </>
    )
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="destination-title" className="space-y-3">
        <div className="space-y-1">
          <h2
            id="destination-title"
            className="font-display text-xl font-medium tracking-tight"
          >
            {t("destination.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("destination.description")}
          </p>
        </div>
        {/* What happens to a session Eleva writes: where it goes, and when
            the expert's calendar reminds them (cal.com pattern). */}
        <div className="grid gap-5 rounded-3xl border bg-card p-5 shadow-1 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            {destinationGroups.length > 0 ? (
              <Select
                placeholder={t("destination.placeholder")}
                selectedKey={destination}
                isDisabled={isBusy}
                onSelectionChange={(key) => {
                  if (typeof key === "string") void handleDestinationChange(key)
                }}
                className="w-full space-y-2"
              >
                <Label>{t("destination.calendarLabel")}</Label>
                <SelectTrigger className="h-auto min-h-9 w-full py-1.5">
                  <SelectValue className="min-w-0" />
                </SelectTrigger>
                <SelectContent>
                  {destinationGroups.map(({ integration, calendars }) => {
                    const account = accountLabel(
                      integration,
                      subCalendars[integration.id]
                    )
                    const provider = providerForSlug(integration.slug)
                    return (
                      <SelectGroup key={integration.id}>
                        <SelectLabel>{account}</SelectLabel>
                        {calendars.map((calendar) => (
                          <SelectItem
                            key={calendar.id}
                            id={destinationKey(integration.id, calendar.id)}
                            textValue={`${nameOf(calendar)} · ${account}`}
                          >
                            {/* Shown in the trigger too: the logo and account
                              say where sessions go when a name is just
                              "Calendar". */}
                            <span className="flex min-w-0 items-center gap-2.5">
                              <ProviderLogo
                                provider={provider}
                                className="size-4 shrink-0"
                              />
                              <span className="flex min-w-0 flex-col text-left leading-tight">
                                <span className="truncate">
                                  {nameOf(calendar)}
                                </span>
                                <span className="truncate text-xs font-normal text-muted-foreground">
                                  {account}
                                </span>
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
            ) : destinationsLoading ? (
              <div role="status" aria-busy="true" className="space-y-2">
                <span className="sr-only">{t("loadingCalendars")}</span>
                <p aria-hidden className="text-sm font-medium">
                  {t("destination.calendarLabel")}
                </p>
                <Skeleton className="h-9 w-full rounded-full" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("destination.none")}
              </p>
            )}
            {destinationGroups.length > 0 && destination === null ? (
              <p className="flex items-start gap-2 text-sm text-coral-900 dark:text-coral-100">
                <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t("destination.missing")}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-2">
            <Select
              selectedKey={
                reminderMinutes === null
                  ? REMINDER_DEFAULT_KEY
                  : String(reminderMinutes)
              }
              isDisabled={isBusy || destination === null}
              onSelectionChange={(key) => {
                if (typeof key === "string") void handleReminderChange(key)
              }}
              aria-describedby="reminder-help"
              className="w-full space-y-2"
            >
              <Label>{t("reminder.label")}</Label>
              <SelectTrigger className="h-auto min-h-9 w-full py-1.5">
                <SelectValue className="min-w-0 truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  id={REMINDER_DEFAULT_KEY}
                  textValue={t("reminder.default")}
                >
                  {t("reminder.default")}
                </SelectItem>
                {CALENDAR_REMINDER_MINUTES.map((minutes) => {
                  const label =
                    minutes === 0
                      ? t("reminder.atStart")
                      : minutes === 60
                        ? t("reminder.hour")
                        : t("reminder.minutes", { count: minutes })
                  return (
                    <SelectItem
                      key={minutes}
                      id={String(minutes)}
                      textValue={label}
                    >
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p id="reminder-help" className="text-xs text-muted-foreground">
              {destination === null
                ? t("reminder.needsDestination")
                : t("reminder.help")}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="conflicts-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2
              id="conflicts-title"
              className="font-display text-xl font-medium tracking-tight"
            >
              {t("conflicts.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("conflicts.description")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setConnectStep("choose")}
            isDisabled={isBusy}
          >
            <PlusIcon aria-hidden data-icon="inline-start" />
            {t("addCalendar")}
          </Button>
        </div>

        <ul className="space-y-4">
          {integrations.map((integration) => (
            <AccountCard
              key={integration.id}
              integration={integration}
              calendars={subCalendars[integration.id]}
              loaded={loadedIds[integration.id] === true}
              failed={loadErrors[integration.id] === true}
              busyIds={busyByIntegration[integration.id] ?? new Set()}
              destinationId={
                parsedDestination?.integrationId === integration.id
                  ? parsedDestination.externalCalendarId
                  : null
              }
              isExpanded={expanded[integration.id] === true}
              onToggleExpanded={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [integration.id]: !prev[integration.id],
                }))
              }
              isBusy={isBusy}
              onToggleBusy={(calendarId, selected) =>
                toggleBusy(integration.id, calendarId, selected)
              }
              onReconnect={(provider) => startConnect(provider)}
              onDisconnect={() => setDisconnecting(integration)}
            />
          ))}
        </ul>
      </section>

      <ConnectDialog
        step={connectStep}
        onStepChange={setConnectStep}
        onContinue={startConnect}
        isBusy={isBusy}
      />

      <AlertDialog
        isOpen={disconnecting !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnecting(null)
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("disconnectTitle", {
              account: disconnecting
                ? accountLabel(disconnecting, subCalendars[disconnecting.id])
                : "",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("disconnectBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        {disconnectingProvider ? (
          <p className="text-sm text-muted-foreground">
            {t("disconnectRevoke", {
              company: t(`company.${disconnectingProvider}`),
            })}{" "}
            {ACCESS_SETTINGS[disconnectingProvider].map(({ key, href }, i) => (
              <React.Fragment key={key}>
                {i > 0 ? " · " : null}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                >
                  {t(key, { company: t(`company.${disconnectingProvider}`) })}
                  <ArrowSquareOutIcon aria-hidden className="size-3.5" />
                </a>
              </React.Fragment>
            ))}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={isBusy}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={isBusy}
            onPress={confirmDisconnect}
          >
            {t("disconnect")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  )
}

function AccountCard({
  integration,
  calendars,
  loaded,
  failed,
  busyIds,
  destinationId,
  isExpanded,
  onToggleExpanded,
  isBusy,
  onToggleBusy,
  onReconnect,
  onDisconnect,
}: {
  integration: CalendarIntegration
  calendars: SubCalendar[] | undefined
  loaded: boolean
  failed: boolean
  busyIds: Set<string>
  destinationId: string | null
  isExpanded: boolean
  onToggleExpanded: () => void
  isBusy: boolean
  onToggleBusy: (calendarId: string, selected: boolean) => void
  onReconnect: (provider: Provider) => void
  onDisconnect: () => void
}) {
  const t = useTranslations("calendars")
  const provider = providerForSlug(integration.slug)
  const needsReconnect =
    integration.status === "error" || integration.status === "expired"
  const isConnected = integration.status === "connected"
  const label = accountLabel(integration, calendars)

  const nameOf = (calendar: SubCalendar) =>
    calendarDisplayName(calendar, {
      main: t("main"),
      imported: (host) => t("imported", { host }),
      importedUnknown: t("importedUnknown"),
    })
  const inUse = (id: string) => busyIds.has(id) || id === destinationId
  const sorted = sortCalendars(calendars ?? [], inUse, nameOf)
  const folded =
    sorted.length > FOLD_ABOVE
      ? sorted.filter((c, index) =>
          index < VISIBLE_WHEN_FOLDED ? true : inUse(c.id)
        )
      : sorted
  const visible = isExpanded ? sorted : folded
  const hiddenCount = sorted.length - folded.length
  const nameCounts = new Map<string, number>()
  for (const c of sorted) {
    const name = nameOf(c)
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  const main = sorted.find((c) => c.primary)
  const checkedCount = sorted.filter((c) => inUse(c.id)).length

  return (
    <li className="space-y-4 rounded-3xl border bg-card p-5 shadow-1">
      {/* No wrap: on phones the email truncates and Disconnect stays put. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl border bg-background"
          >
            <ProviderLogo provider={provider} className="size-5" />
          </span>
          {/* Provider first, account second (cal.com): the email is said
              once here, so the rows below can just say "Main calendar". */}
          <div className="min-w-0">
            <p className="truncate font-medium">{integration.providerLabel}</p>
            {/* Two lines on phones, one on wider screens, so the checking
                count is never cut off by a long email. */}
            <p className="flex flex-col text-sm text-muted-foreground sm:flex-row sm:gap-1">
              {label === integration.providerLabel ? null : (
                // Wraps instead of truncating: the email is how the expert
                // tells two accounts apart.
                <span className="break-words">{label}</span>
              )}
              {isConnected && loaded && !failed ? (
                <span className="whitespace-nowrap">
                  {label === integration.providerLabel ? null : (
                    <span aria-hidden className="hidden sm:inline">
                      ·{" "}
                    </span>
                  )}
                  {t("checkingCount", { count: checkedCount })}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {/* On phones Disconnect sits at the foot of the card, so the email
            keeps the full width. */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden shrink-0 sm:inline-flex"
          onPress={onDisconnect}
          isDisabled={isBusy}
        >
          {t("disconnect")}
        </Button>
      </div>

      {needsReconnect ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral-200 bg-coral-50 p-4 text-sm text-coral-900 dark:border-coral-900 dark:bg-coral-950/40 dark:text-coral-100"
        >
          <p className="flex items-start gap-2">
            <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("needsAttention")}
          </p>
          {provider ? (
            <Button
              size="sm"
              onPress={() => onReconnect(provider)}
              isDisabled={isBusy}
            >
              {t("reconnect")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isConnected ? (
        failed ? (
          <p className="text-sm text-muted-foreground">
            {t("error.load-failed")}
          </p>
        ) : !loaded ? (
          <CalendarRowsSkeleton label={t("loadingCalendars")} />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSubCalendars")}</p>
        ) : (
          <div className="space-y-3">
            {checkedCount === 0 && main ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-coral-50 p-4 text-sm text-coral-900 dark:bg-coral-950/40 dark:text-coral-100">
                <p className="flex items-start gap-2">
                  <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {t("noneChecked")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => onToggleBusy(main.id, true)}
                  isDisabled={isBusy}
                >
                  {t("checkMain", { calendar: nameOf(main) })}
                </Button>
              </div>
            ) : null}
            <ul className="divide-y rounded-2xl bg-sand-50 dark:bg-muted/40">
              {visible.map((calendar) => {
                const isDestination = calendar.id === destinationId
                const name = nameOf(calendar)
                const duplicate = (nameCounts.get(name) ?? 0) > 1
                const detail = duplicate
                  ? (calendar.email ?? calendar.id)
                  : null
                return (
                  <li key={calendar.id} className="px-4 py-3">
                    {/* The switch is the track only; the name sits beside it
                        and labels it, so long names never squeeze the toggle. */}
                    <div className="flex items-start gap-3">
                      {/* Where sessions go always counts as busy: shown on
                          (read-only, full colour), not greyed out. */}
                      <Switch
                        size="sm"
                        isSelected={isDestination || busyIds.has(calendar.id)}
                        isReadOnly={isDestination}
                        isDisabled={isBusy && !isDestination}
                        onChange={(selected) =>
                          onToggleBusy(calendar.id, selected)
                        }
                        aria-labelledby={`cal-${integration.id}-${calendar.id}`}
                        aria-describedby={
                          isDestination ? `locked-${integration.id}` : undefined
                        }
                        className="mt-0.5 data-readonly:cursor-default data-disabled:cursor-default"
                      />
                      <span
                        id={`cal-${integration.id}-${calendar.id}`}
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
                      >
                        <span className="truncate text-sm font-medium">
                          {name}
                        </span>
                        {isDestination ? (
                          <Badge
                            variant="outline"
                            className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100"
                          >
                            <CalendarCheckIcon aria-hidden />
                            {/* Icon only on phones, so the row stays one
                                line; screen readers still hear the words. */}
                            <span className="sr-only sm:not-sr-only">
                              {t("sessionsHere")}
                            </span>
                          </Badge>
                        ) : null}
                        {detail ? (
                          <span className="w-full truncate text-xs text-muted-foreground">
                            {detail}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {isDestination ? (
                      <span id={`locked-${integration.id}`} className="sr-only">
                        {t("destination.locked")}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {hiddenCount > 0 ? (
              <Button variant="ghost" size="sm" onPress={onToggleExpanded}>
                {isExpanded
                  ? t("showFewer")
                  : t("showMore", { count: hiddenCount })}
              </Button>
            ) : null}
          </div>
        )
      ) : null}

      {provider ? (
        <details className="group rounded-2xl text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground hover:text-foreground">
            <ShieldCheckIcon aria-hidden className="size-4" />
            {t("accessTitle")}
          </summary>
          <AccessList provider={provider} className="mt-3 pl-6" />
        </details>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 sm:hidden"
        onPress={onDisconnect}
        isDisabled={isBusy}
      >
        {t("disconnect")}
      </Button>
    </li>
  )
}

/** Placeholder rows in the shape of the real list, so nothing jumps. */
function CalendarRowsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <ul
        aria-hidden
        className="divide-y rounded-2xl bg-sand-50 dark:bg-muted/40"
      >
        {["w-40", "w-28"].map((width) => (
          <li key={width} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-7 rounded-full" />
            <span className="flex h-5 items-center">
              <Skeleton className={`h-3.5 rounded-full ${width}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AccessList({
  provider,
  className,
}: {
  provider: Provider
  className?: string
}) {
  const t = useTranslations("calendars")
  const keys = ["list", "busy", "sessions"] as const
  const privateKeys = ["email", "events", "members"] as const
  return (
    <div className={className}>
      <ul className="space-y-2">
        {keys.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <CalendarCheckIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300"
            />
            <span>{t(`access.${provider}.${key}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-medium">{t("private.title")}</p>
      <ul className="mt-2 space-y-2">
        {privateKeys.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <EyeSlashIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span>{t(`private.${key}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-muted-foreground">{t("access.control")}</p>
    </div>
  )
}

function ConnectDialog({
  step,
  onStepChange,
  onContinue,
  isBusy,
}: {
  step: Provider | "choose" | null
  onStepChange: (step: Provider | "choose" | null) => void
  onContinue: (provider: Provider) => void
  isBusy: boolean
}) {
  const t = useTranslations("calendars")
  return (
    <Dialog
      isOpen={step !== null}
      onOpenChange={(open) => {
        if (!open) onStepChange(null)
      }}
    >
      {step === "choose" ? (
        <>
          <DialogHeader>
            <DialogTitle>{t("connect.chooseTitle")}</DialogTitle>
            <DialogDescription>
              {t("connect.chooseDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {PROVIDERS.map(({ provider }) => (
              <Button
                key={provider}
                variant="outline"
                className="h-auto justify-start gap-3 py-3"
                onPress={() => onStepChange(provider)}
              >
                <ProviderLogo provider={provider} className="size-5" />
                {t(`provider.${provider}`)}
              </Button>
            ))}
          </div>
        </>
      ) : step ? (
        <>
          <DialogHeader>
            <span
              aria-hidden
              className="mb-2 flex size-12 items-center justify-center rounded-2xl border bg-background"
            >
              <ProviderLogo provider={step} className="size-6" />
            </span>
            <DialogTitle>
              {t("connect.title", { provider: t(`provider.${step}`) })}
            </DialogTitle>
            <DialogDescription>
              {t("connect.intro", { company: t(`company.${step}`) })}
            </DialogDescription>
          </DialogHeader>
          <AccessList provider={step} />
          <DialogFooter>
            <Button
              variant="outline"
              onPress={() => onStepChange(null)}
              isDisabled={isBusy}
            >
              {t("cancel")}
            </Button>
            <Button onPress={() => onContinue(step)} isPending={isBusy}>
              {t("connect.continue", { company: t(`company.${step}`) })}
            </Button>
          </DialogFooter>
        </>
      ) : null}
    </Dialog>
  )
}

function EmptyState({
  isBusy,
  onConnect,
}: {
  isBusy: boolean
  onConnect: (provider: Provider) => void
}) {
  const t = useTranslations("calendars")
  const jobs = [
    { key: "busy", Icon: CalendarDotsIcon },
    { key: "sessions", Icon: CalendarCheckIcon },
  ] as const
  return (
    <section
      data-testid="calendars-empty"
      aria-labelledby="empty-title"
      className="space-y-6 rounded-3xl border bg-card p-6 shadow-1"
    >
      <div className="space-y-1">
        <h2
          id="empty-title"
          className="font-display text-xl font-medium tracking-tight"
        >
          {t("empty.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("empty.body")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {jobs.map(({ key, Icon }) => (
          <li
            key={key}
            className="space-y-1 rounded-2xl bg-sand-50 p-4 dark:bg-muted/40"
          >
            <p className="flex items-center gap-2 font-medium">
              <Icon
                aria-hidden
                className="size-5 text-teal-700 dark:text-teal-300"
              />
              {t(`empty.${key}Title`)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`empty.${key}Body`)}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {PROVIDERS.map(({ provider }) => (
          <Button
            key={provider}
            variant="outline"
            onPress={() => onConnect(provider)}
            isDisabled={isBusy}
          >
            <ProviderLogo provider={provider} className="size-4" />
            {t("connectProvider", { provider: t(`provider.${provider}`) })}
          </Button>
        ))}
      </div>
    </section>
  )
}
