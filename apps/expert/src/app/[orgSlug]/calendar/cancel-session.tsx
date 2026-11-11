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
  startsAt,
  sessionSummary,
  memberName,
  onCancelled,
  onChanged,
}: {
  bookingId: string
  /** The start shown to the expert; a session moved since is not cancelled. */
  startsAt: string
  /** "First visit · Monday 30 November, 09:00–10:00": which session this is. */
  sessionSummary: string
  /** First name, or the word for a member when there is none. */
  memberName: string
  onCancelled: () => void
  /** The session is no longer as shown: close and load the week again. */
  onChanged: () => void
}) {
  const t = useTranslations("calendar.cancelSession")
  const reasonId = React.useId()
  const hintId = React.useId()
  const [isOpen, setIsOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  async function confirm() {
    setPending(true)
    setFailed(false)
    // A dropped connection rejects: the buttons must come back either way.
    const result = await cancelCalendarBookingAction(
      bookingId,
      startsAt,
      reason.trim() ? reason.trim() : undefined
    ).catch(() => ({ ok: false as const, error: "cancelFailed" }))
    setPending(false)
    if (!result.ok) {
      if (
        result.error === "cancelTooLate" ||
        result.error === "cancelChanged"
      ) {
        // Trying again cannot help: say why, and show the week as it is now.
        setIsOpen(false)
        toast.error(
          result.error === "cancelTooLate" ? t("tooLate") : t("changed")
        )
        onChanged()
        return
      }
      // Worth another try: the reason typed so far stays in the dialog.
      setFailed(true)
      return
    }
    setIsOpen(false)
    if (result.data.alreadyCancelled) {
      toast.info(t("alreadyCancelled"))
      onChanged()
      return
    }
    toast.success(result.data.refundCents > 0 ? t("doneRefunded") : t("done"))
    onCancelled()
  }

  return (
    <>
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        data-testid="calendar-cancel-session"
        onPress={() => {
          setFailed(false)
          setIsOpen(true)
        }}
      >
        {t("open")}
      </Button>
      <AlertDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!pending) setIsOpen(open)
        }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-medium text-foreground">
              {sessionSummary}
            </span>
            <span className="mt-2 block">
              {t("description", { name: memberName })}
            </span>
            <span className="mt-2 block">{t("slotNote")}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor={reasonId} className="text-sm font-medium">
            {t("reasonLabel")}
          </label>
          <Textarea
            id={reasonId}
            aria-describedby={hintId}
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            {t("reasonHint")}
          </p>
        </div>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus isDisabled={pending}>
            {t("keep")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={pending}
            data-testid="calendar-cancel-session-confirm"
            onPress={() => void confirm()}
          >
            {pending ? t("confirming") : t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  )
}
