import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

const create = vi.fn()
const list = vi.fn()
const promotionList = vi.fn()
const customersCreate = vi.fn()

vi.mock("./client", () => ({
  stripe: () => ({
    checkout: { sessions: { create, list } },
    customers: { create: customersCreate },
    promotionCodes: { list: promotionList },
  }),
}))

const envState: { STRIPE_PMC_BOOKING: string | undefined } = {
  STRIPE_PMC_BOOKING: "pmc_test_booking",
}

vi.mock("@eleva/config/env", () => ({
  env: () => envState,
}))

const {
  bookingCheckoutSnapshotFromSession,
  checkoutSessionExpiresAt,
  checkoutSessionIdempotencyKey,
  createBookingCheckoutSession,
  isBookingPaymentCheckoutSession,
  resolveBookingCustomer,
  resolveBookingPromotionCode,
  retrieveBookingCheckoutForIntent,
} = await import("./booking-checkout-session")

describe("resolveBookingPromotionCode", () => {
  beforeEach(() => promotionList.mockReset())

  function promo(
    coupon: Record<string, unknown>,
    metadata: Record<string, string> = {}
  ) {
    return {
      data: [
        {
          id: "promo_1",
          metadata,
          promotion: {
            type: "coupon",
            coupon: { valid: true, metadata: {}, ...coupon },
          },
        },
      ],
    }
  }

  it("accepts a booking-scoped percentage code", async () => {
    promotionList.mockResolvedValue(
      promo({ percent_off: 20 }, { eleva_scope: "booking" })
    )
    await expect(
      resolveBookingPromotionCode(" spring20 ", 6000)
    ).resolves.toEqual({
      ok: true,
      promotionCodeId: "promo_1",
    })
    expect(promotionList).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SPRING20", active: true })
    )
  })

  it("accepts a code whose coupon carries the booking scope", async () => {
    promotionList.mockResolvedValue(
      promo({
        amount_off: 1000,
        currency: "eur",
        metadata: { eleva_scope: "booking" },
      })
    )
    await expect(
      resolveBookingPromotionCode("TEN", 6000)
    ).resolves.toMatchObject({
      ok: true,
    })
  })

  it("rejects a fixed amount that covers the whole price", async () => {
    promotionList.mockResolvedValue(
      promo({ amount_off: 6000, currency: "eur" }, { eleva_scope: "booking" })
    )
    await expect(resolveBookingPromotionCode("ALL", 6000)).resolves.toEqual({
      ok: false,
      reason: "not_bookable",
    })
    await expect(
      resolveBookingPromotionCode("ALL", 7000)
    ).resolves.toMatchObject({
      ok: true,
    })
  })

  it("rejects unknown, unscoped, 100%-off and non-EUR codes", async () => {
    promotionList.mockResolvedValueOnce({ data: [] })
    await expect(resolveBookingPromotionCode("NOPE", 6000)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    })
    promotionList.mockResolvedValueOnce(promo({ percent_off: 20 }))
    await expect(resolveBookingPromotionCode("SUBS", 6000)).resolves.toEqual({
      ok: false,
      reason: "not_bookable",
    })
    promotionList.mockResolvedValueOnce(
      promo({ percent_off: 100 }, { eleva_scope: "booking" })
    )
    await expect(resolveBookingPromotionCode("FREE", 6000)).resolves.toEqual({
      ok: false,
      reason: "not_bookable",
    })
    promotionList.mockResolvedValueOnce(
      promo({ amount_off: 500, currency: "usd" }, { eleva_scope: "booking" })
    )
    await expect(resolveBookingPromotionCode("USD", 6000)).resolves.toEqual({
      ok: false,
      reason: "not_bookable",
    })
  })
})

describe("retrieveBookingCheckoutForIntent", () => {
  beforeEach(() => list.mockReset())

  it("returns the booking session snapshot that created the intent", async () => {
    list.mockResolvedValue({
      data: [
        {
          id: "cs_1",
          mode: "payment",
          metadata: { eleva_booking_id: "b1", reservationId: "r1" },
          payment_intent: "pi_1",
          amount_subtotal: 6000,
          amount_total: 4800,
          currency: "eur",
          total_details: { amount_discount: 1200 },
          customer_details: null,
          discounts: [],
        },
      ],
    })
    const snapshot = await retrieveBookingCheckoutForIntent("pi_1")
    expect(list).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 })
    expect(snapshot).toEqual(
      expect.objectContaining({
        checkoutSessionId: "cs_1",
        amountSubtotal: 6000,
        amountTotal: 4800,
        discountCents: 1200,
      })
    )
  })

  it("returns null for a plain PaymentIntent", async () => {
    list.mockResolvedValue({ data: [] })
    await expect(retrieveBookingCheckoutForIntent("pi_2")).resolves.toBeNull()
  })
})

