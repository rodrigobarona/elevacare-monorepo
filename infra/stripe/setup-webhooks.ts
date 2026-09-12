import Stripe from "stripe"
import {
  CONNECT_WEBHOOK_EVENTS,
  PLATFORM_WEBHOOK_EVENTS,
} from "@eleva/billing/server"

/**
 * setup-webhooks — creates or updates the two Stripe webhook endpoints:
 *   - platform: {url}  (STRIPE_WEBHOOK_SECRET)
 *   - connect:  {url}/connect  (connect: true, STRIPE_CONNECT_WEBHOOK_SECRET)
 *
 * Canonical platform URL: https://api.eleva.care/webhooks/stripe
 *
 * Usage:
 *   pnpm setup:webhooks -- --url https://api.eleva.care/webhooks/stripe
 *   pnpm setup:webhooks -- --url https://api.eleva.care/webhooks/stripe --apply
 *
 * The signing secret (whsec_...) is only returned on creation. Save it
 * immediately. Dry-run is the default; do not --apply against live unless
 * asked.
 *
 * For local development, use the Stripe CLI instead:
 *   stripe listen --forward-to localhost:3002/webhooks/stripe --forward-connect-to localhost:3002/webhooks/stripe/connect
 *
 * Uses STRIPE_SECRET_KEY from .env.local (staging by default).
 */

function parseArgs(argv: string[]): { url: string | null; apply: boolean } {
  const args = argv.slice(2)
  const apply = args.includes("--apply")
  const urlIndex = args.indexOf("--url")
  const url = urlIndex !== -1 ? (args[urlIndex + 1] ?? null) : null
  return { url, apply }
}

async function findExistingEndpoint(
  stripe: Stripe,
  url: string
): Promise<Stripe.WebhookEndpoint | null> {
  // Auto-paginate so accounts with >100 webhook endpoints are still
  // matched. Stops as soon as the target URL is found.
  for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (ep.url === url) return ep
  }
  return null
}

function eventsMatch(existing: string[], desired: readonly string[]): boolean {
  if (existing.length !== desired.length) return false
  const sorted = [...existing].sort()
  const desiredSorted = [...desired].sort()
  return sorted.every((e, i) => e === desiredSorted[i])
}

type EndpointKind = "platform" | "connect"

type EndpointPlan = {
  kind: EndpointKind
  url: string
  events: readonly Stripe.WebhookEndpointCreateParams.EnabledEvent[]
  secretEnv: "STRIPE_WEBHOOK_SECRET" | "STRIPE_CONNECT_WEBHOOK_SECRET"
  connect: boolean
  description: string
}

function warnApiVersionDrift(
  existing: Stripe.WebhookEndpoint,
  apiVersion: Stripe.WebhookEndpointCreateParams.ApiVersion,
  secretEnv: string
) {
  const driftMessage =
    existing.api_version === null
      ? `[stripe:webhooks] WARNING: existing endpoint uses 'account default' api_version. ` +
        `Events arrive in whatever version the Stripe account is currently configured for, ` +
        `which can drift if the account default changes. Explicit pinning to '${apiVersion}' is recommended.`
      : existing.api_version !== apiVersion
        ? `[stripe:webhooks] WARNING: existing endpoint api_version='${existing.api_version}' does NOT match desired '${apiVersion}'.`
        : null
  if (!driftMessage) return
  console.warn(driftMessage)
  console.warn(
    "[stripe:webhooks] Stripe locks api_version at endpoint creation. To fix, delete and recreate the endpoint:"
  )
  console.warn(
    `[stripe:webhooks]   stripe webhook_endpoints delete ${existing.id}`
  )
  console.warn(
    "[stripe:webhooks]   pnpm stripe:setup:webhooks -- --url <URL> --apply"
  )
  console.warn(
    `[stripe:webhooks] Note: deleting + recreating returns a new whsec_* secret; update ${secretEnv} in env after.`
  )
}

function endpointKindMarker(
  existing: Stripe.WebhookEndpoint
): string | undefined {
  return existing.metadata?.eleva_kind
}

function assertEndpointScope(
  existing: Stripe.WebhookEndpoint,
  plan: EndpointPlan
) {
  const marker = endpointKindMarker(existing)
  if (marker === plan.kind) return
  console.error(
    `[stripe:webhooks] ${plan.kind} endpoint ${existing.id} has unknown or mismatched scope ` +
      `(metadata.eleva_kind=${marker ?? "missing"}). Stripe cannot change \`connect\` on update.`
  )
  console.error("[stripe:webhooks] Delete and recreate the endpoint:")
  console.error(
    `[stripe:webhooks]   stripe webhook_endpoints delete ${existing.id}`
  )
  console.error(
    "[stripe:webhooks]   pnpm stripe:setup:webhooks -- --url <URL> --apply"
  )
  console.error(
    `[stripe:webhooks] Recreating returns a new ${plan.secretEnv}; update env after.`
  )
  process.exit(1)
}

