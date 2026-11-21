import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { resolveGatewayUrl } from "@eleva/config/env"
import { teamWorkspaceBase } from "@eleva/config/routing"
import {
  auth,
  CLINIC_DECISION_EVENT_TYPES,
  main,
  withPlatformAdminContext,
  type ClinicDecisionEventType,
} from "@eleva/db"
import {
  clinicDecisionCopy,
  getEmailTranslations,
  renderClinicDecision,
} from "@eleva/email"
import { sendNotification } from "./send-notification"
import { toEmailLocale } from "./send-closed-gate-invoice"

const CLINIC_DECISION_TYPES = new Set<string>(CLINIC_DECISION_EVENT_TYPES)

const PayloadSchema = z.object({
  verificationId: z.string().uuid(),
  reason: z.string().nullable(),
  verified: z.boolean(),
})

export type ClinicDecisionEvent = {
  id: string
  type: string
  orgId: string
  payload: Record<string, unknown>
}

export type ClinicToNotify = {
  orgSlug: string
  clinicName: string
  /** The owner and the admins: the people who can act on the decision. */
  managers: { userId: string; name: string; locale: string | null }[]
}

type SendDeps = {
  loadClinic?: (orgId: string) => Promise<ClinicToNotify | null>
  send?: typeof sendNotification
}

export function isClinicDecisionKind(
  type: string
): type is ClinicDecisionEventType {
  return CLINIC_DECISION_TYPES.has(type)
}

/**
 * Tells a clinic's owner and admins what staff decided about its legal
 * identity: an email and an inbox notice each, in their own language, with
 * what staff found and a link to the clinic's Verification page.
 */
export async function sendClinicDecisionNotification(
  event: ClinicDecisionEvent,
  deps: SendDeps = {}
): Promise<void> {
  if (!isClinicDecisionKind(event.type)) {
    throw new Error(`send-notification: unsupported event type ${event.type}`)
  }
  const parsed = PayloadSchema.safeParse(event.payload)
  if (!parsed.success) {
    throw new Error("send-notification: clinic payload is invalid")
  }
  const clinic = await (deps.loadClinic ?? loadClinic)(event.orgId)
  if (!clinic) {
    throw new Error("send-notification: clinic not found for event org")
  }
  const href = `${resolveGatewayUrl()}${teamWorkspaceBase(clinic.orgSlug)}/verification`
  const send = deps.send ?? sendNotification

  for (const manager of clinic.managers) {
    const locale = toEmailLocale(manager.locale)
    const copy = clinicDecisionCopy(
      getEmailTranslations(locale),
      event.type,
      parsed.data.verified
    )
    const html = await renderClinicDecision({
      kind: event.type,
      verificationHref: href,
      clinicName: clinic.clinicName,
      reason: parsed.data.reason,
      verified: parsed.data.verified,
      name: manager.name.trim().split(/\s+/)[0],
      locale,
    })
    await send({
      kind: event.type,
      orgId: event.orgId,
      recipient: { userId: manager.userId },
      ctx: {
        title: copy.title,
        body: copy.subtitle,
        subject: copy.subject,
        html,
        href,
      },
      // One notice per person; a retry of the event never sends it twice.
      idempotencyKey: `clinic:${event.id}:${manager.userId}`,
    })
  }
}

async function loadClinic(orgId: string): Promise<ClinicToNotify | null> {
  return withPlatformAdminContext(async (tx) => {
    const [org] = await tx
      .select({
        slug: auth.organization.slug,
        name: auth.organization.name,
        clinicName: main.clinicProfiles.displayName,
      })
      .from(auth.organization)
      .leftJoin(
        main.clinicProfiles,
        eq(main.clinicProfiles.orgId, auth.organization.id)
      )
      .where(
        and(eq(auth.organization.id, orgId), eq(auth.organization.type, "team"))
      )
      .limit(1)
    if (!org) return null
    const members = await tx
      .select({
        userId: auth.member.userId,
        role: auth.member.role,
        name: auth.user.name,
        locale: auth.user.locale,
      })
      .from(auth.member)
      .innerJoin(auth.user, eq(auth.user.id, auth.member.userId))
      .where(eq(auth.member.organizationId, orgId))
    return {
      orgSlug: org.slug,
      clinicName: org.clinicName ?? org.name,
      managers: members
        .filter((member) =>
          member.role.split(",").some((role) => {
            const slug = role.trim().toLowerCase()
            return slug === "owner" || slug === "admin"
          })
        )
        .map(({ userId, name, locale }) => ({ userId, name, locale })),
    }
  })
}