describe("checkoutSessionIdempotencyKey", () => {
  it("is stable per reservation id", () => {
    expect(
      checkoutSessionIdempotencyKey("22222222-2222-4222-8222-222222222222")
    ).toBe("cs:22222222-2222-4222-8222-222222222222")
  })
})

describe("createBookingCheckoutSession", () => {
  beforeEach(() => {
    create.mockReset()
  })

  it("creates an elements Checkout Session that keeps Eleva out of the seller role", async () => {
    create.mockResolvedValue({
      id: "cs_1",
      client_secret: "cs_1_secret",
      payment_intent: "pi_1",
    })
    await createBookingCheckoutSession({
      amountCents: 6000,
      serviceName: "First visit",
      bookingId: "11111111-1111-4111-8111-111111111111",
      reservationId: "22222222-2222-4222-8222-222222222222",
      expertOrgId: "33333333-3333-4333-8333-333333333333",
      customerId: "cus_member",
      returnUrl: "https://eleva.care/anaquick/quick-chat",
      idempotencyKey: "cs:22222222-2222-4222-8222-222222222222",
      expiresAt: 1_800_001_860,
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        ui_mode: "elements",
        customer: "cus_member",
        billing_address_collection: "auto",
        payment_method_configuration: "pmc_test_booking",
        expires_at: 1_800_001_860,
        payment_intent_data: expect.objectContaining({
          transfer_group: "11111111-1111-4111-8111-111111111111",
        }),
      }),
      { idempotencyKey: "cs:22222222-2222-4222-8222-222222222222" }
    )
    const body = create.mock.calls[0]?.[0] as Record<string, unknown>
    expect(body).not.toHaveProperty("payment_method_types")
    expect(body).not.toHaveProperty("transfer_data")
    expect(body).not.toHaveProperty("application_fee_amount")
    expect(body).not.toHaveProperty("discounts")
    // Never accept arbitrary account codes (subscription / 100%-off coupons).
    expect(body).not.toHaveProperty("allow_promotion_codes")
    // Eleva is not the seller: no Stripe Tax, no Stripe invoice, EUR only.
    expect(body).not.toHaveProperty("automatic_tax")
    expect(body).not.toHaveProperty("invoice_creation")
    expect(body).not.toHaveProperty("adaptive_pricing")
    // NIF stays on Eleva's funnel field (private NIF is not a VAT number).
    expect(body).not.toHaveProperty("tax_id_collection")
    const items = body.line_items as Array<{
      price_data: Record<string, unknown>
    }>
    expect(items[0]?.price_data).toEqual(
      expect.objectContaining({ currency: "eur", unit_amount: 6000 })
    )
    expect(items[0]?.price_data).not.toHaveProperty("tax_behavior")
  })

  it("attaches only a validated promotion code via discounts", async () => {
    create.mockResolvedValue({ id: "cs_2", client_secret: "cs_2_secret" })
    await createBookingCheckoutSession({
      amountCents: 6000,
      serviceName: "First visit",
      bookingId: "11111111-1111-4111-8111-111111111111",
      reservationId: "22222222-2222-4222-8222-222222222222",
      expertOrgId: "33333333-3333-4333-8333-333333333333",
      customerId: "cus_member",
      returnUrl: "https://eleva.care/fisiomota/first-visit",
      idempotencyKey: "cs:22222222-2222-4222-8222-222222222222:promo_1",
      expiresAt: 1_800_003_600,
      promotionCodeId: "promo_1",
    })
    const body = create.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(body.discounts).toEqual([{ promotion_code: "promo_1" }])
    expect(body).not.toHaveProperty("allow_promotion_codes")
  })

  it("refuses to create when STRIPE_PMC_BOOKING is missing", async () => {
    envState.STRIPE_PMC_BOOKING = undefined
    try {
      await expect(
        createBookingCheckoutSession({
          amountCents: 6000,
          serviceName: "First visit",
          bookingId: "11111111-1111-4111-8111-111111111111",
          reservationId: "22222222-2222-4222-8222-222222222222",
          expertOrgId: "33333333-3333-4333-8333-333333333333",
          customerId: "cus_member",
          returnUrl: "https://eleva.care/anaquick/quick-chat",
          idempotencyKey: "cs:22222222-2222-4222-8222-222222222222",
          expiresAt: 1_800_001_860,
        })
      ).rejects.toThrow("STRIPE_PMC_BOOKING is not configured")
    } finally {
      envState.STRIPE_PMC_BOOKING = "pmc_test_booking"
    }
  })
})

