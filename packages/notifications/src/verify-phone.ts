import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm"
import { withPlatformAudit } from "@eleva/audit"
import { auth, main, withPlatformAdminContext } from "@eleva/db"
import {
  sendViaTwilio,
  type SendSmsInput,
  type SendSmsResult,
} from "./send-sms"

export const PHONE_E164_PATTERN = /^\+[1-9][0-9]{7,14}$/
export const PHONE_OTP_TTL_MS = 10 * 60 * 1000

export class PhoneVerifyError extends Error {
  constructor(
    readonly code: "VALIDATION" | "EXPIRED" | "INVALID_CODE" | "PHONE_IN_USE",
    message: string
  ) {
    super(message)
    this.name = "PhoneVerifyError"
  }
}

export type VerifyPhoneStartResult =
  | { status: "already_verified"; phoneE164: string }
  | { status: "started"; phoneE164: string }

export type VerifyPhoneConfirmResult = {
  status: "verified"
  phoneE164: string
}

export type VerifyPhoneDeps = {
  now?: () => Date
  sendSms?: (input: SendSmsInput) => Promise<SendSmsResult>
}

function assertPhoneE164(phoneE164: string): string {
  const trimmed = phoneE164.trim()
  if (!PHONE_E164_PATTERN.test(trimmed)) {
    throw new PhoneVerifyError(
      "VALIDATION",
      "phoneE164 must be E.164 (+ and 8-15 digits)"
    )
  }
  return trimmed
}

function otpPepper(): string {
  const pepper = process.env.BETTER_AUTH_SECRET?.trim()
  if (!pepper) {
    throw new Error("[verify-phone] BETTER_AUTH_SECRET is required")
  }
  return pepper
}

export function hashPhoneOtp(input: {
  userId: string
  phoneE164: string
  code: string
}): string {
  return createHash("sha256")
    .update(`${otpPepper()}:${input.userId}:${input.phoneE164}:${input.code}`)
    .digest("hex")
}

function otpMatches(storedHash: string, computedHash: string): boolean {
  const stored = Buffer.from(storedHash, "hex")
  const computed = Buffer.from(computedHash, "hex")
  if (stored.length !== computed.length) return false
  return timingSafeEqual(stored, computed)
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

export async function verifyPhoneStart(
  input: { userId: string; orgId: string; phoneE164: string },
  deps: VerifyPhoneDeps = {}
): Promise<VerifyPhoneStartResult> {
  const phoneE164 = assertPhoneE164(input.phoneE164)
  const now = deps.now?.() ?? new Date()
  const sendSms = deps.sendSms ?? sendViaTwilio

  const existing = await withPlatformAdminContext(async (tx) => {
    const [user] = await tx
      .select({
        phoneE164: auth.user.phoneE164,
        phoneVerifiedAt: auth.user.phoneVerifiedAt,
      })
      .from(auth.user)
      .where(eq(auth.user.id, input.userId))
      .limit(1)
    return user ?? null
  })
  if (!existing) {
    throw new PhoneVerifyError("VALIDATION", "user not found")
  }
  if (existing.phoneE164 === phoneE164 && existing.phoneVerifiedAt) {
    return { status: "already_verified", phoneE164 }
  }

  const code = generateOtp()
  const expiresAt = new Date(now.getTime() + PHONE_OTP_TTL_MS)
  await withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      await tx
        .delete(main.phoneVerifications)
        .where(
          and(
            eq(main.phoneVerifications.userId, input.userId),
            isNull(main.phoneVerifications.verifiedAt)
          )
        )
      const [row] = await tx
        .insert(main.phoneVerifications)
        .values({
          userId: input.userId,
          phoneE164,
          codeHash: hashPhoneOtp({ userId: input.userId, phoneE164, code }),
          expiresAt,
        })
        .returning({ id: main.phoneVerifications.id })
      if (!row) {
        throw new Error("[verify-phone] failed to insert verification row")
      }
      await ctx.emit({
        entity: "phone",
        action: "requested",
        entityId: row.id,
        payload: { userId: input.userId },
      })
    }
  )

  await sendSms({
    to: phoneE164,
    body: `Your Eleva verification code is ${code}. It expires in 10 minutes.`,
  })
  return { status: "started", phoneE164 }
}

export async function verifyPhoneConfirm(
  input: {
    userId: string
    orgId: string
    phoneE164: string
    code: string
  },
  deps: VerifyPhoneDeps = {}
): Promise<VerifyPhoneConfirmResult> {
  const phoneE164 = assertPhoneE164(input.phoneE164)
  const code = input.code.trim()
  if (!/^\d{6}$/.test(code)) {
    throw new PhoneVerifyError("VALIDATION", "code must be 6 digits")
  }
  const now = deps.now?.() ?? new Date()

  return withPlatformAudit(
    { orgId: input.orgId, actorUserId: input.userId },
    async (tx, ctx) => {
      const [taken] = await tx
        .select({ id: auth.user.id })
        .from(auth.user)
        .where(
          and(
            eq(auth.user.phoneE164, phoneE164),
            isNotNull(auth.user.phoneVerifiedAt),
            ne(auth.user.id, input.userId)
          )
        )
        .limit(1)
      if (taken) {
        throw new PhoneVerifyError(
          "PHONE_IN_USE",
          "that phone is already verified on another account"
        )
      }

      const [row] = await tx
        .select()
        .from(main.phoneVerifications)
        .where(
          and(
            eq(main.phoneVerifications.userId, input.userId),
            eq(main.phoneVerifications.phoneE164, phoneE164),
            isNull(main.phoneVerifications.verifiedAt)
          )
        )
        .orderBy(desc(main.phoneVerifications.createdAt))
        .limit(1)
      if (!row) {
        throw new PhoneVerifyError("EXPIRED", "no pending verification")
      }
      if (row.expiresAt <= now) {
        throw new PhoneVerifyError("EXPIRED", "verification code expired")
      }
      const computed = hashPhoneOtp({
        userId: input.userId,
        phoneE164,
        code,
      })
      if (!otpMatches(row.codeHash, computed)) {
        throw new PhoneVerifyError("INVALID_CODE", "verification code invalid")
      }

      await tx
        .update(main.phoneVerifications)
        .set({ verifiedAt: now })
        .where(eq(main.phoneVerifications.id, row.id))
      await tx
        .update(auth.user)
        .set({
          phoneE164,
          phoneVerifiedAt: now,
          updatedAt: now,
        })
        .where(eq(auth.user.id, input.userId))
      await ctx.emit({
        entity: "phone",
        action: "verified",
        entityId: input.userId,
        payload: { phoneE164 },
      })
      return { status: "verified" as const, phoneE164 }
    }
  )
}
