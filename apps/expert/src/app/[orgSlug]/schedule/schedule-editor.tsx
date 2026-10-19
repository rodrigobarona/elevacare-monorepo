"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { PlusIcon, XIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  saveScheduleAction,
  addDateOverrideAction,
  removeDateOverrideAction,
  type AvailabilityRuleInput,
} from "./actions"

/** Rendered Monday-first; values stay JS weekday indices (0 = Sunday). */
function formatOverrideDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0] as const

interface TimeWindow {
  startTime: string
  endTime: string
}

interface DayRule {
  enabled: boolean
  windows: TimeWindow[]
}

interface OverrideRow {
  id: string
  overrideDate: string
  startTime: string | null
  endTime: string | null
  isBlocked: boolean
}

interface Props {
  timezone: string
  initialRules: AvailabilityRuleInput[]
  initialOverrides: OverrideRow[]
}

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone")
const DEFAULT_WINDOW: TimeWindow = { startTime: "09:00", endTime: "17:00" }

function rulesToDayMap(
  rules: AvailabilityRuleInput[]
): Record<number, DayRule> {
  const map: Record<number, DayRule> = {}
  for (let i = 0; i < 7; i++) {
    const dayRules = rules.filter((r) => r.dayOfWeek === i)
    map[i] =
      dayRules.length > 0
        ? {
            enabled: true,
            windows: dayRules.map((r) => ({
              startTime: r.startTime,
              endTime: r.endTime,
            })),
          }
        : { enabled: false, windows: [{ ...DEFAULT_WINDOW }] }
  }
  return map
}

function windowsOverlap(windows: TimeWindow[]): boolean {
  if (windows.length < 2) return false
  const sorted = [...windows].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  )
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startTime < sorted[i - 1]!.endTime) return true
  }
  return false
}

