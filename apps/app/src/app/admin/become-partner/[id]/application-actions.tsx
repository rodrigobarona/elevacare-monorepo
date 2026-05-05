"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@eleva/ui/components/button"
import { Textarea } from "@eleva/ui/components/textarea"
import { Label } from "@eleva/ui/components/label"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import {
  claimApplicationAction,
  approveApplicationAction,
  rejectApplicationAction,
} from "../actions"

interface Props {
  applicationId: string
  status: string
}

export function ApplicationActions({ applicationId, status }: Props) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showReject, setShowReject] = React.useState(false)
  const [reason, setReason] = React.useState("")

  async function handleClaim() {
    setPending(true)
    setError(null)
    try {
      const result = await claimApplicationAction(applicationId)
      if (!result.ok) setError(result.error)
      else router.refresh()
    } catch {
      setError("claim-failed")
    } finally {
      setPending(false)
    }
  }

  async function handleApprove() {
    setPending(true)
    setError(null)
    try {
      const result = await approveApplicationAction(applicationId)
      if (!result.ok) setError(result.error)
      else {
        if (result.warning) setError(result.warning)
        router.refresh()
      }
    } catch {
      setError("approve-failed")
    } finally {
      setPending(false)
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      setError("A rejection reason is required.")
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await rejectApplicationAction(applicationId, reason)
      if (!result.ok) setError(result.error)
      else router.refresh()
    } catch {
      setError("reject-failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        {status === "submitted" && (
          <Button onClick={handleClaim} disabled={pending} variant="secondary">
            Claim for review
          </Button>
        )}

        <Button onClick={handleApprove} disabled={pending}>
          Approve
        </Button>

        <Button
          onClick={() => setShowReject((v) => !v)}
          disabled={pending}
          variant="destructive"
        >
          Reject
        </Button>
      </div>

      {showReject && (
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="reject-reason">Rejection reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this application is being rejected..."
            rows={3}
          />
          <Button
            onClick={handleReject}
            disabled={pending || !reason.trim()}
            variant="destructive"
            size="sm"
          >
            Confirm rejection
          </Button>
        </div>
      )}
    </div>
  )
}
