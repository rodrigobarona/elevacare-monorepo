import { randomBytes, timingSafeEqual } from "node:crypto"
import { InvoicingProviderSlug } from "./types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** TOConline authorization codes are short-lived; 10 minutes is enough. */
export const ACCOUNTING_OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export type AccountingOAuthProvider = Exclude<InvoicingProviderSlug, "manual">

export interface AccountingOAuthState {
  provider: AccountingOAuthProvider
  expertProfileId: string
  nonce: string
}

export interface StoredAccountingOAuthNonce {
  nonce: string
  provider: AccountingOAuthProvider
  userId: string
  expertProfileId: string
  exp: number
}

export function createAccountingOAuthNonce(): string {
  return randomBytes(32).toString("base64url")
}

export function encodeAccountingOAuthState(
  input: AccountingOAuthState
): string {
  return `${input.provider}:${input.expertProfileId}:${input.nonce}`
}

export function parseAccountingOAuthState(
  state: string
): AccountingOAuthState | null {
  const parts = state.split(":")
  if (parts.length !== 3) return null
  const rawProvider = parts[0]
  const expertProfileId = parts[1]
  const nonce = parts[2]
  if (!rawProvider || !expertProfileId || !nonce) return null
  const parsed = InvoicingProviderSlug.safeParse(rawProvider)
  if (!parsed.success || parsed.data === "manual") return null
  if (!UUID_RE.test(expertProfileId) || nonce.length < 16) {
    return null
  }
  return {
    provider: parsed.data,
    expertProfileId,
    nonce,
  }
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function storedAccountingOAuthNonce(
  metadata: Record<string, unknown> | null | undefined
): StoredAccountingOAuthNonce | null {
  const raw = metadata?.accountingOAuth
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const parsed = InvoicingProviderSlug.safeParse(value.provider)
  if (
    typeof value.nonce !== "string" ||
    value.nonce.length < 16 ||
    !parsed.success ||
    parsed.data === "manual" ||
    typeof value.userId !== "string" ||
    typeof value.expertProfileId !== "string" ||
    !UUID_RE.test(value.expertProfileId) ||
    typeof value.exp !== "number"
  ) {
    return null
  }
  return {
    nonce: value.nonce,
    provider: parsed.data,
    userId: value.userId,
    expertProfileId: value.expertProfileId,
    exp: value.exp,
  }
}

export function verifyStoredAccountingOAuthNonce(input: {
  stored: StoredAccountingOAuthNonce | null
  state: AccountingOAuthState
  userId: string
  nowMs?: number
}): boolean {
  if (!input.stored) return false
  const now = input.nowMs ?? Date.now()
  if (input.stored.exp < now) return false
  if (input.stored.provider !== input.state.provider) return false
  if (!safeEqual(input.stored.userId, input.userId)) return false
  if (!safeEqual(input.stored.expertProfileId, input.state.expertProfileId)) {
    return false
  }
  return safeEqual(input.stored.nonce, input.state.nonce)
}