describe("checkoutSessionExpiresAt", () => {
  it("derives a stable expiry from the reservation creation time", () => {
    const createdAt = new Date("2027-01-15T10:00:00.000Z")
    const first = checkoutSessionExpiresAt(createdAt)
    expect(first).toBe(Math.floor(createdAt.getTime() / 1000) + 60 * 60)
    expect(checkoutSessionExpiresAt(new Date(createdAt))).toBe(first)
  })
})

describe("resolveBookingCustomer", () => {
  beforeEach(() => {
    customersCreate.mockReset()
  })

  it("reuses only a Customer already bound to the buyer", async () => {
    await expect(
      resolveBookingCustomer({
        reservationId: "22222222-2222-4222-8222-222222222222",
        name: "Ada",
        email: "ada@example.com",
        boundCustomerId: "cus_member",
      })
    ).resolves.toBe("cus_member")
    expect(customersCreate).not.toHaveBeenCalled()
  })

  it("creates a reservation-scoped Customer instead of matching by email", async () => {
    customersCreate.mockResolvedValue({ id: "cus_new" })
    await expect(
      resolveBookingCustomer({
        reservationId: "22222222-2222-4222-8222-222222222222",
        name: "Ada",
        email: "ada@example.com",
        phone: "+351910000000",
      })
    ).resolves.toBe("cus_new")
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        phone: "+351910000000",
        metadata: expect.objectContaining({
          eleva_reservation_id: "22222222-2222-4222-8222-222222222222",
        }),
      }),
      { idempotencyKey: "cus:22222222-2222-4222-8222-222222222222" }
    )
  })
})

describe("bookingCheckoutSnapshotFromSession", () => {
  it("copies Customer, tax ID, billing address, and discount", () => {
    const snapshot = bookingCheckoutSnapshotFromSession({
      id: "cs_paid",
      mode: "payment",
      amount_total: 6000,
      currency: "eur",
      customer: "cus_member",
      payment_intent: "pi_paid",
      metadata: {
        eleva_booking_id: "11111111-1111-4111-8111-111111111111",
        reservationId: "22222222-2222-4222-8222-222222222222",
        eleva_org_id: "33333333-3333-4333-8333-333333333333",
      },
      total_details: {
        amount_discount: 500,
        amount_tax: 0,
        amount_shipping: 0,
      },
      discounts: [{ promotion_code: "promo_abc" }],
      customer_details: {
        name: "Ada Lovelace",
        individual_name: "Ada Lovelace",
        business_name: "Ada Ltd",
        tax_ids: [{ type: "eu_vat", value: "PT123456789" }],
        address: {
          line1: "Rua A 1",
          city: "Lisboa",
          postal_code: "1000-001",
          country: "PT",
        },
      },
      presentment_details: {
        presentment_currency: "usd",
        presentment_amount: 7200,
      },
    } as unknown as Stripe.Checkout.Session)

    expect(snapshot).toMatchObject({
      checkoutSessionId: "cs_paid",
      customerId: "cus_member",
      paymentIntentId: "pi_paid",
      discountCents: 500,
      promotionCodeId: "promo_abc",
      taxId: "PT123456789",
      businessName: "Ada Ltd",
      presentmentCurrency: "usd",
      presentmentAmountCents: 7200,
    })
    expect(snapshot.billingAddress?.city).toBe("Lisboa")
  })
})

describe("isBookingPaymentCheckoutSession", () => {
  it("accepts payment mode with booking metadata", () => {
    expect(
      isBookingPaymentCheckoutSession({
        mode: "payment",
        metadata: { eleva_booking_id: "11111111-1111-4111-8111-111111111111" },
      } as unknown as Stripe.Checkout.Session)
    ).toBe(true)
    expect(
      isBookingPaymentCheckoutSession({
        mode: "subscription",
        metadata: { eleva_booking_id: "11111111-1111-4111-8111-111111111111" },
      } as unknown as Stripe.Checkout.Session)
    ).toBe(false)
  })
})
