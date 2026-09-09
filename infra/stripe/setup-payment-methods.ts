import Stripe from "stripe"

/**
 * Creates or updates the marketplace booking Payment Method Configuration.
 *
 * D-14: card (Apple Pay / Google Pay), Link, and MB WAY on. Every other
 * method present on the live configuration is turned off. Dry-run by
 * default.
 *
 * Usage:
 *   pnpm stripe:setup:payment-methods
 *   pnpm stripe:setup:payment-methods -- --apply
 *
 * Save the printed pmc_ id as STRIPE_PMC_BOOKING.
 */

const PMC_NAME = "eleva-booking"

const ON_METHODS = new Set<string>([
  "card",
  "link",
  "apple_pay",
  "google_pay",
  "mb_way",
])

function parseArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.slice(2).includes("--apply") }
}

function displayPreference(on: boolean) {
  return { display_preference: { preference: on ? "on" : "off" } as const }
}

function isMethodBlock(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && "display_preference" in value
  )
}

function prefsFromConfig(
  current: Stripe.PaymentMethodConfiguration
): Stripe.PaymentMethodConfigurationUpdateParams {
  const params: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(current)) {
    if (!isMethodBlock(value)) continue
    params[key] = displayPreference(ON_METHODS.has(key))
  }
  for (const method of ON_METHODS) {
    params[method] = displayPreference(true)
  }
  return params as Stripe.PaymentMethodConfigurationUpdateParams
}

function methodKeys(current: Stripe.PaymentMethodConfiguration): string[] {
  return Object.entries(current)
    .filter(([, value]) => isMethodBlock(value))
    .map(([key]) => key)
}

async function main() {
  const { apply } = parseArgs(process.argv)
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    console.error("[stripe:pmc] STRIPE_SECRET_KEY not found in environment.")
    process.exit(1)
  }

  const apiVersionRaw = process.env.STRIPE_API_VERSION ?? "2026-04-22.dahlia"
  const sdkApiVersion = apiVersionRaw as ConstructorParameters<
    typeof Stripe
  >[1] extends infer C | undefined
    ? C extends { apiVersion?: infer V }
      ? Exclude<V, undefined>
      : string
    : string

  const client = new Stripe(apiKey, {
    apiVersion: sdkApiVersion,
    appInfo: { name: "Eleva.care Booking PMC Setup", version: "1.0.0" },
  })

  const listed = await client.paymentMethodConfigurations
    .list({ limit: 100 })
    .autoPagingToArray({ limit: 1000 })
  const matches = listed.filter((row) => row.name === PMC_NAME)
  if (matches.length > 1) {
    console.error(
      "[stripe:pmc] multiple configurations named %s: %s. Resolve manually.",
      PMC_NAME,
      matches.map((row) => row.id).join(", ")
    )
    process.exit(1)
  }
  const existing = matches[0]

  if (!apply) {
    console.log(
      "[stripe:pmc] dry-run. Would %s %s",
      existing ? "update" : "create",
      PMC_NAME
    )
    if (existing) {
      const keys = methodKeys(existing)
      console.log("[stripe:pmc] existing id", existing.id)
      console.log(
        "[stripe:pmc] on:",
        keys.filter((key) => ON_METHODS.has(key)).join(", ") || "(none yet)"
      )
      console.log(
        "[stripe:pmc] off:",
        keys.filter((key) => !ON_METHODS.has(key)).join(", ") || "(none)"
      )
    } else {
      console.log("[stripe:pmc] on:", [...ON_METHODS].join(", "))
      console.log(
        "[stripe:pmc] off: every other method on the created configuration"
      )
    }
    process.exit(0)
  }

  const id =
    existing?.id ??
    (await client.paymentMethodConfigurations.create({ name: PMC_NAME })).id
  const current = await client.paymentMethodConfigurations.retrieve(id)
  const turningOff = methodKeys(current).filter((key) => !ON_METHODS.has(key))
  console.log("[stripe:pmc] turning off:", turningOff.join(", ") || "(none)")
  const config = await client.paymentMethodConfigurations.update(
    id,
    prefsFromConfig(current)
  )

  console.log("[stripe:pmc] %s", config.id)
  const blocked = [...ON_METHODS].filter((method) => {
    const block = (config as unknown as Record<string, unknown>)[method]
    return (
      typeof block === "object" &&
      block !== null &&
      (block as { available?: boolean }).available === false
    )
  })
  if (blocked.length > 0) {
    console.warn(
      "[stripe:pmc] enabled but not available (capability inactive):",
      blocked.join(", ")
    )
  }
  console.log("Set STRIPE_PMC_BOOKING=%s", config.id)
}

main().catch((err: unknown) => {
  console.error("[stripe:pmc] failed", err)
  process.exit(1)
})