export function ScheduleEditor({
  timezone: initialTz,
  initialRules,
  initialOverrides,
}: Props) {
  const router = useRouter()
  const t = useTranslations("schedule")
  const locale = useLocale()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [timezone, setTimezone] = React.useState(
    () => initialTz || Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [days, setDays] = React.useState(() => rulesToDayMap(initialRules))
  const [overrides, setOverrides] =
    React.useState<OverrideRow[]>(initialOverrides)
  // Reset local overrides state when the parent passes a new initial set
  // (e.g. after a save). React 19 canonical pattern: compare during render
  // instead of mirroring via useEffect, which avoids cascading renders.
  const [prevInitialOverrides, setPrevInitialOverrides] =
    React.useState(initialOverrides)
  if (prevInitialOverrides !== initialOverrides) {
    setPrevInitialOverrides(initialOverrides)
    setOverrides(initialOverrides)
  }

  const [newDate, setNewDate] = React.useState("")
  const [newBlocked, setNewBlocked] = React.useState(true)
  const [newStart, setNewStart] = React.useState("09:00")
  const [newEnd, setNewEnd] = React.useState("17:00")

  function toggleDay(dayIdx: number, enabled: boolean) {
    setDays((prev) => ({
      ...prev,
      [dayIdx]: {
        ...prev[dayIdx]!,
        enabled,
        windows: enabled
          ? prev[dayIdx]!.windows.length > 0
            ? prev[dayIdx]!.windows
            : [{ ...DEFAULT_WINDOW }]
          : prev[dayIdx]!.windows,
      },
    }))
  }

  function updateWindow(
    dayIdx: number,
    windowIdx: number,
    field: keyof TimeWindow,
    value: string
  ) {
    setDays((prev) => {
      const day = prev[dayIdx]!
      const updated = day.windows.map((w, i) =>
        i === windowIdx ? { ...w, [field]: value } : w
      )
      return { ...prev, [dayIdx]: { ...day, windows: updated } }
    })
  }

  function addWindow(dayIdx: number) {
    setDays((prev) => {
      const day = prev[dayIdx]!
      const last = day.windows[day.windows.length - 1]
      const newWindow: TimeWindow = last
        ? { startTime: last.endTime, endTime: "17:00" }
        : { ...DEFAULT_WINDOW }
      return {
        ...prev,
        [dayIdx]: { ...day, windows: [...day.windows, newWindow] },
      }
    })
  }

  function removeWindow(dayIdx: number, windowIdx: number) {
    setDays((prev) => {
      const day = prev[dayIdx]!
      const updated = day.windows.filter((_, i) => i !== windowIdx)
      if (updated.length === 0) {
        return {
          ...prev,
          [dayIdx]: { enabled: false, windows: [{ ...DEFAULT_WINDOW }] },
        }
      }
      return { ...prev, [dayIdx]: { ...day, windows: updated } }
    })
  }

  async function handleSave() {
    setPending(true)
    setError(null)

    const rules: AvailabilityRuleInput[] = []
    for (let i = 0; i < 7; i++) {
      const day = days[i]!
      if (!day.enabled) continue

      const dayName = t(`days.${i}`)
      for (const w of day.windows) {
        if (w.startTime >= w.endTime) {
          setError(t("error.startBeforeEnd", { day: dayName }))
          setPending(false)
          return
        }
      }
      if (windowsOverlap(day.windows)) {
        setError(t("error.overlappingWindows", { day: dayName }))
        setPending(false)
        return
      }
      for (const w of day.windows) {
        rules.push({
          dayOfWeek: i,
          startTime: w.startTime,
          endTime: w.endTime,
        })
      }
    }

    try {
      const result = await saveScheduleAction({ timezone, rules })
      if (result.ok) {
        toast.success(t("saved"))
      } else {
        setError(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  async function handleAddOverride() {
    if (!newDate) return
    setPending(true)
    setError(null)

    if (!newBlocked && newStart >= newEnd) {
      setError(t("error.overrideStartBeforeEnd"))
      setPending(false)
      return
    }

    try {
      const result = await addDateOverrideAction({
        overrideDate: newDate,
        startTime: newBlocked ? undefined : newStart,
        endTime: newBlocked ? undefined : newEnd,
        isBlocked: newBlocked,
        timezone,
      })
      if (result.ok) {
        setNewDate("")
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  async function handleRemoveOverride(id: string) {
    setPending(true)
    setError(null)
    try {
      const result = await removeDateOverrideAction(id)
      if (result.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== id))
      } else {
        setError(result.error)
      }
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
          <CardTitle>{t("timezone")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            aria-label={t("timezone")}
            selectedKey={timezone}
            onSelectionChange={(key) => {
              if (typeof key === "string") setTimezone(key)
            }}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {ALL_TIMEZONES.map((tz) => (
                <SelectItem key={tz} id={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyHours")}</CardTitle>
          <CardDescription>{t("weeklyHoursHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {DAY_INDICES.map((idx) => {
              const day = days[idx]!
              const dayLabel = t(`days.${idx}`)
              return (
                <li
                  key={idx}
                  className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start"
                >
                  <CheckboxField
                    id={`schedule-day-${idx}`}
                    className="sm:pt-2"
                    label={dayLabel}
                    isSelected={day.enabled}
                    onChange={(v) => toggleDay(idx, v)}
                  />
                  {day.enabled ? (
                    <div className="space-y-2">
                      {day.windows.map((w, wIdx) => (
                        <div key={wIdx} className="flex items-center gap-2">
                          <Input
                            type="time"
                            aria-label={t("startTimeLabel", { day: dayLabel })}
                            value={w.startTime}
                            onChange={(e) =>
                              updateWindow(
                                idx,
                                wIdx,
                                "startTime",
                                e.target.value
                              )
                            }
                            className="w-32"
                          />
                          <span className="text-sm text-muted-foreground">
                            {t("to")}
                          </span>
                          <Input
                            type="time"
                            aria-label={t("endTimeLabel", { day: dayLabel })}
                            value={w.endTime}
                            onChange={(e) =>
                              updateWindow(idx, wIdx, "endTime", e.target.value)
                            }
                            className="w-32"
                          />
                          {day.windows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("removeWindowLabel", {
                                day: dayLabel,
                              })}
                              onPress={() => removeWindow(idx, wIdx)}
                            >
                              <XIcon aria-hidden />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground sm:pt-2">
                      {t("unavailable")}
                    </p>
                  )}
                  {day.enabled ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onPress={() => addWindow(idx)}
                      className="justify-self-start sm:justify-self-end"
                    >
                      <PlusIcon aria-hidden />
                      {t("addWindow")}
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dateOverrides")}</CardTitle>
          <CardDescription>{t("dateOverridesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {overrides.length > 0 ? (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {overrides.map((ov) => (
                <li
                  key={ov.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-foreground first-letter:uppercase">
                      {formatOverrideDate(ov.overrideDate, locale)}
                    </span>
                    <span className="block text-muted-foreground">
                      {ov.isBlocked
                        ? t("blocked")
                        : `${ov.startTime?.slice(0, 5) ?? ""} ${t("to")} ${ov.endTime?.slice(0, 5) ?? ""}`}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => handleRemoveOverride(ov.id)}
                    isDisabled={pending}
                  >
                    {t("remove")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("overrideEmpty")}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-sand-50/70 p-4 dark:bg-muted/40">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-override-date">
                {t("overrideDate")}
              </Label>
              <Input
                id="schedule-override-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-40"
              />
            </div>
            <CheckboxField
              id="schedule-override-blocked"
              className="self-center"
              label={t("overrideBlockDay")}
              isSelected={newBlocked}
              onChange={setNewBlocked}
            />
            {!newBlocked && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-override-from">
                    {t("overrideFrom")}
                  </Label>
                  <Input
                    id="schedule-override-from"
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-override-to">
                    {t("overrideTo")}
                  </Label>
                  <Input
                    id="schedule-override-to"
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-32"
                  />
                </div>
              </>
            )}
            <Button
              onPress={handleAddOverride}
              isDisabled={pending || !newDate}
              variant="outline"
              size="sm"
            >
              {t("addOverride")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onPress={handleSave} isDisabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  )
}
