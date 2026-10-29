"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout"
import { loadStripe, type Stripe } from "@stripe/stripe-js"
import { elevaPaymentElementAppearance } from "./appearance"

const stripePromises = new Map<string, Promise<Stripe | null>>()

function stripePromiseFor(
  publishableKey: string,
  locale: "en" | "pt" | "es"
): Promise<Stripe | null> {
  const key = `${publishableKey}:${locale}`
  const cached = stripePromises.get(key)
  if (cached) return cached
  const next = loadStripe(publishableKey, { locale })
  stripePromises.set(key, next)
  return next
}

/** `paid`: confirm the booking now. `pending`: MB WAY etc. settle by webhook. */
export type BookingCheckoutOutcome = { status: "paid" | "pending" }

export type BookingCheckoutLabels = {
  loading: string
  loadFailed: string
  promo: string
  promoHint: string
  promoApply: string
  promoRemove: string
  promoInvalid: string
  subtotal: string
  discount: string
  total: string
  /** Receives Stripe's formatted total, e.g. "€48.00". */
  pay: (total: string) => string
  processing: string
  failed: string
}

/**
 * Paid booking payment on a Stripe Checkout Session (`ui_mode: "elements"`).
 * Promotion codes are applied on the session, so Stripe validates them and
 * owns the discounted total shown here.
 */
export function BookingCheckoutPayment({
  publishableKey,
  clientSecret,
  locale,
  initialPromoCode,
  labels,
  appearanceTheme = "light",
  onProcessingChange,
  onSettled,
  children,
}: {
  publishableKey: string
  clientSecret: string
  locale: "en" | "pt" | "es"
  initialPromoCode?: string
  labels: BookingCheckoutLabels
  appearanceTheme?: "light" | "dark"
  onProcessingChange?: (isProcessing: boolean) => void
  onSettled: (outcome: BookingCheckoutOutcome) => void
  children?: ReactNode
}) {
  const stripePromise = useMemo(
    () => stripePromiseFor(publishableKey, locale),
    [publishableKey, locale]
  )
  const appearance = useMemo(
    () => elevaPaymentElementAppearance(appearanceTheme),
    [appearanceTheme]
  )

  return (
    <CheckoutElementsProvider
      key={clientSecret}
      stripe={stripePromise}
      options={{ clientSecret, elementsOptions: { appearance } }}
    >
      <CheckoutForm
        initialPromoCode={initialPromoCode}
        labels={labels}
        onProcessingChange={onProcessingChange}
        onSettled={onSettled}
      >
        {children}
      </CheckoutForm>
    </CheckoutElementsProvider>
  )
}

function CheckoutForm({
  initialPromoCode,
  labels,
  onProcessingChange,
  onSettled,
  children,
}: {
  initialPromoCode?: string
  labels: BookingCheckoutLabels
  onProcessingChange?: (isProcessing: boolean) => void
  onSettled: (outcome: BookingCheckoutOutcome) => void
  children?: ReactNode
}) {
  const state = useCheckoutElements()
  const [promo, setPromo] = useState(initialPromoCode ?? "")
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const autoApplied = useRef(false)

  const checkout = state.type === "success" ? state.checkout : null
  const applied = checkout?.discountAmounts?.[0] ?? null

  async function applyPromo(code: string) {
    if (!checkout) return
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 2) return
    setPromoBusy(true)
    setPromoError(null)
    const result = await checkout.applyPromotionCode(trimmed)
    setPromoBusy(false)
    if (result.type === "error") setPromoError(labels.promoInvalid)
  }

  async function removePromo() {
    if (!checkout) return
    setPromoBusy(true)
    setPromoError(null)
    await checkout.removePromotionCode()
    setPromo("")
    setPromoBusy(false)
  }

  useEffect(() => {
    if (!checkout || autoApplied.current || !initialPromoCode) return
    autoApplied.current = true
    void applyPromo(initialPromoCode)
    // Apply the code typed earlier in the funnel once, when Stripe is ready.
  }, [checkout, initialPromoCode])

  function markProcessing(next: boolean) {
    setIsProcessing(next)
    onProcessingChange?.(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Not gated on `canConfirm`: confirm() surfaces Stripe's own field errors,
    // which a silently disabled button would hide.
    if (!checkout || isProcessing) return
    markProcessing(true)
    setError(null)
    try {
      const result = await checkout.confirm({ redirect: "if_required" })
      if (result.type === "error") {
        setError(result.error.message || labels.failed)
        markProcessing(false)
        return
      }
      // Stripe's immediate result can still read `open` for a successful
      // card payment; report what it says and let the API decide.
      const status = result.session.status
      onSettled({
        status:
          status.type === "complete" && status.paymentStatus === "paid"
            ? "paid"
            : "pending",
      })
    } catch {
      setError(labels.failed)
      markProcessing(false)
    }
  }

  if (state.type === "loading") {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {labels.loading}
      </p>
    )
  }
  if (state.type === "error" || !checkout) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {labels.loadFailed}
      </p>
    )
  }

  const total = checkout.total
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="booking-promo"
          className="text-sm font-medium text-foreground"
        >
          {labels.promo}
        </label>
        <div className="flex gap-2">
          <input
            id="booking-promo"
            data-testid="booking-promo"
            value={applied ? (applied.promotionCode ?? promo) : promo}
            onChange={(event) => setPromo(event.target.value)}
            onKeyDown={(event) => {
              // Enter inside the code field must apply it, never submit the
              // payment form (which would charge the card).
              if (event.key !== "Enter") return
              event.preventDefault()
              if (!applied && !promoBusy) void applyPromo(promo)
            }}
            readOnly={Boolean(applied) || promoBusy}
            autoComplete="off"
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          {applied ? (
            <button
              type="button"
              onClick={() => void removePromo()}
              disabled={promoBusy || isProcessing}
              className="h-10 rounded-4xl border border-input px-4 text-sm font-medium disabled:opacity-50"
            >
              {labels.promoRemove}
            </button>
          ) : (
            <button
              type="button"
              data-testid="booking-promo-apply"
              onClick={() => void applyPromo(promo)}
              disabled={promoBusy || isProcessing || promo.trim().length < 2}
              className="h-10 rounded-4xl border border-input px-4 text-sm font-medium disabled:opacity-50"
            >
              {labels.promoApply}
            </button>
          )}
        </div>
        {promoError ? (
          <p role="alert" className="text-sm text-destructive">
            {promoError}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.promoHint}</p>
        )}
      </div>

      <dl
        className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"
        data-testid="booking-checkout-totals"
      >
        {applied ? (
          <>
            <dt className="text-muted-foreground">{labels.subtotal}</dt>
            <dd className="text-right">{total.subtotal.amount}</dd>
            <dt className="text-muted-foreground">
              {labels.discount} · {applied.displayName}
            </dt>
            <dd className="text-right">−{total.discount.amount}</dd>
          </>
        ) : null}
        <dt className="font-medium">{labels.total}</dt>
        <dd className="text-right font-medium">{total.total.amount}</dd>
      </dl>

      <PaymentElement options={{ layout: "tabs" }} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {children}
      <button
        type="submit"
        data-testid="booking-pay-submit"
        disabled={isProcessing || promoBusy}
        className="inline-flex h-10 items-center justify-center rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? labels.processing : labels.pay(total.total.amount)}
      </button>
    </form>
  )
}
