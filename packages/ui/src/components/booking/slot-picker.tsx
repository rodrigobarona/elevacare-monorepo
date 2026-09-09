"use client"

import { Button } from "@eleva/ui/components/button"
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
          <p className="min-w-40 text-center font-medium capitalize">
            {monthLabel}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.next}
            onPress={() => onMonthChange(addMonths(month, 1))}
          >
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
        <div className="flex rounded-full bg-muted p-1">
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            onPress={() => onViewChange("month")}
          >
            {labels.month}
          </Button>
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onPress={() => onViewChange("week")}
          >
            {labels.week}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {labels.weekday.map((day) => (
          <p
            key={day}
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </p>
        ))}
        {visibleDays.map((day) => {
          const key = utcDateKey(day)
          const count = byDay.get(key)?.length ?? 0
          const inMonth = sameUtcMonth(day, startOfMonth(month))
          return (
            <button
              key={key}
              type="button"
              disabled={count === 0}
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
                <span className="text-[10px] tabular-nums opacity-80">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {daySlots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {daySlots.map((slot) => {
            const time = new Intl.DateTimeFormat(locale, {
              hour: "2-digit",
              minute: "2-digit",
              timeZone,
            }).format(new Date(slot.start))
            return (
              <Button
                key={slot.start}
                variant={selectedStart === slot.start ? "default" : "outline"}
                onPress={() => onSelect(slot)}
              >
                {time}
              </Button>
            )
          })}
        </div>
      )}
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
