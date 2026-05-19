"use client"

import * as React from "react"
import {
  initElevaEmbeddedCheckout,
  type EmbeddedCheckout,
} from "@eleva/billing/embedded"
import { createApiClient, type BillingTier } from "@eleva/api-client"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"

interface Props {
  apiBaseUrl: string
  stripePublishableKey: string
}

const TIERS: Array<{ value: BillingTier; label: string; description: string }> =
  [
    {
      value: "expert_community",
      label: "Expert Community",
      description: "Base expert subscription for community access.",
    },
    {
      value: "expert_top",
      label: "Top Expert",
      description: "Priority placement and advanced expert features.",
    },
    {
      value: "clinic_starter",
      label: "Clinic Starter",
      description: "Starter subscription for small clinic teams.",
    },
    {
      value: "clinic_growth",
      label: "Clinic Growth",
      description: "Expanded subscription for growing clinic teams.",
    },
  ]

export function BillingClient({ apiBaseUrl, stripePublishableKey }: Props) {
  const [tier, setTier] = React.useState<BillingTier>("expert_top")
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const checkoutContainerRef = React.useRef<HTMLDivElement | null>(null)
  const checkoutRef = React.useRef<EmbeddedCheckout | null>(null)

  const api = React.useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )

  React.useEffect(() => {
    let cancelled = false

    async function mountCheckout() {
      if (!clientSecret || !checkoutContainerRef.current) return
      if (!stripePublishableKey) {
        setError("Stripe publishable key is not configured.")
        return
      }

      checkoutRef.current?.destroy()
      const checkout = await initElevaEmbeddedCheckout({
        publishableKey: stripePublishableKey,
        clientSecret,
      })
      if (cancelled || !checkoutContainerRef.current) {
        checkout.destroy()
        return
      }
      checkout.mount(checkoutContainerRef.current)
      checkoutRef.current = checkout
    }

    void mountCheckout()

    return () => {
      cancelled = true
      checkoutRef.current?.destroy()
      checkoutRef.current = null
    }
  }, [clientSecret, stripePublishableKey])

  async function startCheckout() {
    setLoading("checkout")
    setError(null)
    try {
      const result = await api.billing.checkout({
        tier,
        returnUrl: `${window.location.origin}/account/billing/return?checkout_session_id={CHECKOUT_SESSION_ID}`,
      })
      setClientSecret(result.clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.")
    } finally {
      setLoading(null)
    }
  }

  async function openPortal() {
    setLoading("portal")
    setError(null)
    try {
      const result = await api.billing.portal({
        returnUrl: window.location.href,
      })
      window.location.assign(result.url)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to open billing portal."
      )
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {TIERS.map((option) => (
          <Card
            key={option.value}
            className={
              tier === option.value ? "border-primary ring-1 ring-primary" : ""
            }
          >
            <CardHeader>
              <CardTitle>{option.label}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                type="button"
                variant={tier === option.value ? "default" : "outline"}
                onClick={() => setTier(option.value)}
              >
                {tier === option.value ? "Selected" : "Select"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription checkout</CardTitle>
          <CardDescription>
            Start an embedded Stripe Checkout session for the selected plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientSecret ? (
            <div ref={checkoutContainerRef} className="min-h-[640px]" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose a plan, then start checkout to subscribe or upgrade.
            </p>
          )}
        </CardContent>
        <CardFooter className="gap-3">
          <Button
            type="button"
            onClick={() => void startCheckout()}
            disabled={loading === "checkout"}
          >
            {loading === "checkout" ? "Starting..." : "Start checkout"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void openPortal()}
            disabled={loading === "portal"}
          >
            {loading === "portal" ? "Opening..." : "Manage in portal"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
