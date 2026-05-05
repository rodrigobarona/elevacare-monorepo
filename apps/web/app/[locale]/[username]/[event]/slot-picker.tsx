"use client"

import * as React from "react"
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

function getWeekRange(weekOffset: number): { start: Date; end: Date } {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() + weekOffset * 7)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  return { start: startOfWeek, end: endOfWeek }
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

export function SlotPicker({
  username,
  eventSlug,
  durationMinutes,
  timezone: initialTz,
}: Props) {
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
  const [tz, setTz] = React.useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? initialTz
  )

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const range = getWeekRange(weekOffset)
      const result = await loadSlots(
        username,
        eventSlug,
        range.start.toISOString(),
        range.end.toISOString()
      )
      if (result.ok) {
        setSlots(result.slots)
      } else {
        setError(result.error)
      }
      setLoading(false)
    }
    load()
  }, [username, eventSlug, weekOffset])

  async function handleReserve() {
    if (!selectedSlot) return
    setReserving(true)
    setError(null)

    const result = await reserveSlotAction(
      username,
      eventSlug,
      selectedSlot.start,
      selectedSlot.end
    )

    if (result.ok) {
      setReservation({
        id: result.reservationId,
        expiresAt: result.expiresAt,
      })
    } else {
      setError(
        result.error === "slot_taken"
          ? "This slot was just taken. Please choose another."
          : "Could not reserve this slot. Please try again."
      )
      setSelectedSlot(null)
    }
    setReserving(false)
  }

  const grouped = groupByDay(slots, tz)

  if (reservation) {
    const expiresAt = new Date(reservation.expiresAt)
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <div className="text-2xl">&#10003;</div>
          <h3 className="text-lg font-medium">Slot Reserved!</h3>
          <p className="text-sm text-muted-foreground">
            {formatTime(selectedSlot!.start, tz)} –{" "}
            {formatTime(selectedSlot!.end, tz)},{" "}
            {formatDate(new Date(selectedSlot!.start), tz)}
          </p>
          <p className="text-sm text-muted-foreground">
            Your slot is held until{" "}
            {expiresAt.toLocaleTimeString(undefined, {
              timeZone: tz,
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Complete payment to confirm your booking.
          </p>
          <p className="text-xs text-muted-foreground">
            Payment integration coming in Sprint 4.
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
          ← Previous week
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatDate(getWeekRange(weekOffset).start, tz)} –{" "}
          {formatDate(getWeekRange(weekOffset).end, tz)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={loading}
        >
          Next week →
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Times shown in {tz}</p>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading available times...
        </div>
      ) : slots.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No available slots this week. Try another week.
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
            {reserving ? "Reserving..." : "Reserve slot"}
          </Button>
        </div>
      )}
    </div>
  )
}
