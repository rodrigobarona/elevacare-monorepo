import { ApiClientError } from "@eleva/api-client"
import type { OfferInvariantError } from "@eleva/scheduling/offer-invariants"
import { isOfferInvariantError } from "@eleva/scheduling/offer-invariant-fields"
import type { PublishViolation } from "@eleva/scheduling/publish-event-type"

export function mapExpertApiError(
  err: unknown,
  fallback: string,
  codes?: Partial<{
    conflict: string
    connectIncomplete: string
    forbidden: string
    notFound: string
    offerInvariant: string
    validation: string
  }>
): string {
  if (err instanceof ApiClientError) {
    if (err.body.error === "OFFER_INVARIANT_VIOLATION") {
      return codes?.offerInvariant ?? "offer-invariant"
    }
    if (err.body.error === "PRACTICE_INCOMPLETE") {
      return "practice-incomplete"
    }
    if (err.body.error === "invoicing_required") {
      return "invoicing-required"
    }
    if (err.body.error === "IDENTITY_REQUIRED") {
      return "identity-required"
    }
    if (err.body.error === "LICENCE_REQUIRED") {
      return "licence-required"
    }
    if (err.body.error === "LICENCE_LOCKED") {
      return "licence-locked"
    }
    if (err.status === 409 || err.body.error === "conflict") {
      if (err.body.error === "CONNECT_INCOMPLETE") {
        return codes?.connectIncomplete ?? "connect-incomplete"
      }
      return codes?.conflict ?? "conflict"
    }
    if (err.status === 403) {
      if (
        err.body.error === "forbidden" &&
        typeof err.body.message === "string" &&
        err.body.message.toLowerCase().includes("calendar")
      ) {
        return "unauthorized-calendar"
      }
      return codes?.forbidden ?? "forbidden"
    }
    if (err.status === 404) {
      return codes?.notFound ?? "no-profile"
    }
    if (err.status === 422 || err.body.error === "validation") {
      return codes?.validation ?? "validation"
    }
  }
  return fallback
}

/** Human sentence from an API error body when present (e.g. offer invariants). */
export function humanApiMessage(err: unknown): string | undefined {
  if (err instanceof ApiClientError && typeof err.body.message === "string") {
    return err.body.message
  }
  return undefined
}

function readBodyRecord(err: unknown): Record<string, unknown> | null {
  if (!(err instanceof ApiClientError)) return null
  const body = err.body
  if (!body || typeof body !== "object") return null
  return body as Record<string, unknown>
}

export function offerInvariantCode(
  err: unknown
): OfferInvariantError | undefined {
  const body = readBodyRecord(err)
  if (!body || body.error !== "OFFER_INVARIANT_VIOLATION") return undefined
  const code = body.code
  return typeof code === "string" && isOfferInvariantError(code)
    ? code
    : undefined
}

export function offerInvariantViolations(
  err: unknown
): PublishViolation[] | undefined {
  const body = readBodyRecord(err)
  if (!body || body.error !== "OFFER_INVARIANT_VIOLATION") return undefined
  const raw = body.violations
  if (!Array.isArray(raw)) return undefined
  const violations: PublishViolation[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const code = row.code
    const message = row.message
    if (typeof code !== "string" || typeof message !== "string") continue
    violations.push({
      modeId: typeof row.modeId === "string" ? row.modeId : null,
      code: code as PublishViolation["code"],
      message,
    })
  }
  return violations.length > 0 ? violations : undefined
}
