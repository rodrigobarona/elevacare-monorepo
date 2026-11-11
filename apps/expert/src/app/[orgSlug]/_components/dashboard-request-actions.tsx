"use client"

import { useRouter } from "next/navigation"
import { RequestActions } from "../calendar/request-actions"

export function DashboardRequestActions({
  bookingId,
  memberName,
}: {
  bookingId: string
  memberName: string | null
}) {
  const router = useRouter()
  return (
    <RequestActions
      bookingId={bookingId}
      memberName={memberName}
      onSettled={() => router.refresh()}
    />
  )
}