async function syncEndpoint(
  stripe: Stripe,
  plan: EndpointPlan,
  apiVersion: Stripe.WebhookEndpointCreateParams.ApiVersion
) {
  const existing = await findExistingEndpoint(stripe, plan.url)
  if (existing) {
    assertEndpointScope(existing, plan)
    warnApiVersionDrift(existing, apiVersion, plan.secretEnv)
    if (eventsMatch(existing.enabled_events, plan.events)) {
      console.log(
        `[stripe:webhooks] ${plan.kind} endpoint already in sync (${existing.id})`
      )
      console.log(`  URL: ${existing.url}`)
      console.log(`  Status: ${existing.status}`)
      console.log(`  API version: ${existing.api_version ?? "account default"}`)
      return
    }

    const updated = await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: [...plan.events],
    })
    console.log(
      `[stripe:webhooks] Updated ${plan.kind} endpoint: ${updated.id}`
    )
    console.log(`  URL: ${updated.url}`)
    return
  }

  const created = await stripe.webhookEndpoints.create({
    url: plan.url,
    enabled_events: [...plan.events],
    api_version: apiVersion,
    connect: plan.connect,
    description: plan.description,
    metadata: { eleva_kind: plan.kind },
  })

  console.log(`[stripe:webhooks] Created ${plan.kind} endpoint: ${created.id}`)
  console.log(`  URL: ${created.url}`)
  if (process.stdout.isTTY) {
    console.log(`  Signing secret: ${created.secret}`)
    console.log(
      "[stripe:webhooks] IMPORTANT: Save this secret now — it cannot be retrieved later."
    )
    console.log(
      `[stripe:webhooks] Set ${plan.secretEnv}=<secret above> in your environment.`
    )
  } else {
    console.log(
      `[stripe:webhooks] Secret withheld from non-interactive output. Read it from the Stripe Dashboard and set ${plan.secretEnv}.`
    )
  }
}

async function main() {
  const { url, apply } = parseArgs(process.argv)

  if (!url) {
    console.error(
      "[stripe:webhooks] Missing --url argument.\n" +
        "  Usage: pnpm setup:webhooks -- --url https://api.eleva.care/webhooks/stripe [--apply]"
    )
    process.exit(1)
  }

  try {
    new URL(url)
  } catch {
    console.error(`[stripe:webhooks] Invalid URL: ${url}`)
    process.exit(1)
  }

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    console.error(
      "[stripe:webhooks] STRIPE_SECRET_KEY not found in environment."
    )
    process.exit(1)
  }

  const platformUrl = url.replace(/\/$/, "")
  const PRODUCTION_PLATFORM_WEBHOOK_URL =
    "https://api.eleva.care/webhooks/stripe"
  if (
    apiKey.startsWith("sk_live_") &&
    platformUrl !== PRODUCTION_PLATFORM_WEBHOOK_URL
  ) {
    console.error(
      "[stripe:webhooks] Live keys may only register " +
        `${PRODUCTION_PLATFORM_WEBHOOK_URL} (got ${platformUrl}).`
    )
    process.exit(1)
  }

  const apiVersionRaw = process.env.STRIPE_API_VERSION ?? "2026-04-22.dahlia"
  const apiVersion =
    apiVersionRaw as Stripe.WebhookEndpointCreateParams.ApiVersion
  const sdkApiVersion = apiVersionRaw as ConstructorParameters<
    typeof Stripe
  >[1] extends infer C | undefined
    ? C extends { apiVersion?: infer V }
      ? Exclude<V, undefined>
      : string
    : string

  const stripe = new Stripe(apiKey, {
    apiVersion: sdkApiVersion,
    appInfo: { name: "Eleva.care Webhook Setup", version: "1.0.0" },
  })

  const connectUrl = `${platformUrl}/connect`
  const plans: EndpointPlan[] = [
    {
      kind: "platform",
      url: platformUrl,
      events: PLATFORM_WEBHOOK_EVENTS,
      secretEnv: "STRIPE_WEBHOOK_SECRET",
      connect: false,
      description:
        "Eleva platform events (SaaS subs, invoices, Identity, booking payments)",
    },
    {
      kind: "connect",
      url: connectUrl,
      events: CONNECT_WEBHOOK_EVENTS,
      secretEnv: "STRIPE_CONNECT_WEBHOOK_SECRET",
      connect: true,
      description:
        "Eleva Connect events (account.updated, capability.updated, payouts)",
    },
  ]

  const isTestMode = apiKey.startsWith("sk_test_")
  console.log(
    `[stripe:webhooks] Mode: ${isTestMode ? "TEST" : "LIVE"} | API version: ${apiVersion} | Apply: ${apply}\n`
  )

  if (!apply) {
    console.log("[stripe:webhooks] DRY-RUN — pass --apply to configure.\n")
    for (const plan of plans) {
      console.log(`  ${plan.kind} URL: ${plan.url}`)
      console.log(`  connect: ${String(plan.connect)}`)
      console.log("  Events:")
      for (const event of plan.events) {
        console.log(`    - ${event}`)
      }
      console.log()
    }
    return
  }

  for (const plan of plans) {
    await syncEndpoint(stripe, plan, apiVersion)
    console.log()
  }
}

main().catch((err) => {
  console.error("[stripe:webhooks] Fatal error:", err)
  process.exit(1)
})
