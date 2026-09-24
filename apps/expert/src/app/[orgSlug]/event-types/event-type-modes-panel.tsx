"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Badge } from "@eleva/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import type {
  CreateEventTypeModeRequest,
  PatchEventTypeModeRequest,
} from "@eleva/api-client"
import {
  createEventTypeModeAction,
  patchEventTypeModeAction,
  deactivateEventTypeModeAction,
  createNamedScheduleAction,
  createInlineLocationAction,
} from "./mode-actions"
import {
  DestinationOverrideSelect,
  type CalendarIntegrationOption,
  type SubCalendarOption,
} from "./destination-override-select"
import { loadSubCalendars } from "../calendars/actions"
import { defaultTimezoneForCountry, euCountriesInService } from "@eleva/config"

export type ModeRow = {
  id: string
  mode: "online" | "phone" | "in_person"
  locationId: string | null
  scheduleId: string
  priceCents: number | null
  currency: string | null
  durationMinutes: number | null
  countryScopeType: "worldwide" | "list"
  countryScopeCodes: string[]
  languages: string[]
  label: { en: string; pt?: string; es?: string } | null
  active: boolean
  destinationIntegrationId: string | null
  destinationExternalCalendarId: string | null
}

export type ScheduleOption = { id: string; name: string; isDefault: boolean }
export type LocationOption = {
  id: string
  label: string
  country: string
  active: boolean
}

type SessionMode = ModeRow["mode"]
const SESSION_MODES: readonly SessionMode[] = ["online", "phone", "in_person"]

function isSessionMode(value: unknown): value is SessionMode {
  return (
    typeof value === "string" &&
    (SESSION_MODES as readonly string[]).includes(value)
  )
}

interface Props {
  eventTypeId: string
  modes: ModeRow[]
  schedules: ScheduleOption[]
  locations: LocationOption[]
  profileLanguages: string[]
  serviceCountries: string[]
  worldwideRemote: boolean
  eventTypeKind: "clinical" | "non_clinical"
  defaultTimezone: string
  integrations: CalendarIntegrationOption[]
  eventTypeDestination: {
    destinationIntegrationId: string | null
    destinationExternalCalendarId: string | null
  }
}

