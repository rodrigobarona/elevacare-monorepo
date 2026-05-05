"use client"

import * as React from "react"
import { Button } from "@eleva/ui/components/button"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Badge } from "@eleva/ui/components/badge"
import { markStepComplete } from "./actions"
import type { OnboardingProfile } from "./onboarding-wizard"

interface Props {
  profile: OnboardingProfile
  apiBaseUrl: string
  onDone: () => void
}

export function StepIdentity({ profile, apiBaseUrl, onDone }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isVerified = profile.stripeIdentityStatus === "verified"
  const isProcessing = profile.stripeIdentityStatus === "processing"

  async function handleStartVerification() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${apiBaseUrl}/stripe/identity`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to create verification session")
      }

      const { clientSecret } = (await res.json()) as { clientSecret: string }

      const { loadStripe } = await import("@stripe/stripe-js")
      const stripe = await loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
      )
      if (!stripe) throw new Error("Stripe failed to load")

      const result = await stripe.verifyIdentity(clientSecret)
      if (result.error) {
        setError(result.error.message ?? "Verification failed")
      } else {
        const markResult = await markStepComplete("identity")
        if (markResult.ok) onDone()
        else setError(markResult.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (isVerified) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-green-500 text-green-700">
            Verified
          </Badge>
          <span className="text-sm text-muted-foreground">
            Your identity has been verified.
          </span>
        </div>
        <Button
          size="sm"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setError(null)
            try {
              const r = await markStepComplete("identity")
              if (r.ok) onDone()
              else setError(r.error)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unknown error")
            } finally {
              setLoading(false)
            }
          }}
        >
          Continue
        </Button>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Processing</Badge>
          <span className="text-sm text-muted-foreground">
            Your verification is being reviewed. This may take a few minutes.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onDone}>
          Continue for now
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        We need to verify your identity as part of the onboarding process. This
        uses Stripe Identity for a secure, inline verification — no redirects
        needed.
      </p>

      <Button onClick={handleStartVerification} disabled={loading}>
        {loading ? "Loading..." : "Start identity verification"}
      </Button>
    </div>
  )
}
