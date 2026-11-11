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
import {
  EXPERT_CANCEL_REASONS,
  type ExpertCancelReason,
} from "@eleva/config/cancellation-policy"
import { Button } from "@eleva/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { cancelCalendarBookingAction } from "./actions"

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
  /** The member's first name, when there is one. */
  memberName: string | null
  onCancelled: () => void
  /** The session is no longer as shown: close and load the week again. */
  onChanged: () => void
}) {
  const t = useTranslations("calendar.cancelSession")
  const reasonId = React.useId()
  const hintId = React.useId()
  const [isOpen, setIsOpen] = React.useState(false)
  const [reason, setReason] = React.useState<ExpertCancelReason | null>(null)
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  async function confirm() {
    setPending(true)
    setFailed(false)
    // A dropped connection rejects: the buttons must come back either way.
    const result = await cancelCalendarBookingAction(
      bookingId,
      startsAt,
      reason ?? undefined
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
      // Worth another try: the reason chosen stays in the dialog.
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
              {memberName
                ? t("description", { name: memberName })
                : t("descriptionNoName")}
            </span>
            <span className="mt-2 block">{t("slotNote")}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <span id={reasonId} className="text-sm font-medium">
            {t("reasonLabel")}
          </span>
          {/* A short list on purpose: no free text, so no health detail
              about anyone ends up on the booking record. */}
          <Select
            className="w-full"
            aria-labelledby={reasonId}
            aria-describedby={hintId}
            placeholder={t("reasonPlaceholder")}
            selectedKey={reason}
            onSelectionChange={(key) => {
              const chosen = EXPERT_CANCEL_REASONS.find((r) => r === key)
              setReason(chosen ?? null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPERT_CANCEL_REASONS.map((value) => (
                <SelectItem key={value} id={value}>
                  {t(`reasons.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
