"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { listCalendarBookingsAction } from "./actions"

export type CalendarBooking = {
  id: string
  status: string
  startsAt: string
  endsAt: string
  timezone: string
  sessionMode: "online" | "in_person" | "phone"
  memberFirstName: string | null
  eventTypeTitle: { en: string; pt?: string; es?: string }
  eventTypeSlug: string
  modeLabel: { en: string; pt?: string; es?: string } | null
  locationName: string | null
  locationCity: string | null
  locationCountry: string | null
  locationAddress: string | null
}

type Props = {
  initialFrom: string
  initialTo: string
  initialBookings: CalendarBooking[]
}

const HOUR_START = 7
const HOUR_END = 21
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, i) => HOUR_START + i
)

const MODE_CLASS: Record<CalendarBooking["sessionMode"], string> = {
  online: "bg-sky-500/90 text-white",
  phone: "bg-emerald-600/90 text-white",
  in_person: "bg-amber-600/90 text-white",
}

function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = weekStartsOn === 1 ? (day + 6) % 7 : day
  d.setDate(d.getDate() - diff)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function pickTitle(
  title: { en: string; pt?: string; es?: string },
  locale: string
): string {
  if (locale.startsWith("pt") && title.pt) return title.pt
  if (locale.startsWith("es") && title.es) return title.es
  return title.en
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function WeekView({ initialFrom, initialTo, initialBookings }: Props) {
  const t = useTranslations("calendar")
  const locale = useLocale()
  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date(initialFrom))
  )
  const [bookings, setBookings] =
    React.useState<CalendarBooking[]>(initialBookings)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const rangeFrom = weekStart
  const rangeTo = addDays(weekStart, 7)
  const rangeFromIso = rangeFrom.toISOString()
  const rangeToIso = rangeTo.toISOString()

  React.useEffect(() => {
    if (rangeFromIso === initialFrom && rangeToIso === initialTo) {
      setBookings(initialBookings)
      return
    }

    let cancelled = false
    setLoading(true)
    void listCalendarBookingsAction(rangeFromIso, rangeToIso).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.ok) {
        setBookings(result.data.bookings)
      }
    })
    return () => {
      cancelled = true
    }
  }, [rangeFromIso, rangeToIso, initialFrom, initialTo, initialBookings])

  const selected = bookings.find((b) => b.id === selectedId) ?? null
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const rangeFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onPress={() => setWeekStart((w) => addDays(w, -7))}
          >
            {t("prevWeek")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setWeekStart(startOfWeek(new Date()))}
          >
            {t("thisWeek")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setWeekStart((w) => addDays(w, 7))}
          >
            {t("nextWeek")}
          </Button>
        </div>
        <p className="text-sm font-medium">
          {rangeFormatter.format(rangeFrom)} –{" "}
          {rangeFormatter.format(addDays(rangeFrom, 6))}
          {loading ? ` · ${t("loading")}` : null}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <div
          className="grid min-w-[720px]"
          style={{
            gridTemplateColumns: `3.5rem repeat(7, minmax(0, 1fr))`,
          }}
        >
          <div className="border-b bg-muted/40 p-2" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="border-b border-l bg-muted/40 p-2 text-center text-xs font-medium"
            >
              {dayFormatter.format(day)}
            </div>
          ))}

          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <div className="border-b px-1 py-2 text-right text-[10px] text-muted-foreground">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const cellStart = new Date(day)
                cellStart.setHours(hour, 0, 0, 0)
                const cellEnd = new Date(day)
                cellEnd.setHours(hour + 1, 0, 0, 0)
                const cellBookings = bookings.filter((b) => {
                  const start = new Date(b.startsAt)
                  return start >= cellStart && start < cellEnd
                })
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="relative min-h-14 border-b border-l p-0.5"
                  >
                    {cellBookings.map((b) => {
                      const start = new Date(b.startsAt)
                      const end = new Date(b.endsAt)
                      const durationMin = Math.max(
                        15,
                        (end.getTime() - start.getTime()) / 60_000
                      )
                      const offsetMin = minutesFromMidnight(start) - hour * 60
                      const topPct = Math.max(0, (offsetMin / 60) * 100)
                      const heightPct = Math.min(
                        100 - topPct,
                        (durationMin / 60) * 100
                      )
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`absolute inset-x-0.5 overflow-hidden rounded px-1 py-0.5 text-left text-[10px] leading-tight ${MODE_CLASS[b.sessionMode]}`}
                          style={{
                            top: `${topPct}%`,
                            height: `${Math.max(heightPct, 18)}%`,
                          }}
                          onClick={() => setSelectedId(b.id)}
                        >
                          <span className="font-medium">
                            {pickTitle(b.eventTypeTitle, locale)}
                          </span>
                          {b.memberFirstName ? (
                            <span className="block opacity-90">
                              {b.memberFirstName}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {pickTitle(selected.eventTypeTitle, locale)}
              </p>
              <p className="text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(selected.startsAt))}{" "}
                –{" "}
                {new Intl.DateTimeFormat(locale, {
                  timeStyle: "short",
                }).format(new Date(selected.endsAt))}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setSelectedId(null)}
            >
              {t("closeDrawer")}
            </Button>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("member")}</dt>
              <dd>{selected.memberFirstName ?? t("memberUnknown")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("mode")}</dt>
              <dd>
                {pickTitle(
                  selected.modeLabel ?? {
                    en: selected.sessionMode.replace("_", " "),
                  },
                  locale
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("location")}</dt>
              <dd>
                {selected.locationName
                  ? [
                      selected.locationName,
                      selected.locationCity,
                      selected.locationCountry,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : selected.sessionMode === "online"
                    ? t("locationOnline")
                    : selected.sessionMode === "phone"
                      ? t("locationPhone")
                      : t("locationUnknown")}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {bookings.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">{t("emptyWeek")}</p>
      ) : null}
    </div>
  )
}
