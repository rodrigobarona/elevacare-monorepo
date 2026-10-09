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
  BillingAddressElement,
  CheckoutElementsProvider,
  ContactDetailsElement,
  CurrencySelectorElement,
  ExpressCheckoutElement,
  PaymentElement,
  TaxIdElement,
  useCheckoutElements,
  type StripeCheckoutElementsValue,
} from "@stripe/react-stripe-js/checkout"
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

const EXPRESS_CHECKOUT_OPTIONS = {
  buttonHeight: 48,
  buttonTheme: { applePay: "black" as const, googlePay: "black" as const },
  buttonType: { applePay: "book" as const, googlePay: "book" as const },
  layout: { maxColumns: 2, maxRows: 1, overflow: "auto" as const },
  paymentMethodOrder: ["applePay", "googlePay", "link"],
  paymentMethods: {
    applePay: "always" as const,
    googlePay: "always" as const,
    link: "auto" as const,
  },
  business: { name: "Eleva" },
}

const PAYMENT_ELEMENT_OPTIONS = {
  layout: "tabs" as const,
  wallets: { applePay: "never" as const, googlePay: "never" as const },
  fields: {
    billingDetails: {
      name: "never" as const,
      email: "never" as const,
      phone: "never" as const,
      address: "never" as const,
    },
  },
  business: { name: "Eleva" },
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function paymentIntentIdFromCheckout(
  checkout: StripeCheckoutElementsValue
): string | null {
  const extra = checkout as StripeCheckoutElementsValue & {
    paymentIntent?: { id?: string } | string | null
    paymentIntentId?: string | null
  }
  if (typeof extra.paymentIntentId === "string" && extra.paymentIntentId) {
    return extra.paymentIntentId
  }
  if (typeof extra.paymentIntent === "string" && extra.paymentIntent) {
    return extra.paymentIntent
  }
  if (extra.paymentIntent && typeof extra.paymentIntent === "object") {
    return extra.paymentIntent.id ?? null
  }
  return null
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
  billingPhone,
  billingCountry,
  submitLabel,
  formatPayLabel,
  processingLabel,
  failedLabel,
  pendingLabel,
  promoLabel,
  promoHint,
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
  billingPhone?: string
  billingCountry?: string
  submitLabel: string
  formatPayLabel?: (formattedTotal: string) => string
  processingLabel: string
  failedLabel: string
  pendingLabel: string
  promoLabel: string
  promoHint: string
  appearanceTheme?: "light" | "dark"
  onProcessingChange?: (isProcessing: boolean) => void
  onPaid: (result: Extract<BookingPaymentResult, { ok: true }>) => void
  children?: ReactNode
}) {
  const stripePromise = useMemo(
    () => stripePromiseFor(publishableKey),
    [publishableKey]
  )
  const disableAnimations = prefersReducedMotion()
  const appearance = useMemo(
    () => elevaPaymentElementAppearance(appearanceTheme, { disableAnimations }),
    [appearanceTheme, disableAnimations]
  )

  return (
    <CheckoutElementsProvider
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        adaptivePricing: { allowed: true },
        elementsOptions: { appearance },
        defaultValues: {
          email: billingEmail,
          phoneNumber: billingPhone,
          billingAddress: {
            name: billingName,
            address: {
              country: billingCountry ?? "PT",
            },
          },
        },
      }}
    >
      <PaymentForm
        locale={locale}
        returnUrl={returnUrl}
        billingName={billingName}
        billingPhone={billingPhone}
        billingCountry={billingCountry}
        submitLabel={submitLabel}
        formatPayLabel={formatPayLabel}
        processingLabel={processingLabel}
        failedLabel={failedLabel}
        pendingLabel={pendingLabel}
        promoLabel={promoLabel}
        promoHint={promoHint}
        onProcessingChange={onProcessingChange}
        onPaid={onPaid}
      >
        {children}
      </PaymentForm>
    </CheckoutElementsProvider>
  )
}

