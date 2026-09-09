"use client"

import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import { elevaPaymentElementAppearance } from "./appearance"

const stripePromises = new Map<string, Promise<Stripe | null>>()

function stripePromiseFor(publishableKey: string): Promise<Stripe | null> {
  const cached = stripePromises.get(publishableKey)
  if (cached) return cached
  const next = loadStripe(publishableKey)
  stripePromises.set(publishableKey, next)
  return next
}

export type BookingPaymentResult =
  | { ok: true; paymentIntentId: string; status: string }
  | { ok: false; message: string }

export function BookingPaymentElement({
  publishableKey,
  clientSecret,
  locale,
  returnUrl,
  billingEmail,
  billingName,
  submitLabel,
  processingLabel,
  failedLabel,
  pendingLabel,
  appearanceTheme = "light",
  onProcessingChange,
  onPaid,
  children,
}: {
  publishableKey: string
  clientSecret: string
  locale: "en" | "pt" | "es"
  returnUrl: string
  billingEmail?: string
  billingName?: string
  submitLabel: string
  processingLabel: string
  failedLabel: string
  pendingLabel: string
  appearanceTheme?: "light" | "dark"
  onProcessingChange?: (isProcessing: boolean) => void
  onPaid: (result: Extract<BookingPaymentResult, { ok: true }>) => void
  children?: ReactNode
}) {
  const stripePromise = useMemo(
    () => stripePromiseFor(publishableKey),
    [publishableKey]
  )
  const appearance = useMemo(
    () => elevaPaymentElementAppearance(appearanceTheme),
    [appearanceTheme]
  )

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        locale,
        appearance,
      }}
    >
      <PaymentForm
        returnUrl={returnUrl}
        billingEmail={billingEmail}
        billingName={billingName}
        submitLabel={submitLabel}
        processingLabel={processingLabel}
        failedLabel={failedLabel}
        pendingLabel={pendingLabel}
        onProcessingChange={onProcessingChange}
        onPaid={onPaid}
      >
        {children}
      </PaymentForm>
    </Elements>
  )
}

function PaymentForm({
  returnUrl,
  billingEmail,
  billingName,
  submitLabel,
  processingLabel,
  failedLabel,
  pendingLabel,
  onProcessingChange,
  onPaid,
  children,
}: {
  returnUrl: string
  billingEmail?: string
  billingName?: string
  submitLabel: string
  processingLabel: string
  failedLabel: string
  pendingLabel: string
  onProcessingChange?: (isProcessing: boolean) => void
  onPaid: (result: Extract<BookingPaymentResult, { ok: true }>) => void
  children?: ReactNode
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  function markProcessing(next: boolean) {
    setIsProcessing(next)
    onProcessingChange?.(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements || isProcessing) return

    markProcessing(true)
    setError(null)

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      })

      if (result.error) {
        setError(result.error.message ?? failedLabel)
        markProcessing(false)
        return
      }

      const intent = result.paymentIntent
      if (
        intent &&
        (intent.status === "succeeded" || intent.status === "processing")
      ) {
        onPaid({
          ok: true,
          paymentIntentId: intent.id,
          status: intent.status,
        })
        return
      }

      setError(
        intent?.status === "requires_payment_method"
          ? failedLabel
          : pendingLabel
      )
      markProcessing(false)
    } catch {
      setError(failedLabel)
      markProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: {
            billingDetails: {
              email: billingEmail,
              name: billingName,
            },
          },
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {children}
      <button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="inline-flex h-10 items-center justify-center rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? processingLabel : submitLabel}
      </button>
    </form>
  )
}
