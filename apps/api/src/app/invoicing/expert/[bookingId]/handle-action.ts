import { z } from "zod"
import {
  ExpertInvoiceActionRequestSchema,
  ExpertInvoiceActionResponseSchema,
} from "@eleva/api-client"
import {
  isExpertInvoiceOpError,
  type PublicExpertInvoice,
} from "@eleva/accounting"
import { corsHeaders } from "@/lib/cors"
import { apiAuthFailure, requireApiCapability } from "@/lib/auth"
import { checkBot } from "@/lib/bot-protection"
import { applyRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit"
import { secureJson } from "@/lib/security-headers"

const BookingIdSchema = z.string().uuid()

export async function handleExpertInvoiceAction(
  request: Request,
  params: Promise<{ bookingId: string }>,
  op: (input: {
    bookingId: string
    orgId: string
    actorUserId: string
  }) => Promise<PublicExpertInvoice>
): Promise<Response> {
  const headers = corsHeaders(request, "POST, OPTIONS")

  let session
  try {
    session = await requireApiCapability(request, "expert:invoicing_manage")
  } catch (err) {
    const failure = apiAuthFailure(err, headers)
    if (failure) return failure
    throw err
  }

  if (
    session.authMode !== "bearer" &&
    session.authMode !== "jwt" &&
    session.authMode !== "api-key"
  ) {
    const botVerdict = await checkBot({ checkLevel: "deepAnalysis" })
    if (botVerdict?.isBot) {
      return secureJson({ error: "blocked" }, { status: 403, headers })
    }
  }

  const rateLimited = await applyRateLimit(
    rateLimitKey(request, session.user.id),
    RATE_LIMITS.authenticated,
    headers
  )
  if (rateLimited) return rateLimited

  const { bookingId: rawBookingId } = await params
  const bookingId = BookingIdSchema.safeParse(rawBookingId)
  if (!bookingId.success) {
    return secureJson(
      { error: "validation", issues: bookingId.error.issues },
      { status: 422, headers }
    )
  }

  const body = ExpertInvoiceActionRequestSchema.safeParse(
    await request.json().catch(() => ({}))
  )
  if (!body.success) {
    return secureJson(
      { error: "validation", issues: body.error.issues },
      { status: 422, headers }
    )
  }

  try {
    const invoice = await op({
      bookingId: bookingId.data,
      orgId: session.orgId,
      actorUserId: session.user.id,
    })
    return secureJson(ExpertInvoiceActionResponseSchema.parse(invoice), {
      status: 200,
      headers,
    })
  } catch (err) {
    if (isExpertInvoiceOpError(err)) {
      return secureJson(
        { error: err.code, code: err.code, message: err.message },
        { status: err.status, headers }
      )
    }
    throw err
  }
}
