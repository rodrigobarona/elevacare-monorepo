"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import { Card, CardContent } from "@eleva/ui/components/card"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { loadSlots, reserveSlotAction, type SlotData } from "./actions"

interface Props {
  username: string
  eventSlug: string
  durationMinutes: number
  timezone: string
}

function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatDate(date: Date, tz: string): string {
  return date.toLocaleDateString(undefined, {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function getWeekRange(
  weekOffset: number,
  tz: string
): { start: Date; end: Date } {
  const now = new Date()
  const localNow = new Date(now.toLocaleString("en-US", { timeZone: tz }))
  const dayOfWeek = localNow.getDay()
  const startOfWeek = new Date(localNow)
  startOfWeek.setDate(localNow.getDate() - dayOfWeek + weekOffset * 7)
  startOfWeek.setHours(0, 0, 0, 0)
  const offsetMs =
    startOfWeek.getTime() -
    new Date(startOfWeek.toLocaleString("en-US", { timeZone: "UTC" })).getTime()
  const utcStart = new Date(startOfWeek.getTime() - offsetMs)
  const utcEnd = new Date(utcStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start: utcStart, end: utcEnd }
}

function groupByDay(slots: SlotData[], tz: string): Map<string, SlotData[]> {
  const groups = new Map<string, SlotData[]>()
  for (const slot of slots) {
    const day = new Date(slot.start).toLocaleDateString(undefined, {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const group = groups.get(day) ?? []
    group.push(slot)
    groups.set(day, group)
  }
  return groups
}

const ERROR_KEYS = [
  "expert-not-found",
  "event-not-found",
  "load-failed",
  "invalid-date-range",
  "invalid-slot-start",
  "slot_taken",
  "reserve-failed",
  "conflict",
  "no-schedule",
  "slot-unavailable",
  "reservation-failed",
  "past_slot",
  "insufficient_notice",
  "outside_booking_window",
  "db_error",
] as const

export function SlotPicker({
  username,
  eventSlug,
  durationMinutes,
  timezone: initialTz,
}: Props) {
  const t = useTranslations("slotPicker")

  function friendlyError(code: string): string {
    if ((ERROR_KEYS as readonly string[]).includes(code)) {
      return t(`errors.${code}` as Parameters<typeof t>[0])
    }
    return t("errors.generic")
  }

  const [weekOffset, setWeekOffset] = React.useState(0)
  const [slots, setSlots] = React.useState<SlotData[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = React.useState<SlotData | null>(null)
  const [reserving, setReserving] = React.useState(false)
  const [reservation, setReservation] = React.useState<{
    id: string
    expiresAt: string
  } | null>(null)
  const [tz, setTz] = React.useState(() => initialTz)

  React.useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browserTz && browserTz !== initialTz) {
      setTz(browserTz)
    }
  }, [initialTz])

  React.useEffect(() => {
    let stale = false
    setSelectedSlot(null)

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const range = getWeekRange(weekOffset, tz)
        const result = await loadSlots(
          username,
          eventSlug,
          range.start.toISOString(),
          range.end.toISOString()
        )
        if (stale) return
        if (result.ok) {
          setSlots(result.slots)
        } else {
          setError(friendlyError(result.error))
        }
      } catch {
        if (!stale) setError(friendlyError("load-failed"))
      } finally {
        if (!stale) setLoading(false)
      }
    }
    load()

    return () => {
      stale = true
    }
  }, [username, eventSlug, weekOffset])

  async function handleReserve() {
    if (!selectedSlot) return
    setReserving(true)
    setError(null)

    try {
      const result = await reserveSlotAction(
        username,
        eventSlug,
        selectedSlot.start
      )

      if (result.ok) {
        setReservation({
          id: result.reservationId,
          expiresAt: result.expiresAt,
        })
      } else {
        setError(friendlyError(result.error))
        setSelectedSlot(null)
      }
    } catch {
      setError(friendlyError("reserve-failed"))
      setSelectedSlot(null)
    } finally {
      setReserving(false)
    }
  }

  const grouped = groupByDay(slots, tz)

  if (reservation) {
    const expiresAt = new Date(reservation.expiresAt)
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <div className="text-2xl">&#10003;</div>
          <h3 className="text-lg font-medium">{t("reservedTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {formatTime(selectedSlot!.start, tz)} –{" "}
            {formatTime(selectedSlot!.end, tz)},{" "}
            {formatDate(new Date(selectedSlot!.start), tz)}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("heldUntil", {
              time: expiresAt.toLocaleTimeString(undefined, {
                timeZone: tz,
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("paymentComingSoon")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset <= 0 || loading}
        >
          {t("previousWeek")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatDate(getWeekRange(weekOffset, tz).start, tz)} –{" "}
          {formatDate(getWeekRange(weekOffset, tz).end, tz)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={loading}
        >
          {t("nextWeek")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("timesShownIn", { tz })}
      </p>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          {t("loading")}
        </div>
      ) : slots.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {t("noSlots")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(grouped.entries()).map(([dayStr, daySlots]) => (
            <Card key={dayStr}>
              <CardContent className="space-y-2 pt-4">
                <h4 className="text-sm font-medium">
                  {formatDate(new Date(daySlots[0]!.start), tz)}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {daySlots.map((slot) => {
                    const isSelected = selectedSlot?.start === slot.start
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary hover:bg-accent"
                        }`}
                      >
                        {formatTime(slot.start, tz)}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedSlot && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
          <div>
            <p className="text-sm font-medium">
              {formatDate(new Date(selectedSlot.start), tz)} at{" "}
              {formatTime(selectedSlot.start, tz)}
            </p>
            <p className="text-xs text-muted-foreground">
              {durationMinutes} minutes
            </p>
          </div>
          <Button onClick={handleReserve} disabled={reserving}>
            {reserving ? t("reserving") : t("reserveSlot")}
          </Button>
        </div>
      )}
    </div>
  )
}
