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
import { cancelBookingAction, rescheduleBookingAction } from "../actions"
import {
  formatDateTime,
  formatMoney,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/member-format"

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
  orgSlug: string
  bookingId: string
  startsAt: string
  endsAt: string
  timezone: string
  locale: string
  /** Null when the booking can no longer be changed by the member. */
  quote: CancellationQuote | null
}

export function SessionActions({
  orgSlug,
  bookingId,
  startsAt,
  endsAt,
  timezone,
  locale,
  quote,
}: SessionActionsProps) {
  const t = useTranslations("sessions")
  const te = useTranslations("errors")
  const tc = useTranslations("common")
  const router = useRouter()
  const mutable = quote !== null
  const canReschedule = quote?.refundPercent === 100
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

  async function handleCancel() {
    setPending(true)
    try {
      const result = await cancelBookingAction(orgSlug, bookingId)
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
      router.push(`/${orgSlug}/sessions`)
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
      const result = await rescheduleBookingAction(orgSlug, bookingId, {
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

  return (
    <div className="space-y-3">
      {!mutable ? (
        <p className="text-sm text-muted-foreground">{t("policyTooLate")}</p>
      ) : !canReschedule ? (
        <p className="text-sm text-muted-foreground">
          {t("rescheduleUnavailable")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          isDisabled={!canReschedule}
          onPress={() => setRescheduleOpen(true)}
        >
          {t("reschedule")}
        </Button>
        <Button
          variant="destructive"
          isDisabled={!mutable}
          onPress={() => setCancelOpen(true)}
          data-testid="member-cancel-session"
        >
          {t("cancel")}
        </Button>
      </div>

      <AlertDialog isOpen={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
          {quote
            ? refundCopy(quote).map((line) => (
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
