"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@eleva/ui/components/button"
import { Textarea } from "@eleva/ui/components/textarea"
import {
  acceptCalendarBookingAction,
  declineCalendarBookingAction,
} from "./actions"

export function RequestActions({
  bookingId,
  onSettled,
}: {
  bookingId: string
  onSettled: (status: "confirmed" | "cancelled") => void
}) {
  const t = useTranslations("calendar")
  const [note, setNote] = React.useState("")
  const [pending, setPending] = React.useState<"accept" | "decline" | null>(
    null
  )

  async function accept() {
    setPending("accept")
    const result = await acceptCalendarBookingAction(bookingId)
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
    const result = await declineCalendarBookingAction(
      bookingId,
      note.trim() ? note.trim() : undefined
    )
    setPending(null)
    if (!result.ok) {
      toast.error(t("requestFailed"))
      return
    }
    toast.success(t("declined"))
    onSettled("cancelled")
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium">{t("requestPending")}</p>
      <Textarea
        value={note}
        maxLength={180}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("declineNote")}
      />
      <div className="flex flex-wrap gap-2">
        <Button onPress={() => void accept()} isDisabled={pending !== null}>
          {t("accept")}
        </Button>
        <Button
          variant="outline"
          onPress={() => void decline()}
          isDisabled={pending !== null}
        >
          {t("decline")}
        </Button>
      </div>
    </div>
  )
}
