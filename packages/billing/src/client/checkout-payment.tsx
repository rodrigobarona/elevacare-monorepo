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
  const barRef = useRef<HTMLDivElement>(null)

  // Below desktop the pay bar sticks to the bottom: keep focused fields
  // clear of it (WCAG 2.4.11) while the form is on screen.
  useEffect(() => {
    const root = document.documentElement
    const bar = barRef.current
    if (!bar) return
    const narrow = window.matchMedia("(max-width: 1023px)")
    const update = () => {
      root.style.scrollPaddingBottom = narrow.matches
        ? `${bar.offsetHeight + 16}px`
        : ""
    }
    update()
    narrow.addEventListener("change", update)
    const resize = new ResizeObserver(update)
    resize.observe(bar)
    return () => {
      narrow.removeEventListener("change", update)
      resize.disconnect()
      root.style.scrollPaddingBottom = ""
    }
  }, [state.type])
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

  // The hold (and its last-minute warning) stays visible while Stripe loads
  // or if it fails to load: she may still need to keep her time.
  if (state.type === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {labels.loading}
        </p>
        {children}
      </div>
    )
  }
  if (state.type === "error" || !checkout) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">
          {labels.loadFailed}
        </p>
        {children}
      </div>
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
          className="inline-flex min-h-6 items-center self-start rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
        >
          {labels.promoAdd}
        </button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Below desktop the total and Pay stay in reach at the bottom: one
          row, opaque, about 100px tall. */}
      <div
        ref={barRef}
        data-testid="booking-pay-bar"
        className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_24px_-16px_rgb(0_0_0/0.25)] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:gap-3 lg:border-0 lg:p-0 lg:shadow-none"
      >
        {children}
        <div className="flex items-center gap-4">
          <div
            className="min-w-0 shrink-0 lg:hidden"
            data-testid="booking-checkout-totals"
          >
            <p className="text-xs text-muted-foreground">{labels.total}</p>
            <p className="text-lg leading-tight font-semibold">
              {total.total.amount}
            </p>
            {discount ? (
              <p className="text-xs text-muted-foreground">
                −{total.discount.amount} · {appliedPromoCode}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            data-testid="booking-pay-submit"
            disabled={isProcessing || promoBusy}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-4xl bg-primary px-6 text-base font-semibold text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? labels.processing : labels.pay(total.total.amount)}
          </button>
        </div>
      </div>
      {reassurance}
    </form>
  )
}
