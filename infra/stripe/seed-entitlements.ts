/* eslint-disable no-console */
import Stripe from "stripe"

/**
 * seed-entitlements — creates Stripe Entitlement Features and attaches them
 * to their respective products. Idempotent: skips creation if a feature with
 * the same lookup_key already exists.
 *
 * Prerequisites: run `pnpm seed:products --apply` first so products exist.
 *
 * Usage:
 *   pnpm seed:entitlements              # dry-run
 *   pnpm seed:entitlements --apply      # create features + attach to products
 *
 * Uses STRIPE_SECRET_KEY from .env.local (staging by default).
 */

const ENTITLEMENTS = [
  {
    lookupKey: "member_free",
    name: "Member Free Access",
    productMetadataKey: "eleva_member_free",
  },
  {
    lookupKey: "expert_community",
    name: "Expert Community Access",
    productMetadataKey: "eleva_expert_community",
  },
  {
    lookupKey: "expert_top",
    name: "Top Expert Access",
    productMetadataKey: "eleva_expert_top",
  },
  {
    lookupKey: "clinic_starter",
    name: "Clinic Starter Access",
    productMetadataKey: "eleva_clinic_starter",
  },
  {
    lookupKey: "clinic_growth",
    name: "Clinic Growth Access",
    productMetadataKey: "eleva_clinic_growth",
  },
]

async function findProductByMetadataKey(
  stripe: Stripe,
  metadataKey: string
): Promise<Stripe.Product | null> {
  const products = await stripe.products.search({
    query: `metadata["eleva_product_key"]:"${metadataKey}"`,
  })
  return products.data[0] ?? null
}

async function findFeatureByLookupKey(
  stripe: Stripe,
  lookupKey: string
): Promise<{ id: string; lookup_key: string; name: string } | null> {
  const features = await stripe.entitlements.features.list({
    lookup_key: lookupKey,
  })
  return features.data[0] ?? null
}

async function isFeatureAttached(
  stripe: Stripe,
  productId: string,
  featureId: string
): Promise<boolean> {
  const attached = await stripe.products.listFeatures(productId)
  return attached.data.some((pf) => pf.entitlement_feature?.id === featureId)
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    console.error("[entitlements] STRIPE_SECRET_KEY not found in environment.")
    process.exit(1)
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: "2025-04-30.basil",
    appInfo: { name: "Eleva.care Entitlements Seed", version: "1.0.0" },
  })

  const isTestMode = apiKey.startsWith("sk_test_")
  console.log(
    `[entitlements] Mode: ${isTestMode ? "TEST" : "LIVE"} | Apply: ${apply}\n`
  )

  if (!apply) {
    console.log("[entitlements] DRY-RUN — pass --apply to create features.\n")
    for (const e of ENTITLEMENTS) {
      console.log(`  Feature: ${e.name}`)
      console.log(`    Lookup key: ${e.lookupKey}`)
      console.log(
        `    Attach to product with metadata: ${e.productMetadataKey}`
      )
      console.log()
    }
    return
  }

  console.log("[entitlements] Creating features and attaching to products...\n")

  for (const e of ENTITLEMENTS) {
    // 1. Find or create the entitlement feature
    let feature = await findFeatureByLookupKey(stripe, e.lookupKey)
    if (feature) {
      console.log(
        `  ⏭ Feature "${e.lookupKey}" already exists (${feature.id})`
      )
    } else {
      const created = await stripe.entitlements.features.create({
        lookup_key: e.lookupKey,
        name: e.name,
      })
      feature = {
        id: created.id,
        lookup_key: created.lookup_key,
        name: created.name,
      }
      console.log(`  ✓ Created feature "${e.lookupKey}" (${feature.id})`)
    }

    // 2. Find the product
    const product = await findProductByMetadataKey(stripe, e.productMetadataKey)
    if (!product) {
      console.log(
        `    ⚠ Product with metadata key "${e.productMetadataKey}" not found — skipping attachment`
      )
      continue
    }

    // 3. Attach feature to product (if not already attached)
    const alreadyAttached = await isFeatureAttached(
      stripe,
      product.id,
      feature.id
    )
    if (alreadyAttached) {
      console.log(`    ⏭ Already attached to ${product.name} (${product.id})`)
    } else {
      await stripe.products.createFeature(product.id, {
        entitlement_feature: feature.id,
      })
      console.log(`    ✓ Attached to ${product.name} (${product.id})`)
    }
    console.log()
  }

  console.log("[entitlements] Done! All features created and attached.")
  console.log(
    "[entitlements] WorkOS will now include these in access tokens for subscribed customers."
  )
}

main().catch((err) => {
  console.error("[entitlements] Fatal error:", err)
  process.exit(1)
})
