import Stripe from "stripe"

/**
 * seed-products — creates the Eleva subscription products and prices in
 * Stripe. Idempotent: skips creation if a product with the same metadata
 * key already exists.
 *
 * Usage:
 *   pnpm seed:products              # dry-run
 *   pnpm seed:products --apply      # actually create in Stripe
 *
 * Uses STRIPE_SECRET_KEY from .env.local (staging by default).
 * For production, set STRIPE_SECRET_KEY to the production key.
 *
 * Per ADR-016 + W5: clinic seat prices use the WorkOS-managed
 * `workos_seat_count` Billing Meter when `WORKOS_SEAT_METER_ID` is set
 * in env. Otherwise the script falls back to the legacy licensed
 * per-seat price (kept for back-compat during migration). Either way,
 * the new metered price has `eleva_price_type: "per_seat_metered"` and
 * is preferred by `findSeatPriceWithType` in @eleva/billing/server.
 */

const PRODUCTS = [
  {
    metadataKey: "eleva_member_free",
    name: "Member Free",
    description:
      "Free tier for all members (patients). Includes basic platform access.",
    priceAmount: 0,
    interval: "month" as const,
    entitlementKey: "member_free",
  },
  {
    metadataKey: "eleva_expert_community",
    name: "Expert Community",
    description:
      "Free tier for approved experts. 15% platform commission on bookings.",
    priceAmount: 0,
    interval: "month" as const,
    entitlementKey: "expert_community",
  },
  {
    metadataKey: "eleva_expert_top",
    name: "Top Expert",
    description:
      "Earned loyalty tier (Superhost model). 8% commission, priority ranking, advanced CRM. Platform-assigned based on quality criteria.",
    priceAmount: 0,
    interval: "month" as const,
    entitlementKey: "expert_top",
  },
  {
    metadataKey: "eleva_clinic_starter",
    name: "Clinic Starter",
    description:
      "For small independent practices (1-5 seats). No booking commission.",
    priceAmount: 9900,
    interval: "month" as const,
    entitlementKey: "clinic_starter",
    seatPrice: {
      amount: 3900,
      metadataKey: "eleva_clinic_starter_seat",
    },
  },
  {
    metadataKey: "eleva_clinic_growth",
    name: "Clinic Growth",
    description: "For mid-size clinics (6-20 seats). No booking commission.",
    priceAmount: 19900,
    interval: "month" as const,
    entitlementKey: "clinic_growth",
    seatPrice: {
      amount: 2900,
      metadataKey: "eleva_clinic_growth_seat",
    },
  },
] as const

interface SeatPrice {
  amount: number
  metadataKey: string
}

async function findExistingProduct(
  stripe: Stripe,
  metadataKey: string
): Promise<Stripe.Product | null> {
  const products = await stripe.products.search({
    query: `metadata["eleva_product_key"]:"${metadataKey}"`,
  })
  return products.data[0] ?? null
}

async function ensurePricesForProduct(
  stripe: Stripe,
  product: Stripe.Product,
  p: (typeof PRODUCTS)[number]
): Promise<void> {
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 20,
  })

  const hasBasePrice = prices.data.some(
    (pr) => pr.metadata.eleva_price_type === "base"
  )

  if (!hasBasePrice) {
    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: p.priceAmount,
      recurring: { interval: p.interval },
      metadata: {
        eleva_product_key: p.metadataKey,
        eleva_price_type: "base",
      },
    })
    console.log(
      `    + created missing base price: ${price.id} (EUR ${(p.priceAmount / 100).toFixed(2)}/${p.interval})`
    )
  }

  if ("seatPrice" in p && p.seatPrice) {
    const sp = p.seatPrice as SeatPrice
    await ensureSeatPrices(stripe, product.id, p, sp, prices.data)
  }
}

/**
 * Creates seat prices for a clinic product. When WORKOS_SEAT_METER_ID
 * is set, creates a metered price (`per_seat_metered`) tied to the
 * WorkOS-managed `workos_seat_count` Billing Meter. Always also keeps
 * the legacy licensed price (`per_seat`) so existing subscriptions
 * billed against it continue to function until migrated.
 */
