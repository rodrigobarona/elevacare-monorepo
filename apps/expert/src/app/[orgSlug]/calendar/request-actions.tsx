"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  EXPERT_DECLINE_REASONS,
  type ExpertDeclineReason,
} from "@eleva/config/cancellation-policy"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { Button } from "@eleva/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  acceptCalendarBookingAction,
  declineCalendarBookingAction,
} from "./actions"

/**
 * A request to book: accept it, or decline it. Declining asks first: the
 * member is told and refunded in full, and it cannot be undone.
 */
export function RequestActions({
  bookingId,
  memberName,
  onSettled,
}: {
  bookingId: string
  /** The member's first name, when there is one. */
  memberName: string | null
  onSettled: (status: "confirmed" | "cancelled") => void
}) {
  const t = useTranslations("calendar")
  const reasonId = React.useId()
  const hintId = React.useId()
  const [reason, setReason] = React.useState<ExpertDeclineReason | null>(null)
  const [declineOpen, setDeclineOpen] = React.useState(false)
  const [declineFailed, setDeclineFailed] = React.useState(false)
  const [pending, setPending] = React.useState<"accept" | "decline" | null>(
    null
  )

  async function accept() {
    setPending("accept")
    // A dropped connection rejects: the buttons must come back either way.
    const result = await acceptCalendarBookingAction(bookingId).catch(() => ({
      ok: false as const,
      error: "requestFailed",
    }))
    setPending(null)
    if (!result.ok) {
      toast.error(
        result.error === "requestExpired"
          ? t("requestExpired")
          : t("requestFailed")
      )
      return
    }
    toast.success(t("accepted"))
    onSettled("confirmed")
  }

  async function decline() {
    setPending("decline")
    setDeclineFailed(false)
    const result = await declineCalendarBookingAction(
      bookingId,
      reason ?? undefined
    ).catch(() => ({ ok: false as const, error: "requestFailed" }))
    setPending(null)
    if (!result.ok) {
      // Worth another try: the reason chosen stays in the dialog.
      setDeclineFailed(true)
      return
    }
    setDeclineOpen(false)
    toast.success(t("declined"))
    onSettled("cancelled")
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onPress={() => void accept()} isDisabled={pending !== null}>
          {t("accept")}
        </Button>
        <Button
          variant="outline"
          data-testid="calendar-decline-request"
          onPress={() => {
            setDeclineFailed(false)
            setDeclineOpen(true)
          }}
          isDisabled={pending !== null}
        >
          {t("decline")}
        </Button>
      </div>
      <AlertDialog
        isOpen={declineOpen}
        onOpenChange={(open) => {
          if (pending === null) setDeclineOpen(open)
        }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("declineRequest.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("declineRequest.description", {
              name: memberName ?? t("memberUnknown"),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <span id={reasonId} className="text-sm font-medium">
            {t("declineRequest.reasonLabel")}
          </span>
          {/* A short list on purpose: what the member wrote when asking is
              health information, and no typed answer about it is stored. */}
          <Select
            aria-labelledby={reasonId}
            aria-describedby={hintId}
            placeholder={t("declineRequest.reasonPlaceholder")}
            selectedKey={reason}
            onSelectionChange={(key) => {
              const chosen = EXPERT_DECLINE_REASONS.find((r) => r === key)
              setReason(chosen ?? null)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPERT_DECLINE_REASONS.map((value) => (
                <SelectItem key={value} id={value}>
                  {t(`declineRequest.reasons.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id={hintId} className="text-xs text-muted-foreground">
            {t("declineRequest.reasonHint")}
          </p>
        </div>
        {declineFailed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("requestFailed")}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus isDisabled={pending !== null}>
            {t("declineRequest.keep")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={pending !== null}
            data-testid="calendar-decline-request-confirm"
            onPress={() => void decline()}
          >
            {pending === "decline"
              ? t("declineRequest.confirming")
              : t("declineRequest.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  )
}
