"use client"

import { useRouter } from "next/navigation"
import { RequestActions } from "../calendar/request-actions"

export function DashboardRequestActions({
  bookingId,
  memberName,
  sessionSummary,
}: {
  bookingId: string
  memberName: string | null
  /** Which request this is, shown before it is declined. */
  sessionSummary: string
}) {
  const router = useRouter()
  return (
    <RequestActions
      bookingId={bookingId}
      memberName={memberName}
      sessionSummary={sessionSummary}
      onSettled={() => router.refresh()}
      onChanged={() => router.refresh()}
    />
  )
}