async function ensureSeatPrices(
  stripe: Stripe,
  productId: string,
  p: (typeof PRODUCTS)[number],
  sp: SeatPrice,
  existingPrices: Stripe.Price[]
): Promise<void> {
  const meterId = process.env.WORKOS_SEAT_METER_ID
  const hasLicensedPrice = existingPrices.some(
    (pr) => pr.metadata.eleva_price_type === "per_seat"
  )
  // Match strictly on meter id so a re-seed against a different
  // WORKOS_SEAT_METER_ID re-creates the metered price instead of
  // silently skipping it. Without the meter-id check, idempotent sync
  // would treat any per_seat_metered price as a match even if it points
  // at a stale meter from a previous environment.
  const hasMeteredPrice =
    !!meterId &&
    existingPrices.some(
      (pr) =>
        pr.metadata.eleva_price_type === "per_seat_metered" &&
        pr.metadata.eleva_seat_meter_id === meterId
    )

  if (!hasLicensedPrice) {
    const seatPriceObj = await stripe.prices.create({
      product: productId,
      currency: "eur",
      unit_amount: sp.amount,
      recurring: {
        interval: p.interval,
        usage_type: "licensed",
      },
      metadata: {
        eleva_product_key: sp.metadataKey,
        eleva_price_type: "per_seat",
      },
    })
    console.log(
      `    + created licensed seat price: ${seatPriceObj.id} (EUR ${(sp.amount / 100).toFixed(2)}/seat/${p.interval})`
    )
  }

  if (meterId && !hasMeteredPrice) {
    const seatPriceObj = await stripe.prices.create({
      product: productId,
      currency: "eur",
      unit_amount: sp.amount,
      recurring: {
        interval: p.interval,
        usage_type: "metered",
        meter: meterId,
      },
      metadata: {
        eleva_product_key: `${sp.metadataKey}_metered`,
        eleva_price_type: "per_seat_metered",
        eleva_seat_meter_id: meterId,
      },
    })
    console.log(
      `    + created metered seat price: ${seatPriceObj.id} (EUR ${(sp.amount / 100).toFixed(2)}/seat/${p.interval} via meter ${meterId})`
    )
  } else if (!meterId) {
    console.warn(
      `    ! WORKOS_SEAT_METER_ID not set; skipping metered seat price for ${p.name}. ` +
        `Set the env var to the workos_seat_count meter id from your Stripe Dashboard ` +
        `(Billing -> Meters) and re-run to enable WorkOS Seat Sync.`
    )
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    console.error("[stripe] STRIPE_SECRET_KEY not found in environment.")
    process.exit(1)
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: "2026-04-22.dahlia",
    appInfo: { name: "Eleva.care Seed Script", version: "1.0.0" },
  })

  const isTestMode = apiKey.startsWith("sk_test_")
  console.log(
    `[stripe] Mode: ${isTestMode ? "TEST" : "LIVE"} | Apply: ${apply}\n`
  )

  if (!apply) {
    console.log("[stripe] DRY-RUN — pass --apply to create products.\n")
    for (const p of PRODUCTS) {
      console.log(`  Product: ${p.name}`)
      console.log(
        `    Price: EUR ${(p.priceAmount / 100).toFixed(2)}/${p.interval}`
      )
      console.log(`    Entitlement: ${p.entitlementKey}`)
      if ("seatPrice" in p && p.seatPrice) {
        const sp = p.seatPrice as SeatPrice
        console.log(
          `    Seat price: EUR ${(sp.amount / 100).toFixed(2)}/seat/${p.interval}`
        )
      }
      console.log()
    }
    return
  }

  console.log("[stripe] Creating products and prices...\n")

  for (const p of PRODUCTS) {
    const existing = await findExistingProduct(stripe, p.metadataKey)

    if (existing) {
      console.log(`  ⏭ ${p.name} already exists (${existing.id})`)
      await ensurePricesForProduct(stripe, existing, p)
      continue
    }

    const product = await stripe.products.create({
      name: p.name,
      description: p.description,
      metadata: {
        eleva_product_key: p.metadataKey,
        eleva_entitlement: p.entitlementKey,
      },
    })

    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: p.priceAmount,
      recurring: { interval: p.interval },
      metadata: {
        eleva_product_key: p.metadataKey,
        eleva_price_type: "base",
      },
    })

    console.log(
      `  ✓ ${p.name}: product=${product.id}, price=${price.id} (EUR ${(p.priceAmount / 100).toFixed(2)}/${p.interval})`
    )

    if ("seatPrice" in p && p.seatPrice) {
      const sp = p.seatPrice as SeatPrice
      // No existing prices yet for a freshly-created product, so pass [].
      await ensureSeatPrices(stripe, product.id, p, sp, [])
    }
  }

  console.log("\n[stripe] Done! Products seeded.")
  console.log(
    "[stripe] Next: attach Stripe Entitlements to these products in the Stripe Dashboard."
  )
}

main().catch((err) => {
  console.error("[stripe] Fatal error:", err)
  process.exit(1)
})
