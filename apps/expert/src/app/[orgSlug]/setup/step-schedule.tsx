"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { markStepComplete } from "./actions"

interface Props {
  onDone: () => void
}

export function StepSchedule({ onDone }: Props) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [eventName, setEventName] = React.useState("")
  const [duration, setDuration] = React.useState("50")
  const [price, setPrice] = React.useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const result = await markStepComplete("schedule")
    if (result.ok) {
      onDone()
    } else {
      setError(result.error)
    }
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Create your first event type. You can add more event types and configure
        your full schedule after onboarding is complete.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="eventName">Event name</Label>
          <Input
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Initial Consultation"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            min={15}
            max={180}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (&euro;)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="50.00"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        This is a preview of the event type editor. Full scheduling,
        availability rules, and calendar integration will be available soon.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Complete onboarding"}
      </Button>
    </form>
  )
}