export function EventTypeModesPanel({
  eventTypeId,
  modes: initialModes,
  schedules,
  locations,
  profileLanguages,
  serviceCountries,
  worldwideRemote,
  eventTypeKind,
  defaultTimezone,
  integrations,
  eventTypeDestination,
}: Props) {
  const t = useTranslations("eventTypes.modes")
  const tDest = useTranslations("eventTypes.destination")
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(initialModes.length === 0)
  const [editingModeId, setEditingModeId] = React.useState<string | null>(null)

  const defaultScheduleId =
    schedules.find((s) => s.isDefault)?.id ?? schedules[0]?.id ?? ""

  const [mode, setMode] = React.useState<SessionMode>("online")
  const [scheduleId, setScheduleId] = React.useState(defaultScheduleId)
  const [locationId, setLocationId] = React.useState("")
  const [languages, setLanguages] = React.useState<string[]>(
    profileLanguages.slice(0, 1)
  )
  const [worldwide, setWorldwide] = React.useState(false)
  const [countryCodes, setCountryCodes] = React.useState<string[]>(
    serviceCountries.slice(0, 1)
  )
  const [priceOverride, setPriceOverride] = React.useState("")
  const [labelEn, setLabelEn] = React.useState("")
  const [showNewSchedule, setShowNewSchedule] = React.useState(false)
  const [newScheduleName, setNewScheduleName] = React.useState("")
  const [newScheduleTz, setNewScheduleTz] = React.useState(defaultTimezone)
  const [showNewLocation, setShowNewLocation] = React.useState(false)
  const [newLocName, setNewLocName] = React.useState("")
  const [newLocAddress, setNewLocAddress] = React.useState("")
  const [newLocCity, setNewLocCity] = React.useState("")
  const [newLocCountry, setNewLocCountry] = React.useState(
    serviceCountries[0] ?? "PT"
  )
  const [newLocTimezone, setNewLocTimezone] = React.useState(() =>
    defaultTimezoneForCountry(serviceCountries[0] ?? "PT", defaultTimezone)
  )

  const activeModes = initialModes.filter((m) => m.active)
  const euPresetCountries = euCountriesInService(serviceCountries)
  const canUseWorldwide =
    eventTypeKind === "non_clinical" && worldwideRemote && mode !== "in_person"
  const isEditing = editingModeId != null

  const integrationIdsKey = integrations.map((i) => i.id).join(",")
  const [subCalendarsByIntegration, setSubCalendarsByIntegration] =
    React.useState<Record<string, SubCalendarOption[]>>({})

  React.useEffect(() => {
    let cancelled = false
    const ids = integrationIdsKey ? integrationIdsKey.split(",") : []
    async function load() {
      const next: Record<string, SubCalendarOption[]> = {}
      await Promise.all(
        ids.map(async (id) => {
          const result = await loadSubCalendars(id)
          if (result.ok) {
            next[id] = result.calendars
          }
        })
      )
      if (!cancelled) setSubCalendarsByIntegration(next)
    }
    if (ids.length > 0) {
      void load()
    } else {
      setSubCalendarsByIntegration({})
    }
    return () => {
      cancelled = true
    }
  }, [integrationIdsKey])

  const MODE_ERROR_KEYS = [
    "create-failed",
    "update-failed",
    "mode-taken",
    "invalid-input",
    "validation",
    "offer-invariant",
  ] as const

  function formatModeError(code: string, message?: string): string {
    if (code === "offer-invariant" && message && message.trim().length > 0) {
      return message
    }
    if ((MODE_ERROR_KEYS as readonly string[]).includes(code)) {
      return t(`error.${code}` as Parameters<typeof t>[0])
    }
    return t("error.generic")
  }

  function resetFormFields(nextMode: SessionMode = "online") {
    setMode(nextMode)
    setScheduleId(defaultScheduleId)
    setLocationId("")
    setLanguages(profileLanguages.slice(0, 1))
    setWorldwide(false)
    setCountryCodes(serviceCountries.slice(0, 1))
    setPriceOverride("")
    setLabelEn("")
  }

  function startCreate() {
    setEditingModeId(null)
    resetFormFields("online")
    setError(null)
    setShowForm(true)
  }

  function startEdit(row: ModeRow) {
    setEditingModeId(row.id)
    setMode(row.mode)
    setScheduleId(row.scheduleId)
    setLocationId(row.locationId ?? "")
    setLanguages(
      row.languages.length > 0 ? row.languages : profileLanguages.slice(0, 1)
    )
    setWorldwide(row.countryScopeType === "worldwide")
    const editableCountries = row.countryScopeCodes.filter((c) =>
      serviceCountries.includes(c)
    )
    setCountryCodes(
      editableCountries.length > 0
        ? editableCountries
        : serviceCountries.slice(0, 1)
    )
    setPriceOverride(
      row.priceCents != null ? (row.priceCents / 100).toFixed(2) : ""
    )
    setLabelEn(row.label?.en ?? "")
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingModeId(null)
    resetFormFields()
    setError(null)
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    )
  }

  function toggleCountry(code: string) {
    setCountryCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  function applyCountryPreset(preset: "all" | "portugal" | "eu") {
    if (preset === "all") {
      setCountryCodes([...serviceCountries])
      return
    }
    if (preset === "portugal") {
      setCountryCodes(serviceCountries.filter((c) => c === "PT"))
      return
    }
    setCountryCodes(euPresetCountries)
  }

  async function handleCreateSchedule() {
    setPending(true)
    setError(null)
    try {
      const result = await createNamedScheduleAction({
        name: newScheduleName.trim(),
        timezone: newScheduleTz.trim() || defaultTimezone,
      })
      if (!result.ok) {
        setError(result.message ?? formatModeError(result.error))
        return
      }
      setScheduleId(result.id)
      setNewScheduleName("")
      setShowNewSchedule(false)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message
          : formatModeError("create-failed")
      )
    } finally {
      setPending(false)
    }
  }

  async function handleCreateLocation() {
    setPending(true)
    setError(null)
    try {
      const result = await createInlineLocationAction({
        name: newLocName.trim(),
        address: newLocAddress.trim(),
        city: newLocCity.trim(),
        country: newLocCountry,
        timezone:
          newLocTimezone.trim() ||
          defaultTimezoneForCountry(newLocCountry, defaultTimezone),
      })
      if (!result.ok) {
        setError(result.message ?? formatModeError(result.error))
        return
      }
      setLocationId(result.id)
      if (result.country) setCountryCodes([result.country])
      setNewLocName("")
      setNewLocAddress("")
      setNewLocCity("")
      setShowNewLocation(false)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message
          : formatModeError("create-failed")
      )
    } finally {
      setPending(false)
    }
  }

  function onInlineScheduleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return
    e.preventDefault()
    e.stopPropagation()
    if (!pending && newScheduleName.trim()) void handleCreateSchedule()
  }

  function onInlineLocationKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return
    e.preventDefault()
    e.stopPropagation()
    if (
      !pending &&
      newLocName.trim() &&
      newLocAddress.trim() &&
      newLocCity.trim()
    ) {
      void handleCreateLocation()
    }
  }

  function buildSharedFields(): {
    scheduleId: string
    locationId: string | null
    languages: string[]
    countryScopeType: "worldwide" | "list"
    countryScopeCodes: string[]
    priceCents: number | null
    currency: "EUR" | null
  } {
    const priceCents =
      priceOverride.trim() === ""
        ? null
        : Math.round(Number(priceOverride) * 100)
    const validPrice =
      priceCents != null && !Number.isNaN(priceCents) ? priceCents : null

    return {
      scheduleId,
      locationId: mode === "in_person" ? locationId || null : null,
      languages:
        languages.length > 0 ? languages : profileLanguages.slice(0, 1),
      countryScopeType: worldwide && canUseWorldwide ? "worldwide" : "list",
      countryScopeCodes:
        worldwide && canUseWorldwide
          ? []
          : countryCodes.length > 0
            ? countryCodes
            : serviceCountries.slice(0, 1),
      priceCents: validPrice,
      currency: validPrice == null ? null : ("EUR" as const),
    }
  }

  function resolveCreateLabel(): {
    en: string
    pt?: string
    es?: string
  } | null {
    const en = labelEn.trim()
    return en ? { en } : null
  }

  function resolvePatchLabel(
    existing: ModeRow["label"]
  ): { en: string; pt?: string; es?: string } | null | undefined {
    const en = labelEn.trim()
    const previousEn = existing?.en?.trim() ?? ""
    if (en === previousEn) {
      // Unchanged — omit from PATCH so pt/es JSONB keys are preserved.
      return undefined
    }
    if (!en) return null
    return { ...(existing ?? {}), en }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    try {
      const shared = buildSharedFields()

      if (isEditing && editingModeId) {
        const existing =
          initialModes.find((m) => m.id === editingModeId)?.label ?? null
        const label = resolvePatchLabel(existing)
        const payload: PatchEventTypeModeRequest = { ...shared }
        if (label !== undefined) payload.label = label
        const result = await patchEventTypeModeAction(
          eventTypeId,
          editingModeId,
          payload
        )
        if (!result.ok) {
          setError(formatModeError(result.error, result.message))
          return
        }
      } else {
        const payload: CreateEventTypeModeRequest = {
          mode,
          ...shared,
          label: resolveCreateLabel(),
        }
        const result = await createEventTypeModeAction(eventTypeId, payload)
        if (!result.ok) {
          setError(formatModeError(result.error, result.message))
          return
        }
      }

      cancelForm()
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function handleDeactivate(modeId: string) {
    setPending(true)
    setError(null)
    try {
      const result = await deactivateEventTypeModeAction(eventTypeId, modeId)
      if (!result.ok) {
        setError(formatModeError(result.error, result.message))
        return
      }
      if (editingModeId === modeId) cancelForm()
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (schedules.length === 0) {
    return (
      <Card data-testid="event-type-modes">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("needSchedule")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive" data-testid="mode-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div
            className="space-y-2 rounded-md border p-3"
            data-testid="mode-new-schedule-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-schedule-name-empty">
                {t("fields.scheduleName")}
              </Label>
              <Input
                id="new-schedule-name-empty"
                value={newScheduleName}
                onChange={(e) => setNewScheduleName(e.target.value)}
                onKeyDown={onInlineScheduleKeyDown}
                placeholder={t("scheduleNamePlaceholder")}
                data-testid="new-schedule-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-schedule-tz-empty">
                {t("fields.timezone")}
              </Label>
              <Input
                id="new-schedule-tz-empty"
                value={newScheduleTz}
                onChange={(e) => setNewScheduleTz(e.target.value)}
                onKeyDown={onInlineScheduleKeyDown}
                data-testid="new-schedule-tz"
              />
            </div>
            <Button
              size="sm"
              isDisabled={pending || !newScheduleName.trim()}
              onPress={() => void handleCreateSchedule()}
              data-testid="save-new-schedule"
            >
              {t("saveSchedule")}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="event-type-modes">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        {!showForm ? (
          <Button
            variant="outline"
            onPress={startCreate}
            isDisabled={pending}
            data-testid="add-delivery-mode"
          >
            {t("add")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive" data-testid="mode-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            {tDest("eventTypeHint")}
          </p>
          <DestinationOverrideSelect
            eventTypeId={eventTypeId}
            integrations={integrations}
            subCalendarsByIntegration={subCalendarsByIntegration}
            value={eventTypeDestination}
            inheritLabel={tDest("inheritDefault")}
            testId="event-type-destination"
          />
        </div>

        {activeModes.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}

        <ul className="space-y-3" data-testid="mode-list">
          {activeModes.map((row) => {
            const location = locations.find((l) => l.id === row.locationId)
            const schedule = schedules.find((s) => s.id === row.scheduleId)
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                data-testid={`mode-row-${row.mode}`}
                data-mode-id={row.id}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{t(`kinds.${row.mode}`)}</Badge>
                    {row.label?.en ? (
                      <span className="text-sm font-medium">
                        {row.label.en}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {schedule?.name ?? t("unknownSchedule")}
                    {location ? ` · ${location.label}` : null}
                    {" · "}
                    {row.countryScopeType === "worldwide"
                      ? t("worldwide")
                      : row.countryScopeCodes.join(", ")}
                    {" · "}
                    {row.languages.join(", ").toUpperCase()}
                    {row.priceCents != null
                      ? ` · €${(row.priceCents / 100).toFixed(2)}`
                      : null}
                  </p>
                  <div className="max-w-md pt-2">
                    <DestinationOverrideSelect
                      eventTypeId={eventTypeId}
                      modeId={row.id}
                      integrations={integrations}
                      subCalendarsByIntegration={subCalendarsByIntegration}
                      value={{
                        destinationIntegrationId: row.destinationIntegrationId,
                        destinationExternalCalendarId:
                          row.destinationExternalCalendarId,
                      }}
                      inheritLabel={tDest("inheritEventType")}
                      testId={`mode-destination-${row.id}`}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={pending}
                    onPress={() => startEdit(row)}
                    data-testid={`edit-mode-${row.id}`}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={pending}
                    onPress={() => handleDeactivate(row.id)}
                    data-testid={`deactivate-mode-${row.id}`}
                  >
                    {t("deactivate")}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>

        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-md border p-4"
            data-testid="mode-form"
            data-editing={isEditing ? editingModeId : undefined}
          >
            {isEditing ? (
              <p className="text-sm text-muted-foreground">
                {t("editingHint")}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Select
                selectedKey={mode}
                isDisabled={isEditing}
                onSelectionChange={(key) => {
                  if (isSessionMode(key)) {
                    setMode(key)
                    if (key === "in_person") setWorldwide(false)
                  }
                }}
              >
                <Label>{t("fields.mode")}</Label>
                <SelectTrigger data-testid="mode-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    id="online"
                    textValue={t("kinds.online")}
                    data-testid="mode-kind-online"
                  >
                    {t("kinds.online")}
                  </SelectItem>
                  <SelectItem
                    id="phone"
                    textValue={t("kinds.phone")}
                    data-testid="mode-kind-phone"
                  >
                    {t("kinds.phone")}
                  </SelectItem>
                  <SelectItem
                    id="in_person"
                    textValue={t("kinds.in_person")}
                    data-testid="mode-kind-in-person"
                  >
                    {t("kinds.in_person")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Select
                selectedKey={scheduleId}
                onSelectionChange={(key) => {
                  if (typeof key === "string") setScheduleId(key)
                }}
              >
                <Label>{t("fields.schedule")}</Label>
                <SelectTrigger data-testid="mode-schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schedules.map((s) => (
                    <SelectItem key={s.id} id={s.id} textValue={s.name}>
                      {s.name}
                      {s.isDefault ? ` (${t("defaultSchedule")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!showNewSchedule ? (
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={pending}
                  onPress={() => setShowNewSchedule(true)}
                  data-testid="mode-new-schedule"
                >
                  {t("newSchedule")}
                </Button>
              ) : (
                <div
                  className="space-y-2 rounded-md border p-3"
                  data-testid="mode-new-schedule-form"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="new-schedule-name">
                      {t("fields.scheduleName")}
                    </Label>
                    <Input
                      id="new-schedule-name"
                      value={newScheduleName}
                      onChange={(e) => setNewScheduleName(e.target.value)}
                      onKeyDown={onInlineScheduleKeyDown}
                      placeholder={t("scheduleNamePlaceholder")}
                      data-testid="new-schedule-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-schedule-tz">
                      {t("fields.timezone")}
                    </Label>
                    <Input
                      id="new-schedule-tz"
                      value={newScheduleTz}
                      onChange={(e) => setNewScheduleTz(e.target.value)}
                      onKeyDown={onInlineScheduleKeyDown}
                      data-testid="new-schedule-tz"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      isDisabled={pending || !newScheduleName.trim()}
                      onPress={() => void handleCreateSchedule()}
                      data-testid="save-new-schedule"
                    >
                      {t("saveSchedule")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={pending}
                      onPress={() => {
                        setShowNewSchedule(false)
                        setNewScheduleName("")
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {mode === "in_person" ? (
              <div className="space-y-1.5">
                <Select
                  selectedKey={locationId || null}
                  onSelectionChange={(key) => {
                    if (typeof key === "string") {
                      setLocationId(key)
                      const loc = locations.find((l) => l.id === key)
                      if (loc) setCountryCodes([loc.country])
                    }
                  }}
                >
                  <Label>{t("fields.location")}</Label>
                  <SelectTrigger data-testid="mode-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((l) => l.active)
                      .map((l) => (
                        <SelectItem key={l.id} id={l.id} textValue={l.label}>
                          {l.label} ({l.country})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {locations.filter((l) => l.active).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("needLocation")}
                  </p>
                ) : null}
                {!showNewLocation ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={pending}
                    onPress={() => setShowNewLocation(true)}
                    data-testid="mode-new-location"
                  >
                    {t("newLocation")}
                  </Button>
                ) : (
                  <div
                    className="space-y-2 rounded-md border p-3"
                    data-testid="mode-new-location-form"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="new-loc-name">
                        {t("fields.locationName")}
                      </Label>
                      <Input
                        id="new-loc-name"
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        onKeyDown={onInlineLocationKeyDown}
                        placeholder={t("locationNamePlaceholder")}
                        data-testid="new-location-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-loc-address">
                        {t("fields.address")}
                      </Label>
                      <Input
                        id="new-loc-address"
                        value={newLocAddress}
                        onChange={(e) => setNewLocAddress(e.target.value)}
                        onKeyDown={onInlineLocationKeyDown}
                        data-testid="new-location-address"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="new-loc-city">{t("fields.city")}</Label>
                        <Input
                          id="new-loc-city"
                          value={newLocCity}
                          onChange={(e) => setNewLocCity(e.target.value)}
                          onKeyDown={onInlineLocationKeyDown}
                          data-testid="new-location-city"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Select
                          selectedKey={newLocCountry}
                          onSelectionChange={(key) => {
                            if (typeof key === "string") {
                              setNewLocCountry(key)
                              setNewLocTimezone(
                                defaultTimezoneForCountry(key, defaultTimezone)
                              )
                            }
                          }}
                        >
                          <Label>{t("fields.locationCountry")}</Label>
                          <SelectTrigger data-testid="new-location-country">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceCountries.map((code) => (
                              <SelectItem key={code} id={code} textValue={code}>
                                {code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-loc-tz">{t("fields.timezone")}</Label>
                      <Input
                        id="new-loc-tz"
                        value={newLocTimezone}
                        onChange={(e) => setNewLocTimezone(e.target.value)}
                        onKeyDown={onInlineLocationKeyDown}
                        data-testid="new-location-tz"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        isDisabled={
                          pending ||
                          !newLocName.trim() ||
                          !newLocAddress.trim() ||
                          !newLocCity.trim()
                        }
                        onPress={() => void handleCreateLocation()}
                        data-testid="save-new-location"
                      >
                        {t("saveLocation")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isDisabled={pending}
                        onPress={() => {
                          setShowNewLocation(false)
                          setNewLocName("")
                          setNewLocAddress("")
                          setNewLocCity("")
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {canUseWorldwide ? (
              <CheckboxField
                isSelected={worldwide}
                onChange={setWorldwide}
                label={t("fields.worldwide")}
                data-testid="mode-worldwide"
              />
            ) : null}

            {!worldwide || !canUseWorldwide ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  {t("fields.countries")}
                </legend>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    isDisabled={pending}
                    onPress={() => applyCountryPreset("all")}
                    data-testid="preset-all-countries"
                  >
                    {t("presets.all")}
                  </Button>
                  {serviceCountries.includes("PT") ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      isDisabled={pending}
                      onPress={() => applyCountryPreset("portugal")}
                      data-testid="preset-portugal"
                    >
                      {t("presets.portugal")}
                    </Button>
                  ) : null}
                  {euPresetCountries.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      isDisabled={pending}
                      onPress={() => applyCountryPreset("eu")}
                      data-testid="preset-eu"
                    >
                      {t("presets.eu")}
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  {serviceCountries.map((code) => (
                    <CheckboxField
                      key={code}
                      isSelected={countryCodes.includes(code)}
                      onChange={() => toggleCountry(code)}
                      label={code}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {t("fields.languages")}
              </legend>
              <div className="flex flex-wrap gap-3">
                {profileLanguages.map((lang) => (
                  <CheckboxField
                    key={lang}
                    isSelected={languages.includes(lang)}
                    onChange={() => toggleLanguage(lang)}
                    label={lang.toUpperCase()}
                  />
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mode-price">{t("fields.priceOverride")}</Label>
                <Input
                  id="mode-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  placeholder={t("pricePlaceholder")}
                  data-testid="mode-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mode-label">{t("fields.label")}</Label>
                <Input
                  id="mode-label"
                  value={labelEn}
                  onChange={(e) => setLabelEn(e.target.value)}
                  placeholder={t("labelPlaceholder")}
                  data-testid="mode-label"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                isDisabled={pending || (mode === "in_person" && !locationId)}
                data-testid="save-mode"
              >
                {pending ? t("saving") : isEditing ? t("saveEdit") : t("save")}
              </Button>
              {activeModes.length > 0 || isEditing ? (
                <Button
                  variant="ghost"
                  isDisabled={pending}
                  onPress={cancelForm}
                >
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
