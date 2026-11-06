"use client"

import { ToggleButton } from "react-aria-components"
import { Button } from "@eleva/ui/components/button"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import {
  addMonths,
  calendarDays,
  groupSlotsByDay,
  sameUtcMonth,
  startOfMonth,
  utcDateKey,
  type FunnelSlot,
} from "@eleva/ui/lib/booking/slot-groups"
import { cn } from "@eleva/ui/lib/utils"
import { ArrowLeftIcon, ArrowRightIcon } from "@eleva/icons"

export function SlotPicker({
  slots,
  timeZone,
  locale,
  selectedStart,
  onSelect,
  month,
  onMonthChange,
  view,
  onViewChange,
  labels,
  className,
}: {
  slots: readonly FunnelSlot[]
  timeZone: string
  locale: string
  selectedStart: string | null
  onSelect: (slot: FunnelSlot) => void
  month: Date
  onMonthChange: (next: Date) => void
  view: "month" | "week"
  onViewChange: (view: "month" | "week") => void
  labels: {
    month: string
    week: string
    previous: string
    next: string
    empty: string
    weekday: string[]
    /** Accessible name for a day cell, e.g. "Monday 10 November, 4 times". */
    day: (date: string, count: number) => string
    /** Heading over the time list, e.g. "Times on Monday 10 November". */
    timesFor: (date: string) => string
  }
  className?: string
}) {
  const groups = groupSlotsByDay(slots, timeZone)
  const byDay = new Map(groups.map((group) => [group.dateKey, group.slots]))
  const monthStart = startOfMonth(month)
  const days = calendarDays(monthStart)
  const monthKeys = new Set(
    days.filter((day) => sameUtcMonth(day, monthStart)).map(utcDateKey)
  )
  const monthGroups = groups.filter((group) => monthKeys.has(group.dateKey))
  const selectedDay =
    selectedStart != null
      ? groups.find((group) =>
          group.slots.some((slot) => slot.start === selectedStart)
        )?.dateKey
      : undefined
  const activeDay =
    selectedDay != null && monthKeys.has(selectedDay)
      ? selectedDay
      : monthGroups[0]?.dateKey
  const visibleDays = view === "week" ? weekContaining(days, activeDay) : days
  const daySlots = activeDay ? (byDay.get(activeDay) ?? []) : []

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(startOfMonth(month))
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
  const activeDayLabel = activeDay
    ? dayFormat.format(new Date(`${activeDay}T00:00:00Z`))
    : null

  return (
    <div
      data-slot="slot-picker"
      className={cn("flex flex-col gap-5", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.previous}
            onPress={() => onMonthChange(addMonths(month, -1))}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <p
            aria-live="polite"
            className="min-w-40 text-center font-medium first-letter:uppercase"
          >
            {monthLabel}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            data-testid="booking-slot-next"
            aria-label={labels.next}
            onPress={() => onMonthChange(addMonths(month, 1))}
          >
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
        <div className="flex rounded-full bg-muted p-1">
          {(["month", "week"] as const).map((option) => (
            <ToggleButton
              key={option}
              isSelected={view === option}
              onChange={() => onViewChange(option)}
              className={buttonVariants({
                variant: view === option ? "secondary" : "ghost",
                size: "sm",
              })}
            >
              {labels[option]}
            </ToggleButton>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {labels.weekday.map((day) => (
          <p
            key={day}
            aria-hidden
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </p>
        ))}
        {visibleDays.map((day) => {
          const key = utcDateKey(day)
          const inMonth = sameUtcMonth(day, startOfMonth(month))
          const count = inMonth ? (byDay.get(key)?.length ?? 0) : 0
          return (
            <button
              key={key}
              type="button"
              disabled={count === 0}
              aria-label={labels.day(dayFormat.format(day), count)}
              aria-pressed={count > 0 ? activeDay === key : undefined}
              data-testid={count > 0 ? "booking-slot-day" : undefined}
              onClick={() => {
                const first = byDay.get(key)?.[0]
                if (first) onSelect(first)
              }}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-2xl text-sm",
                inMonth ? "text-foreground" : "text-muted-foreground/50",
                count > 0 && "hover:bg-muted",
                count === 0 && "cursor-not-allowed opacity-40",
                activeDay === key &&
                  "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {day.getUTCDate()}
              {count > 0 ? (
                <span
                  aria-hidden
                  className="text-[10px] tabular-nums opacity-80"
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        <p aria-live="polite" className="text-sm font-medium">
          {daySlots.length > 0 && activeDayLabel
            ? labels.timesFor(activeDayLabel)
            : labels.empty}
        </p>
        {daySlots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {daySlots.map((slot) => {
              const time = new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
                timeZone,
              }).format(new Date(slot.start))
              const isSelected = selectedStart === slot.start
              return (
                <ToggleButton
                  key={slot.start}
                  data-testid="booking-slot-time"
                  data-start={slot.start}
                  isSelected={isSelected}
                  onChange={() => onSelect(slot)}
                  className={buttonVariants({
                    variant: isSelected ? "default" : "outline",
                  })}
                >
                  {time}
                </ToggleButton>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function weekContaining(grid: Date[], dateKey?: string): Date[] {
  if (!dateKey) return grid.slice(0, 7)
  const index = grid.findIndex((day) => utcDateKey(day) === dateKey)
  if (index < 0) return grid.slice(0, 7)
  const start = index - (index % 7)
  return grid.slice(start, start + 7)
}
