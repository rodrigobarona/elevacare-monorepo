import { and, eq, isNull } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import { Resend } from "resend"

export type SyncMarketingContactResult =
  | {
      action: "upserted"
      email: string
      contactId: string | null
      firstName: string | null
      locale: "en" | "pt" | "es"
      orgId: string | null
    }
  | {
      action: "deleted"
      email: string
      contactId: string | null
      orgId: string | null
    }
  | {
      action: "skipped_no_user"
    }
  | {
      action: "skipped_test_recipient"
      email: string
    }

export type SyncMarketingContactDeps = {
  loadUser?: typeof loadMarketingUser
  hasMarketingConsent?: typeof hasActiveMarketingConsent
  createContact?: typeof createResendMarketingContact
  updateContact?: typeof updateResendMarketingContact
  removeContact?: typeof removeResendMarketingContact
  auditSync?: typeof auditMarketingContactSync
}

export class MarketingSyncError extends Error {
  readonly code = "MARKETING_SYNC_FAILED"

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "MarketingSyncError"
  }
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new MarketingSyncError("RESEND_API_KEY is not configured")
  }
  return new Resend(apiKey)
}

function isVercelDeployedRuntime(): boolean {
  // Prefer VERCEL_ENV so a local `next start` (NODE_ENV=production) still
  // takes the e2e @example.com skip. Preview + Production always hit Resend.
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  )
}

/** Resend rejects @example.com outside their allowlist — local e2e uses it. */
function isExampleComRecipient(email: string): boolean {
  const at = email.lastIndexOf("@")
  if (at === -1) return false
  return email.slice(at + 1).toLowerCase() === "example.com"
}

function marketingSegmentId(): string | null {
  return process.env.RESEND_MARKETING_SEGMENT_ID?.trim() || null
}

function marketingAudienceId(): string | null {
  return process.env.RESEND_AUDIENCE_ID?.trim() || null
}

function normalizeLocale(value: string | null | undefined): "en" | "pt" | "es" {
  if (value === "pt" || value === "es" || value === "en") return value
  if (value?.toLowerCase().startsWith("pt")) return "pt"
  if (value?.toLowerCase().startsWith("es")) return "es"
  return "en"
}

export function firstNameFromDisplayName(
  name: string | null | undefined
): string | null {
  const token = name?.trim().split(/\s+/)[0]
  return token || null
}

export async function loadMarketingUser(userId: string): Promise<{
  userId: string
  email: string
  name: string | null
  locale: string | null
} | null> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        userId: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        locale: auth.user.locale,
      })
      .from(auth.user)
      .where(eq(auth.user.id, userId))
      .limit(1)
    return row ?? null
  })
}

export async function hasActiveMarketingConsent(
  userId: string
): Promise<{ granted: boolean; orgId: string | null }> {
  return withPlatformAdminContext(async (tx) => {
    const [row] = await tx
      .select({
        orgId: main.consents.orgId,
      })
      .from(main.consents)
      .where(
        and(
          eq(main.consents.userId, userId),
          eq(main.consents.kind, "marketing"),
          isNull(main.consents.withdrawnAt),
          isNull(main.consents.bookingId)
        )
      )
      .limit(1)
    if (!row) return { granted: false, orgId: null }
    return { granted: true, orgId: row.orgId }
  })
}

async function createResendMarketingContact(input: {
  email: string
  firstName: string | null
  locale: "en" | "pt" | "es"
}): Promise<{ contactId: string | null }> {
  const resend = getResend()
  const segmentId = marketingSegmentId()
  const audienceId = marketingAudienceId()
  const base = {
    email: input.email,
    unsubscribed: false as const,
    ...(input.firstName ? { firstName: input.firstName } : {}),
    properties: { locale: input.locale },
  }
  const { data, error } = segmentId
    ? await resend.contacts.create({
        ...base,
        segments: [{ id: segmentId }],
      })
    : audienceId
      ? await resend.contacts.create({
          ...base,
          audienceId,
        })
      : await resend.contacts.create(base)
  if (error) {
    throw new MarketingSyncError(
      `resend contacts.create failed: ${error.name ?? "Error"}: ${error.message}`,
      { cause: error }
    )
  }
  return { contactId: data?.id ?? null }
}

async function updateResendMarketingContact(input: {
  email: string
  firstName: string | null
  locale: "en" | "pt" | "es"
}): Promise<{ contactId: string | null }> {
  const resend = getResend()
  const { data, error } = await resend.contacts.update({
    email: input.email,
    // Preserve provider-managed unsubscribe; never clear it on routine sync.
    firstName: input.firstName,
    properties: { locale: input.locale },
  })
  if (error) {
    throw new MarketingSyncError(
      `resend contacts.update failed: ${error.name ?? "Error"}: ${error.message}`,
      { cause: error }
    )
  }
  const segmentId = marketingSegmentId()
  if (segmentId) {
    const added = await resend.contacts.segments.add({
      email: input.email,
      segmentId,
    })
    if (added.error) {
      // Already-in-segment is fine; only fail on unexpected errors.
      const message = added.error.message.toLowerCase()
      if (!message.includes("already") && !message.includes("exists")) {
        throw new MarketingSyncError(
          `resend contacts.segments.add failed: ${added.error.name ?? "Error"}: ${added.error.message}`,
          { cause: added.error }
        )
      }
    }
  }
  return { contactId: data?.id ?? null }
}

