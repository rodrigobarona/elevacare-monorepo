import { and, desc, eq, isNull } from "drizzle-orm"
import { withAudit, withPlatformAudit } from "@eleva/audit"
import {
  main,
  memberHasConfirmedFutureBooking,
  withPlatformAdminContext,
} from "@eleva/db"
import {
  CONSENT_DOCUMENT_VERSION,
  CONSENT_KINDS,
  type ConsentKind,
} from "./consents"

export class MemberConsentConflictError extends Error {
  readonly code = "HEALTH_DATA_CONSENT_IN_USE"

  constructor() {
    super(
      "health_data_processing cannot be withdrawn while a confirmed future booking exists"
    )
    this.name = "MemberConsentConflictError"
  }
}

export type MemberConsentStatus = {
  kind: ConsentKind
  version: string
  grantedAt: Date | null
  withdrawnAt: Date | null
  source: (typeof main.consentSourceEnum.enumValues)[number] | null
}

export async function listMemberConsents(
  userId: string
): Promise<MemberConsentStatus[]> {
  const rows = await withPlatformAdminContext((tx) =>
    tx
      .select({
        kind: main.consents.kind,
        documentVersion: main.consents.documentVersion,
        grantedAt: main.consents.grantedAt,
        withdrawnAt: main.consents.withdrawnAt,
        source: main.consents.source,
      })
      .from(main.consents)
      .where(eq(main.consents.userId, userId))
      .orderBy(desc(main.consents.grantedAt))
  )

  const latest = pickLatestConsentPerKind(rows)

  return CONSENT_KINDS.map((kind) => {
    const row = latest.get(kind)
    if (row) return row
    return {
      kind,
      version: CONSENT_DOCUMENT_VERSION,
      grantedAt: null,
      withdrawnAt: null,
      source: null,
    }
  })
}

export function pickLatestConsentPerKind(
  rows: Array<{
    kind: ConsentKind
    documentVersion: string
    grantedAt: Date | null
    withdrawnAt: Date | null
    source: MemberConsentStatus["source"]
  }>
): Map<ConsentKind, MemberConsentStatus> {
  const ranked = [...rows].sort((a, b) => {
    const aActive = a.withdrawnAt == null ? 0 : 1
    const bActive = b.withdrawnAt == null ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return (b.grantedAt?.getTime() ?? 0) - (a.grantedAt?.getTime() ?? 0)
  })
  const latest = new Map<ConsentKind, MemberConsentStatus>()
  for (const row of ranked) {
    if (latest.has(row.kind)) continue
    latest.set(row.kind, {
      kind: row.kind,
      version: row.documentVersion,
      grantedAt: row.grantedAt,
      withdrawnAt: row.withdrawnAt,
      source: row.source,
    })
  }
  return latest
}

export async function updateMemberConsent(input: {
  userId: string
  orgId: string
  kind: ConsentKind
  granted: boolean
  version?: string
  locale?: "en" | "pt" | "es"
}): Promise<MemberConsentStatus[]> {
  if (!input.granted && input.kind === "health_data_processing") {
    if (await memberHasConfirmedFutureBooking(input.userId)) {
      throw new MemberConsentConflictError()
    }
  }

  const version = input.version ?? CONSENT_DOCUMENT_VERSION
  const locale = input.locale ?? "en"

  if (input.granted) {
    await withAudit(
      { orgId: input.orgId, actorUserId: input.userId },
      async (tx, ctx) => {
        const [active] = await tx
          .select({ id: main.consents.id })
          .from(main.consents)
          .where(
            and(
              eq(main.consents.userId, input.userId),
              eq(main.consents.orgId, input.orgId),
              eq(main.consents.kind, input.kind),
              eq(main.consents.documentVersion, version),
              isNull(main.consents.withdrawnAt),
              isNull(main.consents.bookingId)
            )
          )
          .limit(1)

        if (!active) {
          await tx.insert(main.consents).values({
            orgId: input.orgId,
            subjectKind: "user",
            userId: input.userId,
            kind: input.kind,
            documentVersion: version,
            locale,
            source: "account",
          })
        }

        await ctx.emit({
          entity: "consent",
          action: "granted",
          entityId: input.userId,
          payload: { kind: input.kind, version },
        })
      }
    )
    return listMemberConsents(input.userId)
  }

  await withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const conditions = [
        eq(main.consents.userId, input.userId),
        eq(main.consents.kind, input.kind),
        isNull(main.consents.withdrawnAt),
      ]
      if (input.kind === "marketing") {
        conditions.push(isNull(main.consents.bookingId))
      }
      await tx
        .update(main.consents)
        .set({ withdrawnAt: new Date() })
        .where(and(...conditions))
      await ctx.emit({
        entity: "consent",
        action: "withdrawn",
        entityId: input.userId,
        payload: { kind: input.kind },
      })
    }
  )
  return listMemberConsents(input.userId)
}
