"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { CancellationQuote } from "@eleva/api-client"
import { describeCancellationPolicy } from "@eleva/config/cancellation-policy"
import { isLocale } from "@eleva/config/i18n"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import {
  cancelBookingAction,
  getCancellationQuoteAction,
  rescheduleBookingAction,
} from "../actions"
import {
  formatDateTime,
  formatMoney,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/member-format"
import { SPACE_BASE } from "@eleva/config/routing"

const ERROR_KEYS = [
  "generic",
  "validation",
  "tooLate",
  "invalidStatus",
  "slotTaken",
  "notFound",
] as const

type ErrorKey = (typeof ERROR_KEYS)[number]

function isErrorKey(value: string): value is ErrorKey {
  return (ERROR_KEYS as readonly string[]).includes(value)
}

interface SessionActionsProps {
  bookingId: string
  startsAt: string
  endsAt: string
  timezone: string
  locale: string
  /** Null when the booking can no longer be changed by the member. */
  quote: CancellationQuote | null
  /** The member paid for it, so cancelling is about a refund too. */
  paid: boolean
}

export function SessionActions({
  bookingId,
  startsAt,
  endsAt,
  timezone,
  locale,
  quote,
  paid,
}: SessionActionsProps) {
  const t = useTranslations("sessions")
  const te = useTranslations("errors")
  const tc = useTranslations("common")
  const router = useRouter()
  const [current, setCurrent] = useState(quote)
  const mutable = current !== null
  // The server says until when the session can be moved; it knows the
  // refund window and the service's own reschedule window.
  const rescheduleUntil = current?.rescheduleUntil ?? null
  const canReschedule = rescheduleUntil !== null
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [newStart, setNewStart] = useState(
    toDatetimeLocalValue(startsAt, timezone)
  )

  function refundCopy(current: CancellationQuote): string[] {
    const policy = describeCancellationPolicy(
      current.policy,
      isLocale(locale) ? locale : "en"
    ).name
    const amount = formatMoney(current.refundCents, locale, current.currency)
    const lines: string[] = []
    if (current.refundCents > 0) {
      lines.push(
        current.refundPercent === 100
          ? t("refundFull", { amount, policy })
          : t("refundPartial", {
              amount,
              percent: current.refundPercent,
              policy,
            })
      )
    } else if (current.refundPercent > 0) {
      lines.push(t("refundNothingPaid"))
    } else {
      lines.push(t("refundNone", { policy }))
    }
    if (current.nextChangeAt && current.refundCents > 0) {
      lines.push(
        t("refundDropsAt", {
          date: formatDateTime(current.nextChangeAt, locale, timezone),
        })
      )
    }
    return lines
  }

  function errorMessage(code: string): string {
    if (isErrorKey(code)) return te(code)
    return te("generic")
  }

  /** Fresh quote from the API; undefined when it could not be loaded. */
  async function refreshQuote(): Promise<CancellationQuote | null | undefined> {
    const result = await getCancellationQuoteAction(bookingId)
    if (!result.ok) {
      toast.error(errorMessage(result.error))
      return undefined
    }
    setCurrent(result.quote)
    return result.quote
  }

  async function openCancel() {
    setPending(true)
    setCancelOpen(true)
    try {
      const fresh = await refreshQuote()
      if (fresh === null) setCancelOpen(false)
    } finally {
      setPending(false)
    }
  }

  async function openReschedule() {
    setPending(true)
    try {
      const fresh = await refreshQuote()
      if (fresh === undefined) return
      if (fresh?.refundPercent !== 100) {
        toast.error(t("rescheduleUnavailable"))
        return
      }
      setRescheduleOpen(true)
    } finally {
      setPending(false)
    }
  }

  async function handleCancel() {
    setPending(true)
    try {
      const shown = current
      const fresh = await refreshQuote()
      if (fresh === undefined) return
      if (fresh === null) {
        toast.error(te("tooLate"))
        setCancelOpen(false)
        return
      }
      if (
        fresh.refundCents !== shown?.refundCents ||
        fresh.refundPercent !== shown.refundPercent
      ) {
        toast.info(t("refundChanged"))
        return
      }
      const result = await cancelBookingAction(bookingId)
      if (!result.ok) {
        toast.error(errorMessage(result.error))
        return
      }
      toast.success(
        result.refund.refundCents > 0
          ? t("cancelledRefund", {
              amount: formatMoney(
                result.refund.refundCents,
                locale,
                result.refund.currency
              ),
            })
          : t("cancelled")
      )
      setCancelOpen(false)
      router.push(`${SPACE_BASE}/sessions`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function handleReschedule() {
    setPending(true)
    try {
      const duration = new Date(endsAt).getTime() - new Date(startsAt).getTime()
      const nextStart = fromDatetimeLocalValue(newStart, timezone)
      const nextEnd = new Date(
        new Date(nextStart).getTime() + duration
      ).toISOString()
      const result = await rescheduleBookingAction(bookingId, {
        startsAt: nextStart,
        endsAt: nextEnd,
      })
      if (!result.ok) {
        toast.error(errorMessage(result.error))
        return
      }
      toast.success(t("rescheduled"))
      setRescheduleOpen(false)
      router.refresh()
    } catch {
      toast.error(te("validation"))
    } finally {
      setPending(false)
    }
  }

  const changeLine = !mutable
    ? t("policyTooLate")
    : rescheduleUntil === null
      ? t(paid ? "rescheduleClosedPaid" : "rescheduleClosed")
      : // The refund is named only when both run to the same moment.
        t(
          paid && current?.fullRefundUntil === rescheduleUntil
            ? "rescheduleUntilPaid"
            : "rescheduleUntil",
          { date: formatDateTime(rescheduleUntil, locale, timezone) }
        )

  return (
    <div className="space-y-3">
      {/* One sentence, with the date where there is one. */}
      {changeLine ? (
        <p className="text-sm text-pretty text-muted-foreground">
          {changeLine}
        </p>
      ) : null}
      {mutable ? (
        <div className="flex flex-wrap gap-2">
          {canReschedule ? (
            <Button
              variant="outline"
              isDisabled={pending}
              onPress={openReschedule}
            >
              {t("reschedule")}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            isDisabled={pending}
            onPress={openCancel}
            data-testid="member-cancel-session"
          >
            {t("cancel")}
          </Button>
        </div>
      ) : null}

      <AlertDialog isOpen={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
          {current
            ? refundCopy(current).map((line) => (
                <AlertDialogDescription key={line}>
                  {line}
                </AlertDialogDescription>
              ))
            : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={pending}
            onPress={handleCancel}
            data-testid="member-cancel-confirm"
          >
            {pending ? t("cancelling") : t("cancelConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>

      <Dialog isOpen={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogHeader>
          <DialogTitle>{t("rescheduleTitle")}</DialogTitle>
          <DialogDescription>{t("rescheduleDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reschedule-start">{t("rescheduleWhen")}</Label>
          <Input
            id="reschedule-start"
            type="datetime-local"
            value={newStart}
            onChange={(event) => setNewStart(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            isDisabled={pending}
            onPress={() => setRescheduleOpen(false)}
          >
            {tc("cancel")}
          </Button>
          <Button isDisabled={pending} onPress={handleReschedule}>
            {pending ? t("rescheduling") : t("rescheduleConfirm")}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