async function removeResendMarketingContact(input: {
  email: string
}): Promise<{ contactId: string | null }> {
  const resend = getResend()
  const { data, error } = await resend.contacts.remove({
    email: input.email,
  })
  if (error) {
    const message = error.message.toLowerCase()
    if (
      message.includes("not found") ||
      message.includes("does not exist") ||
      error.name === "not_found"
    ) {
      return { contactId: null }
    }
    throw new MarketingSyncError(
      `resend contacts.remove failed: ${error.name ?? "Error"}: ${error.message}`,
      { cause: error }
    )
  }
  return { contactId: data?.contact ?? null }
}

async function auditMarketingContactSync(input: {
  orgId: string
  actorUserId: string
  entityId: string | null
  action: "synced" | "deleted"
  payload: Record<string, unknown>
}): Promise<void> {
  await withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.actorUserId },
    async (_tx, ctx) => {
      await ctx.emit({
        entity: "marketing_contact",
        action: input.action,
        entityId: input.entityId,
        payload: input.payload,
      })
    }
  )
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof MarketingSyncError)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("conflict")
  )
}

const syncLocks = new Map<string, Promise<unknown>>()

/**
 * Serialize Lane 2 sync per user so concurrent grant/withdraw after()
 * (or retry) callbacks cannot recreate a contact after a delete.
 */
export async function withMarketingSyncLock<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  const previous = syncLocks.get(userId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  syncLocks.set(userId, tail)
  await previous.catch(() => undefined)
  try {
    return await fn()
  } finally {
    release()
    if (syncLocks.get(userId) === tail) {
      syncLocks.delete(userId)
    }
  }
}

/**
 * Neon → Resend one-way contact sync (Lane 2 stub).
 * Upserts only name/email/locale when marketing consent is active;
 * deletes the Resend contact when consent is absent/withdrawn.
 */
export async function syncMarketingContact(
  input: { userId: string; orgId?: string },
  deps: SyncMarketingContactDeps = {}
): Promise<SyncMarketingContactResult> {
  return withMarketingSyncLock(input.userId, () =>
    syncMarketingContactUnlocked(input, deps)
  )
}

async function syncMarketingContactUnlocked(
  input: { userId: string; orgId?: string },
  deps: SyncMarketingContactDeps
): Promise<SyncMarketingContactResult> {
  const loadUser = deps.loadUser ?? loadMarketingUser
  const hasConsent = deps.hasMarketingConsent ?? hasActiveMarketingConsent
  const createContact = deps.createContact ?? createResendMarketingContact
  const updateContact = deps.updateContact ?? updateResendMarketingContact
  const removeContact = deps.removeContact ?? removeResendMarketingContact
  const auditSync = deps.auditSync ?? auditMarketingContactSync

  const user = await loadUser(input.userId)
  if (!user?.email) {
    return { action: "skipped_no_user" }
  }

  // Re-read consent inside the per-user lock so a concurrent withdraw
  // that already ran cannot be overwritten by a stale grant.
  const consent = await hasConsent(input.userId)
  const orgId = input.orgId ?? consent.orgId
  const email = user.email.trim().toLowerCase()
  const firstName = firstNameFromDisplayName(user.name)
  const locale = normalizeLocale(user.locale)

  const usingInjectedProvider =
    deps.createContact !== undefined ||
    deps.updateContact !== undefined ||
    deps.removeContact !== undefined

  // Local/dev e2e uses @example.com; Resend rejects it. Consent writes must
  // still succeed — never call the live provider for test recipients off Vercel.
  if (
    !usingInjectedProvider &&
    !isVercelDeployedRuntime() &&
    isExampleComRecipient(email)
  ) {
    return { action: "skipped_test_recipient", email }
  }

  if (!consent.granted) {
    const removed = await removeContact({ email })
    if (orgId) {
      await auditSync({
        orgId,
        actorUserId: input.userId,
        entityId: removed.contactId,
        action: "deleted",
        payload: { userId: input.userId },
      })
    }
    return {
      action: "deleted",
      email,
      contactId: removed.contactId,
      orgId,
    }
  }

  let contactId: string | null
  try {
    const created = await createContact({ email, firstName, locale })
    contactId = created.contactId
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error
    const updated = await updateContact({ email, firstName, locale })
    contactId = updated.contactId
  }

  // Confirm consent is still active after the provider write.
  const consentAfter = await hasConsent(input.userId)
  if (!consentAfter.granted) {
    const removed = await removeContact({ email })
    const deleteOrgId = input.orgId ?? consentAfter.orgId ?? orgId
    if (deleteOrgId) {
      await auditSync({
        orgId: deleteOrgId,
        actorUserId: input.userId,
        entityId: removed.contactId,
        action: "deleted",
        payload: { userId: input.userId, reason: "consent_raced" },
      })
    }
    return {
      action: "deleted",
      email,
      contactId: removed.contactId,
      orgId: deleteOrgId,
    }
  }

  if (orgId) {
    await auditSync({
      orgId,
      actorUserId: input.userId,
      entityId: contactId,
      action: "synced",
      payload: {
        userId: input.userId,
        locale,
        // firstName only — never last name / PHI / email
        hasFirstName: Boolean(firstName),
      },
    })
  }

  return {
    action: "upserted",
    email,
    contactId,
    firstName,
    locale,
    orgId,
  }
}
