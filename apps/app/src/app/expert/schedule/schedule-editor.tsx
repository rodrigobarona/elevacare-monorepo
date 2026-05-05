"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

interface DayRule {
  enabled: boolean
  startTime: string
  endTime: string
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

const COMMON_TIMEZONES = [
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Sao_Paulo",
]

function rulesToDayMap(
  rules: AvailabilityRuleInput[]
): Record<number, DayRule> {
  const map: Record<number, DayRule> = {}
  for (let i = 0; i < 7; i++) {
    const rule = rules.find((r) => r.dayOfWeek === i)
    map[i] = rule
      ? { enabled: true, startTime: rule.startTime, endTime: rule.endTime }
      : { enabled: false, startTime: "09:00", endTime: "17:00" }
  }
  return map
}

export function ScheduleEditor({
  timezone: initialTz,
  initialRules,
  initialOverrides,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [timezone, setTimezone] = React.useState(initialTz)
  const [days, setDays] = React.useState(() => rulesToDayMap(initialRules))
  const [overrides, setOverrides] =
    React.useState<OverrideRow[]>(initialOverrides)

  const [newDate, setNewDate] = React.useState("")
  const [newBlocked, setNewBlocked] = React.useState(true)
  const [newStart, setNewStart] = React.useState("09:00")
  const [newEnd, setNewEnd] = React.useState("17:00")

  function updateDay(dayIdx: number, field: keyof DayRule, value: unknown) {
    setDays((prev) => ({
      ...prev,
      [dayIdx]: { ...prev[dayIdx]!, [field]: value },
    }))
  }

  async function handleSave() {
    setPending(true)
    setError(null)
    setSuccess(false)

    const rules: AvailabilityRuleInput[] = []
    for (let i = 0; i < 7; i++) {
      const day = days[i]!
      if (day.enabled) {
        if (day.startTime >= day.endTime) {
          setError(`${DAYS[i]}: start time must be before end time`)
          setPending(false)
          return
        }
        rules.push({
          dayOfWeek: i,
          startTime: day.startTime,
          endTime: day.endTime,
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
      setError("Override start time must be before end time")
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
          <AlertDescription>Schedule saved successfully.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timezone</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((dayName, idx) => {
            const day = days[idx]!
            return (
              <div key={idx} className="flex items-center gap-4">
                <label className="flex w-28 items-center gap-2 text-sm">
                  <Checkbox
                    checked={day.enabled}
                    onCheckedChange={(v) => updateDay(idx, "enabled", !!v)}
                  />
                  {dayName}
                </label>
                {day.enabled && (
                  <>
                    <Input
                      type="time"
                      value={day.startTime}
                      onChange={(e) =>
                        updateDay(idx, "startTime", e.target.value)
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.endTime}
                      onChange={(e) =>
                        updateDay(idx, "endTime", e.target.value)
                      }
                      className="w-32"
                    />
                  </>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Date Overrides</CardTitle>
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
                      ? " — Blocked"
                      : ` — ${ov.startTime ?? ""} to ${ov.endTime ?? ""}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOverride(ov.id)}
                    disabled={pending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
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
              Block entire day
            </label>
            {!newBlocked && (
              <>
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
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
              Add override
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={pending}>
        {pending ? "Saving..." : "Save schedule"}
      </Button>
    </div>
  )
}
