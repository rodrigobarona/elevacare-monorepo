import { captureException } from "@eleva/observability"
import { processStripeEvent, stripe } from "@eleva/billing/server"
import { secureJson } from "../../../lib/security-headers"
import { corsHeaders } from "../../../lib/cors"

type WebhookSource = "platform" | "connect"

/**
 * Shared Stripe webhook verification + dispatch. Each route supplies
 * its own signing secret so a Connect event delivered to the platform
 * path (or vice versa) fails signature verification.
 */
export async function handleStripeWebhook(
  request: Request,
  options: {
    secret: string | undefined
    source: WebhookSource
    secretName: string
  }
): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")
  const logPrefix =
    options.source === "connect"
      ? "[stripe-webhook-connect]"
      : "[stripe-webhook]"

  if (!options.secret) {
    console.error(`${logPrefix} ${options.secretName} not configured`)
    return secureJson(
      { error: "webhook_not_configured" },
      { status: 500, headers }
    )
  }

  let stripeClient: ReturnType<typeof stripe>
  try {
    stripeClient = stripe()
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe init failed"
    console.error(`${logPrefix} Stripe SDK init failed:`, message)
    void captureException(err, {
      route:
        options.source === "connect"
          ? "/webhooks/stripe/connect"
          : "/webhooks/stripe",
      phase: "init",
    })
    return secureJson(
      { error: "stripe_init_failed", message },
      { status: 500, headers }
    )
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return secureJson({ error: "missing_signature" }, { status: 400, headers })
  }

  let event: Awaited<
    ReturnType<ReturnType<typeof stripe>["webhooks"]["constructEventAsync"]>
  >
  try {
    event = await stripeClient.webhooks.constructEventAsync(
      body,
      signature,
      options.secret
    )
  } catch (err) {
    const isSignatureError =
      err instanceof Error && err.name === "StripeSignatureVerificationError"
    const message = err instanceof Error ? err.message : "invalid signature"
    console.error(
      `${logPrefix} ${isSignatureError ? "Signature verification failed" : "constructEventAsync threw"}:`,
      message
    )
    return secureJson({ error: "invalid_signature" }, { status: 400, headers })
  }

  const result = await processStripeEvent(event)

  switch (result.status) {
    case "duplicate":
      console.info(`${logPrefix} Duplicate event ignored: ${result.eventId}`)
      return secureJson({ received: true, status: "duplicate" }, { headers })
    case "processed":
      return secureJson(
        {
          received: true,
          status: "processed",
          eventType: result.eventType,
        },
        { headers }
      )
    case "ignored":
      console.info(
        `${logPrefix} Ignored ${result.eventType} (${result.eventId}): ${result.reason}`
      )
      return secureJson(
        {
          received: true,
          status: "ignored",
          eventType: result.eventType,
        },
        { headers }
      )
    case "failed_terminal":
      console.error(
        `${logPrefix} Terminal handler failure for ${result.eventType} (${result.eventId}): ${result.error}`
      )
      return secureJson(
        {
          received: true,
          status: "failed_terminal",
          eventType: result.eventType,
          error: result.error,
        },
        { headers }
      )
    case "failed":
      console.error(
        `${logPrefix} Handler failed for ${result.eventType} (${result.eventId}): ${result.error}`
      )
      return secureJson(
        {
          received: false,
          status: "failed",
          eventType: result.eventType,
          error: result.error,
        },
        { status: 500, headers }
      )
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}
