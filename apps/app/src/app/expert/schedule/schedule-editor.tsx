"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Checkbox } from "@eleva/ui/components/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import {
  saveScheduleAction,
  addDateOverrideAction,
  removeDateOverrideAction,
  type AvailabilityRuleInput,
} from "./actions"

const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const

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
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [timezone, setTimezone] = React.useState(
    () => initialTz || Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [days, setDays] = React.useState(() => rulesToDayMap(initialRules))
  const [overrides, setOverrides] =
    React.useState<OverrideRow[]>(initialOverrides)

  React.useEffect(() => {
    setOverrides(initialOverrides)
  }, [initialOverrides])

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
    setSuccess(false)

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
        setSuccess(true)
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
      {success && (
        <Alert>
          <AlertDescription>{t("saved")}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("timezone")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {ALL_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
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
        </CardHeader>
        <CardContent className="space-y-4">
          {DAY_INDICES.map((idx) => {
            const day = days[idx]!
            const dayLabel = t(`days.${idx}`)
            return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-4">
                  <label className="flex w-28 items-center gap-2 text-sm">
                    <Checkbox
                      checked={day.enabled}
                      onCheckedChange={(v) => toggleDay(idx, !!v)}
                    />
                    {dayLabel}
                  </label>
                  {day.enabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addWindow(idx)}
                      className="ml-auto"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {t("addWindow")}
                    </Button>
                  )}
                </div>
                {day.enabled &&
                  day.windows.map((w, wIdx) => (
                    <div
                      key={wIdx}
                      className="ml-[7.5rem] flex items-center gap-2"
                    >
                      <Input
                        type="time"
                        value={w.startTime}
                        onChange={(e) =>
                          updateWindow(idx, wIdx, "startTime", e.target.value)
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        {t("to")}
                      </span>
                      <Input
                        type="time"
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
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeWindow(idx, wIdx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dateOverrides")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {overrides.length > 0 && (
            <div className="space-y-2">
              {overrides.map((ov) => (
                <div
                  key={ov.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>
                    {ov.overrideDate}
                    {ov.isBlocked
                      ? ` — ${t("blocked")}`
                      : ` — ${ov.startTime ?? ""} ${t("to")} ${ov.endTime ?? ""}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOverride(ov.id)}
                    disabled={pending}
                  >
                    {t("remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>{t("overrideDate")}</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-40"
              />
            </div>
            <label className="flex items-center gap-2 self-center text-sm">
              <Checkbox
                checked={newBlocked}
                onCheckedChange={(v) => setNewBlocked(!!v)}
              />
              {t("overrideBlockDay")}
            </label>
            {!newBlocked && (
              <>
                <div className="space-y-1.5">
                  <Label>{t("overrideFrom")}</Label>
                  <Input
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("overrideTo")}</Label>
                  <Input
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-32"
                  />
                </div>
              </>
            )}
            <Button
              onClick={handleAddOverride}
              disabled={pending || !newDate}
              variant="outline"
              size="sm"
            >
              {t("addOverride")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </div>
  )
}
