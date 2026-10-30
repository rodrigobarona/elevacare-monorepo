import { eq } from "drizzle-orm"
import { z } from "zod"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  auth,
  main,
  PARTNER_DECISION_EVENT_TYPES,
  withPlatformAdminContext,
  type PartnerDecisionEventType,
} from "@eleva/db"
import {
  getEmailTranslations,
  partnerDecisionCopy,
  renderPartnerDecision,
} from "@eleva/email"
import { sendNotification } from "./send-notification"
import { toEmailLocale } from "./send-closed-gate-invoice"

const PARTNER_DECISION_TYPES = new Set<string>(PARTNER_DECISION_EVENT_TYPES)

const PayloadSchema = z.object({
  applicationId: z.string().uuid(),
  expertProfileId: z.string().uuid(),
  reason: z.string().nullable(),
})

export type PartnerDecisionEvent = {
  id: string
  type: string
  orgId: string
  payload: Record<string, unknown>
}

type SendDeps = {
  loadExpert?: typeof loadExpert
  send?: typeof sendNotification
}

export function isPartnerDecisionKind(
  type: string
): type is PartnerDecisionEventType {
  return PARTNER_DECISION_TYPES.has(type)
}

/** Tells the expert the outcome of the staff licence review. */
export async function sendPartnerDecisionNotification(
  event: PartnerDecisionEvent,
  deps: SendDeps = {}
): Promise<void> {
  if (!isPartnerDecisionKind(event.type)) {
    throw new Error(`send-notification: unsupported event type ${event.type}`)
  }
  const parsed = PayloadSchema.safeParse(event.payload)
  if (!parsed.success) {
    throw new Error("send-notification: partner payload is invalid")
  }
  const expert = await (deps.loadExpert ?? loadExpert)(
    parsed.data.expertProfileId
  )
  if (!expert || expert.orgId !== event.orgId) {
    throw new Error("send-notification: expert not found for event org")
  }
  const locale = toEmailLocale(expert.locale)
  const copy = partnerDecisionCopy(getEmailTranslations(locale), event.type)
  const html = await renderPartnerDecision({
    kind: event.type,
    licenceHref: `${resolveGatewayUrl()}/${expert.orgSlug}/licence`,
    reason: parsed.data.reason,
    name: expert.displayName.trim().split(/\s+/)[0],
    locale,
  })
  await (deps.send ?? sendNotification)({
    kind: event.type,
    orgId: event.orgId,
    recipient: { userId: expert.userId },
    ctx: {
      title: copy.title,
      body: copy.subtitle,
      subject: copy.subject,
      html,
    },
    idempotencyKey: `partner:${event.id}`,
  })
}

async function loadExpert(expertProfileId: string): Promise<{
  orgId: string
  orgSlug: string
  userId: string
  displayName: string
  locale: string | null
} | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        orgId: main.expertProfiles.orgId,
        orgSlug: auth.organization.slug,
        userId: main.expertProfiles.userId,
        displayName: main.expertProfiles.displayName,
        locale: auth.user.locale,
      })
      .from(main.expertProfiles)
      .innerJoin(auth.user, eq(auth.user.id, main.expertProfiles.userId))
      .innerJoin(
        auth.organization,
        eq(auth.organization.id, main.expertProfiles.orgId)
      )
      .where(eq(main.expertProfiles.id, expertProfileId))
      .limit(1)
    return row ?? null
  })
}
