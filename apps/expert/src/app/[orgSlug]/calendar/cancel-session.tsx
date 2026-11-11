"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { Button } from "@eleva/ui/components/button"
import { Textarea } from "@eleva/ui/components/textarea"
import { cancelCalendarBookingAction } from "./actions"

const REASON_MAX_LENGTH = 180

/**
 * The expert cancels a confirmed session that has not started. It asks
 * first: the member is told at once and refunded in full, and it cannot
 * be undone.
 */
export function CancelSession({
  bookingId,
  memberName,
  onCancelled,
}: {
  bookingId: string
  /** First name, or the word for a member when there is none. */
  memberName: string
  onCancelled: () => void
}) {
  const t = useTranslations("calendar.cancelSession")
  const reasonId = React.useId()
  const [isOpen, setIsOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState(false)

  async function confirm() {
    setPending(true)
    // A dropped connection rejects: the buttons must come back either way.
    const result = await cancelCalendarBookingAction(
      bookingId,
      reason.trim() ? reason.trim() : undefined
    ).catch(() => ({ ok: false as const, error: "cancelFailed" }))
    setPending(false)
    if (!result.ok) {
      toast.error(
        result.error === "cancelTooLate"
          ? t("tooLate")
          : result.error === "cancelChanged"
            ? t("changed")
            : t("failed")
      )
      return
    }
    setIsOpen(false)
    toast.success(result.data.refundCents > 0 ? t("doneRefunded") : t("done"))
    onCancelled()
  }

  return (
    <>
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        data-testid="calendar-cancel-session"
        onPress={() => setIsOpen(true)}
      >
        {t("open")}
      </Button>
      <AlertDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!pending) setIsOpen(open)
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { name: memberName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor={reasonId} className="text-sm font-medium">
            {t("reasonLabel")}
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("reasonHint")}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending}>
            {t("keep")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            isPending={pending}
            data-testid="calendar-cancel-session-confirm"
            onPress={() => void confirm()}
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  )
}
