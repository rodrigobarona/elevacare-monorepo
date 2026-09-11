"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
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
  canChangeBooking,
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
  status: string
}

export function SessionActions({
  orgSlug,
  bookingId,
  startsAt,
  endsAt,
  timezone,
  status,
}: SessionActionsProps) {
  const t = useTranslations("sessions")
  const te = useTranslations("errors")
  const tc = useTranslations("common")
  const router = useRouter()
  const mutable = canChangeBooking(startsAt, status)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [newStart, setNewStart] = useState(
    toDatetimeLocalValue(startsAt, timezone)
  )

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
      toast.success(t("cancelled"))
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
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          isDisabled={!mutable}
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
          <AlertDialogDescription>
            {t("cancelDescription")}
          </AlertDialogDescription>
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