function PaymentForm({
  locale,
  returnUrl,
  billingName,
  billingPhone,
  billingCountry,
  submitLabel,
  formatPayLabel,
  processingLabel,
  failedLabel,
  pendingLabel,
  promoLabel,
  promoHint,
  onProcessingChange,
  onPaid,
  children,
}: {
  locale: "en" | "pt" | "es"
  returnUrl: string
  billingName?: string
  billingPhone?: string
  billingCountry?: string
  submitLabel: string
  formatPayLabel?: (formattedTotal: string) => string
  processingLabel: string
  failedLabel: string
  pendingLabel: string
  promoLabel: string
  promoHint: string
  onProcessingChange?: (isProcessing: boolean) => void
  onPaid: (result: Extract<BookingPaymentResult, { ok: true }>) => void
  children?: ReactNode
}) {
  const checkoutState = useCheckoutElements()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [expressVisible, setExpressVisible] = useState(false)

  function markProcessing(next: boolean) {
    setIsProcessing(next)
    onProcessingChange?.(next)
  }

  async function confirmCheckout(
    checkout: StripeCheckoutElementsValue,
    expressCheckoutConfirmEvent?: Parameters<
      StripeCheckoutElementsValue["confirm"]
    >[0] extends infer Args
      ? Args extends { expressCheckoutConfirmEvent?: infer Event }
        ? Event
        : never
      : never
  ) {
    const named = checkout as StripeCheckoutElementsValue & {
      updateIndividualName?: (name: string) => Promise<unknown>
    }
    if (billingName && typeof named.updateIndividualName === "function") {
      await named.updateIndividualName(billingName)
    }
    if (billingPhone) {
      await checkout.updatePhoneNumber(billingPhone)
    }

    const code = promoCode.trim()
    if (code) {
      const applied = await checkout.applyPromotionCode(code)
      if (applied.type === "error") {
        setError(applied.error.message)
        markProcessing(false)
        return
      }
    }

    const result = await checkout.confirm({
      returnUrl,
      redirect: "if_required",
      ...(expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : {}),
    })

    if (result.type === "error") {
      setError(result.error.message || failedLabel)
      markProcessing(false)
      return
    }

    const session = result.session
    const paymentIntentId = paymentIntentIdFromCheckout(
      session as unknown as StripeCheckoutElementsValue
    )
    const paid =
      session.status.type === "complete" &&
      (session.status.paymentStatus === "paid" ||
        session.status.paymentStatus === "no_payment_required")
    const processing = session.status.type === "open"

    if (paid) {
      onPaid({
        ok: true,
        paymentIntentId: paymentIntentId ?? session.id,
        status: "succeeded",
      })
      return
    }

    if (processing && paymentIntentId) {
      onPaid({
        ok: true,
        paymentIntentId,
        status: "processing",
      })
      return
    }

    setError(pendingLabel)
    markProcessing(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checkoutState.type !== "success" || isProcessing) return
    markProcessing(true)
    setError(null)
    try {
      await confirmCheckout(checkoutState.checkout)
    } catch {
      setError(failedLabel)
      markProcessing(false)
    }
  }

  const checkout =
    checkoutState.type === "success" ? checkoutState.checkout : null
  const formattedTotal = checkout?.total.total.amount
  const payLabel =
    formattedTotal && formatPayLabel
      ? formatPayLabel(formattedTotal)
      : submitLabel
  const ready =
    checkoutState.type === "success" && Boolean(checkout?.canConfirm)

  return (
    <form
      onSubmit={handleSubmit}
      data-locale={locale}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{promoLabel}</span>
        <input
          data-testid="booking-promo"
          value={promoCode}
          onChange={(event) => setPromoCode(event.target.value)}
          autoComplete="off"
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        />
        <span className="text-sm text-muted-foreground">{promoHint}</span>
      </label>
      <CurrencySelectorElement />
      <div className={expressVisible ? "block" : "hidden"}>
        <ExpressCheckoutElement
          options={EXPRESS_CHECKOUT_OPTIONS}
          onAvailablePaymentMethodsChange={(event) => {
            const methods = event.paymentMethods
            setExpressVisible(
              Boolean(
                methods &&
                Object.values(methods).some((method) => method?.available)
              )
            )
          }}
          onConfirm={(event) => {
            if (checkoutState.type !== "success" || isProcessing) return
            markProcessing(true)
            setError(null)
            void confirmCheckout(checkoutState.checkout, event).catch(() => {
              setError(failedLabel)
              markProcessing(false)
            })
          }}
        />
      </div>
      {checkout ? (
        <CheckoutPaymentMethodMessaging
          amount={checkout.total.total.minorUnitsAmount}
          currency={checkout.currency}
          countryCode={billingCountry ?? "PT"}
        />
      ) : null}
      <ContactDetailsElement />
      <BillingAddressElement />
      <TaxIdElement
        options={{
          visibility: "always",
          fields: { businessName: "auto" },
          validation: {
            businessName: { required: "never" },
            taxId: { required: "never" },
          },
        }}
      />
      <PaymentElement options={PAYMENT_ELEMENT_OPTIONS} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {children}
      <button
        type="submit"
        data-testid="booking-pay-submit"
        disabled={!ready || isProcessing}
        className="inline-flex h-10 items-center justify-center rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? processingLabel : payLabel}
      </button>
    </form>
  )
}

function CheckoutPaymentMethodMessaging({
  amount,
  currency,
  countryCode,
}: {
  amount: number
  currency: string
  countryCode: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const checkoutState = useCheckoutElements()

  useEffect(() => {
    if (checkoutState.type !== "success" || !hostRef.current) return
    const checkout = checkoutState.checkout as StripeCheckoutElementsValue & {
      createPaymentMethodMessagingElement?: (options: {
        amount: number
        currency: string
        countryCode: string
      }) => { mount: (node: HTMLElement) => void; destroy: () => void }
    }
    if (typeof checkout.createPaymentMethodMessagingElement !== "function") {
      return
    }
    const element = checkout.createPaymentMethodMessagingElement({
      amount,
      currency: currency.toUpperCase(),
      countryCode,
    })
    element.mount(hostRef.current)
    return () => {
      element.destroy()
    }
  }, [amount, checkoutState, countryCode, currency])

  return <div ref={hostRef} />
}
