"use client"

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout"
import type { Stripe } from "@stripe/stripe-js"
// The pure entry adds the Stripe script only when loadStripe() runs, at
// the payment step, not when a booking page imports this module.
import { loadStripe } from "@stripe/stripe-js/pure"
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

/** Stripe's formatted amounts, for an order summary shown outside the form. */
export type BookingCheckoutTotals = {
  subtotal: string
  /** Discount amount (e.g. "€6.00") and its code, when one is applied. */
  discount: { amount: string; code: string } | null
  total: string
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
  /** Collapsed promo field's link, e.g. "Add a promo code". */
  promoAdd: string
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
 * Promotion codes are validated by the Eleva API, which returns a new
 * session with the discount attached (`onPromoCodeChange`); Stripe owns the
 * discounted total shown here.
 */
export function BookingCheckoutPayment({
  publishableKey,
  clientSecret,
  locale,
  appliedPromoCode,
  onPromoCodeChange,
  labels,
  appearanceTheme = "light",
  onProcessingChange,
  onSettled,
  onTotalsChange,
  reassurance,
  children,
}: {
  publishableKey: string
  clientSecret: string
  locale: "en" | "pt" | "es"
  /** Code attached to the current session, if any. */
  appliedPromoCode?: string | null
  /**
   * Asks the API for a session with this code (or none). Resolves to an
   * error message to show, or null once the new session is in place.
   */
  onPromoCodeChange: (code: string | null) => Promise<string | null>
  labels: BookingCheckoutLabels
  appearanceTheme?: "light" | "dark"
  onProcessingChange?: (isProcessing: boolean) => void
  onSettled: (outcome: BookingCheckoutOutcome) => void
  /** Called whenever Stripe's totals change (a code applied or removed). */
  onTotalsChange?: (totals: BookingCheckoutTotals) => void
  /** Lines under the pay button: security, refund deadline, what's next. */
  reassurance?: ReactNode
  /** Shown just above the pay button (e.g. the hold on the time). */
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
        appliedPromoCode={appliedPromoCode ?? null}
        onPromoCodeChange={onPromoCodeChange}
        labels={labels}
        onProcessingChange={onProcessingChange}
        onSettled={onSettled}
        onTotalsChange={onTotalsChange}
        reassurance={reassurance}
      >
        {children}
      </CheckoutForm>
    </CheckoutElementsProvider>
  )
}

function CheckoutForm({
  appliedPromoCode,
  onPromoCodeChange,
  labels,
  onProcessingChange,
  onSettled,
  onTotalsChange,
  reassurance,
  children,
}: {
  appliedPromoCode: string | null
  onPromoCodeChange: (code: string | null) => Promise<string | null>
  labels: BookingCheckoutLabels
  onProcessingChange?: (isProcessing: boolean) => void
  onSettled: (outcome: BookingCheckoutOutcome) => void
  onTotalsChange?: (totals: BookingCheckoutTotals) => void
  reassurance?: ReactNode
  children?: ReactNode
}) {
  const state = useCheckoutElements()
  const [promo, setPromo] = useState(appliedPromoCode ?? "")
  // The promo field stays a quiet link until she asks for it.
  const [promoOpen, setPromoOpen] = useState(Boolean(appliedPromoCode))
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const checkout = state.type === "success" ? state.checkout : null
  const discount = appliedPromoCode
    ? (checkout?.discountAmounts?.[0] ?? null)
    : null

  const subtotalAmount = checkout?.total.subtotal.amount
  const discountAmount = discount ? checkout?.total.discount.amount : null
  const totalAmount = checkout?.total.total.amount
  useEffect(() => {
    if (!subtotalAmount || !totalAmount) return
    onTotalsChange?.({
      subtotal: subtotalAmount,
      discount:
        discountAmount && appliedPromoCode
          ? { amount: discountAmount, code: appliedPromoCode }
          : null,
      total: totalAmount,
    })
  }, [
    subtotalAmount,
    discountAmount,
    totalAmount,
    appliedPromoCode,
    onTotalsChange,
  ])

  async function changePromo(code: string | null) {
    setPromoBusy(true)
    setPromoError(null)
    // On success the provider remounts with the new session.
    const message = await onPromoCodeChange(code)
    setPromoBusy(false)
    if (message) setPromoError(message)
    else if (!code) setPromo("")
  }

  function applyPromo() {
    const code = promo.trim().toUpperCase()
    if (code.length < 2 || promoBusy || isProcessing || appliedPromoCode) {
      return
    }
    void changePromo(code)
  }

  function markProcessing(next: boolean) {
    setIsProcessing(next)
    onProcessingChange?.(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Not gated on `canConfirm`: confirm() surfaces Stripe's own field errors,
    // which a silently disabled button would hide.
    if (!checkout || isProcessing || promoBusy) return
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
  const promoField = (
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
          value={appliedPromoCode ?? promo}
          onChange={(event) => setPromo(event.target.value)}
          onKeyDown={(event) => {
            // Enter inside the code field must apply it, never submit the
            // payment form (which would charge the card).
            if (event.key !== "Enter") return
            event.preventDefault()
            applyPromo()
          }}
          readOnly={Boolean(appliedPromoCode) || promoBusy}
          aria-invalid={promoError ? true : undefined}
          aria-describedby="booking-promo-help"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={!appliedPromoCode}
          className="h-10 flex-1 rounded-xl border border-input-border bg-background px-3 text-sm uppercase"
        />
        {appliedPromoCode ? (
          <button
            type="button"
            data-testid="booking-promo-remove"
            onClick={() => void changePromo(null)}
            disabled={promoBusy || isProcessing}
            className="h-10 rounded-4xl border border-input px-4 text-sm font-medium disabled:opacity-50"
          >
            {labels.promoRemove}
          </button>
        ) : (
          <button
            type="button"
            data-testid="booking-promo-apply"
            onClick={applyPromo}
            disabled={promoBusy || isProcessing || promo.trim().length < 2}
            className="h-10 rounded-4xl border border-input px-4 text-sm font-medium disabled:opacity-50"
          >
            {labels.promoApply}
          </button>
        )}
      </div>
      <p
        id="booking-promo-help"
        role={promoError ? "alert" : undefined}
        className={
          promoError
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {promoError ?? labels.promoHint}
      </p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <PaymentElement options={{ layout: "tabs" }} />

      {promoOpen || appliedPromoCode ? (
        promoField
      ) : (
        <button
          type="button"
          data-testid="booking-promo-open"
          onClick={() => setPromoOpen(true)}
          className="self-start rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
        >
          {labels.promoAdd}
        </button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* On phones the total and the button stay in reach at the bottom. */}
      <div
        data-testid="booking-pay-bar"
        className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
      >
        {children}
        <div
          className="flex items-baseline justify-between gap-3 text-sm sm:hidden"
          data-testid="booking-checkout-totals"
        >
          <span className="font-medium">{labels.total}</span>
          <span className="text-base font-semibold">{total.total.amount}</span>
        </div>
        <button
          type="submit"
          data-testid="booking-pay-submit"
          disabled={isProcessing || promoBusy}
          className="inline-flex h-11 items-center justify-center rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? labels.processing : labels.pay(total.total.amount)}
        </button>
      </div>
      {reassurance}
    </form>
  )
}
