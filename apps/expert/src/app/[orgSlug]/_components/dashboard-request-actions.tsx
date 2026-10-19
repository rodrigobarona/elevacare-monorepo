"use client"

import { useRouter } from "next/navigation"
import { RequestActions } from "../calendar/request-actions"

export function DashboardRequestActions({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  return (
    <RequestActions bookingId={bookingId} onSettled={() => router.refresh()} />
  )
}
