"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { CaretLeftIcon, CaretRightIcon } from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { cn } from "@eleva/ui/lib/utils"
import { JoinCta } from "@eleva/video/join-cta"
import { listCalendarBookingsAction } from "./actions"
import { RequestActions } from "./request-actions"

export type CalendarBooking = {
  id: string
  status: string
  startsAt: string
  endsAt: string
  timezone: string
  sessionMode: "online" | "in_person" | "phone"
  memberFirstName: string | null
  approvalDeadlineAt: string | null
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
  orgSlug: string
}

const HOUR_START = 7
const HOUR_END = 21
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, i) => HOUR_START + i
)

const MODE_CLASS: Record<CalendarBooking["sessionMode"], string> = {
  online: "bg-primary text-primary-foreground",
  phone: "bg-info text-status-foreground",
  in_person: "bg-coral-700 text-white dark:bg-coral-400 dark:text-coral-950",
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function WeekView({
  initialFrom,
  initialTo,
  initialBookings,
  orgSlug,
}: Props) {
  const t = useTranslations("calendar")
  const tReport = useTranslations("sessions.report")
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
        setBookings(
          result.data.bookings.map((booking) => ({
            ...booking,
            approvalDeadlineAt: booking.approvalDeadlineAt ?? null,
          }))
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [rangeFromIso, rangeToIso, initialFrom, initialTo, initialBookings])

  const selected = bookings.find((b) => b.id === selectedId) ?? null
  const today = new Date()
  const { weekdayFormatter, rangeFormatter, timeFormatter } = React.useMemo(
    () => ({
      weekdayFormatter: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      rangeFormatter: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      timeFormatter: new Intl.DateTimeFormat(locale, { timeStyle: "short" }),
    }),
    [locale]
  )
  function modeName(mode: CalendarBooking["sessionMode"]): string {
    switch (mode) {
      case "online":
        return t("locationOnline")
      case "phone":
        return t("locationPhone")
      case "in_person":
        return t("modeInPerson")
      default: {
        const _exhaustive: never = mode
        return _exhaustive
      }
    }
  }
  const legendModes: CalendarBooking["sessionMode"][] = [
    "online",
    "phone",
    "in_person",
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          className="font-display text-xl font-medium tracking-tight"
          aria-live="polite"
        >
          {rangeFormatter.formatRange(rangeFrom, addDays(rangeFrom, 6))}
          {loading ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t("loading")}
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("prevWeek")}
            onPress={() => setWeekStart((w) => addDays(w, -7))}
          >
            <CaretLeftIcon />
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
            size="icon-sm"
            aria-label={t("nextWeek")}
            onPress={() => setWeekStart((w) => addDays(w, 7))}
          >
            <CaretRightIcon />
          </Button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legendModes.map((mode) => (
          <li key={mode} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-2.5 rounded-full", MODE_CLASS[mode])}
            />
            {modeName(mode)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full border border-dashed border-foreground/60"
          />
          {t("requestPending")}
        </li>
      </ul>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-1">
        <div
          className="grid min-w-[720px]"
          style={{
            gridTemplateColumns: `3.5rem repeat(7, minmax(0, 1fr))`,
          }}
        >
          <div className="border-b" />
          {days.map((day) => {
            const isToday = isSameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-b border-l px-2 py-3 text-center",
                  isToday && "bg-teal-50/70 dark:bg-teal-950/30"
                )}
              >
                <span className="block eyebrow text-[10px]">
                  {weekdayFormatter.format(day).replaceAll(".", "")}
                </span>
                <span
                  className={cn(
                    "mx-auto mt-1 flex size-8 items-center justify-center rounded-full font-display text-lg tabular-nums",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                  aria-current={isToday ? "date" : undefined}
                >
                  {day.getDate()}
                </span>
              </div>
            )
          })}

          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <div className="border-b px-2 py-2 text-right text-[10px] text-muted-foreground tabular-nums">
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
                    className={cn(
                      "relative min-h-14 border-b border-l p-0.5",
                      isSameDay(day, today) &&
                        "bg-teal-50/40 dark:bg-teal-950/20"
                    )}
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
                          className={cn(
                            "absolute inset-x-0.5 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight shadow-1 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            MODE_CLASS[b.sessionMode],
                            b.status === "awaiting_confirmation" &&
                              "ring-dashed ring-2 ring-background/70"
                          )}
                          style={{
                            top: `${topPct}%`,
                            height: `${Math.max(heightPct, 18)}%`,
                          }}
                          onClick={() => setSelectedId(b.id)}
                        >
                          <span className="block tabular-nums opacity-90">
                            {timeFormatter.format(start)}
                          </span>
                          <span className="block truncate font-medium">
                            {pickTitle(b.eventTypeTitle, locale)}
                          </span>
                          {b.status === "awaiting_confirmation" ? (
                            <span className="block truncate opacity-90">
                              {t("requestPending")}
                            </span>
                          ) : b.memberFirstName ? (
                            <span className="block truncate opacity-90">
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
        <div className="rounded-3xl border bg-card p-5 text-sm shadow-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {selected.status === "awaiting_confirmation" ? (
                <StatusPill tone="attention">{t("requestPending")}</StatusPill>
              ) : null}
              <p className="font-display text-lg font-medium tracking-tight">
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
          <dl className="mt-4 grid gap-3 rounded-2xl bg-sand-50 p-4 sm:grid-cols-2 dark:bg-muted/40">
            <div>
              <dt className="text-xs text-muted-foreground">{t("member")}</dt>
              <dd>{selected.memberFirstName ?? t("memberUnknown")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("mode")}</dt>
              <dd>
                {selected.modeLabel
                  ? pickTitle(selected.modeLabel, locale)
                  : modeName(selected.sessionMode)}
              </dd>
            </div>
            {selected.status === "awaiting_confirmation" &&
            selected.approvalDeadlineAt ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  {t("respondBy")}
                </dt>
                <dd>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(selected.approvalDeadlineAt))}
                </dd>
              </div>
            ) : null}
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
          {selected.status === "awaiting_confirmation" ? (
            <RequestActions
              bookingId={selected.id}
              onSettled={(status) => {
                if (status === "confirmed") {
                  setBookings((curr) =>
                    curr.map((b) =>
                      b.id === selected.id ? { ...b, status: "confirmed" } : b
                    )
                  )
                  return
                }
                setBookings((curr) => curr.filter((b) => b.id !== selected.id))
                setSelectedId(null)
              }}
            />
          ) : (
            <JoinCta
              className="mt-4"
              href={`/${orgSlug}/team/sessions/${selected.id}/join`}
              sessionMode={selected.sessionMode}
              status={selected.status}
              startsAt={selected.startsAt}
              endsAt={selected.endsAt}
              joinLabel={t("join")}
              joinSoonLabel={t("joinSoon")}
              pending="hint"
            />
          )}
          {selected.status === "confirmed" ||
          selected.status === "completed" ? (
            <LinkButton
              className="mt-3"
              variant="outline"
              href={`/${orgSlug}/team/sessions/${selected.id}/report`}
            >
              {tReport("open")}
            </LinkButton>
          ) : null}
        </div>
      ) : null}

      {bookings.length === 0 && !loading ? (
        <p className="rounded-3xl border border-dashed border-sand-300 bg-sand-50/70 p-6 text-center text-sm text-muted-foreground dark:border-border dark:bg-card">
          {t("emptyWeek")}
        </p>
      ) : null}
    </div>
  )
}
