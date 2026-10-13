import { createHmac, timingSafeEqual } from "node:crypto"

export const DOCUMENT_URL_TTL_MS = 15 * 60 * 1000
const PURPOSE = "session-document"

export type DocumentUrlGrant = {
  purpose: typeof PURPOSE
  bookingId: string
  documentId: string
  actorUserId: string
  exp: number
}

function grantSecret(secret?: string): string {
  const value = secret ?? process.env.BETTER_AUTH_SECRET
  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is required for document URL grants")
  }
  return value
}

function signingKey(secret?: string): Buffer {
  return createHmac("sha256", grantSecret(secret))
    .update("session-document-grant")
    .digest()
}

function sign(payload: string, secret?: string): string {
  return createHmac("sha256", signingKey(secret))
    .update(payload)
    .digest("base64url")
}

export function mintDocumentUrlGrant(input: {
  bookingId: string
  documentId: string
  actorUserId: string
  now?: Date
  secret?: string
  ttlMs?: number
}): { token: string; expiresAt: Date } {
  const now = input.now ?? new Date()
  const ttl = input.ttlMs ?? DOCUMENT_URL_TTL_MS
  const exp = now.getTime() + ttl
  const payload = [
    PURPOSE,
    input.bookingId,
    input.documentId,
    input.actorUserId,
    String(exp),
  ].join(".")
  const token = `${payload}.${sign(payload, input.secret)}`
  return { token, expiresAt: new Date(exp) }
}

export function verifyDocumentUrlGrant(
  token: string,
  options?: { secret?: string; now?: Date }
): DocumentUrlGrant | null {
  const lastDot = token.lastIndexOf(".")
  if (lastDot <= 0) return null
  const payload = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  const expected = sign(payload, options?.secret)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  const [purpose, bookingId, documentId, actorUserId, expRaw] =
    payload.split(".")
  if (purpose !== PURPOSE || !bookingId || !documentId || !actorUserId) {
    return null
  }
  const exp = Number(expRaw)
  if (!Number.isFinite(exp)) return null
  const now = options?.now ?? new Date()
  if (now.getTime() >= exp) return null
  return { purpose: PURPOSE, bookingId, documentId, actorUserId, exp }
}

export function sessionDocumentDownloadPath(
  bookingId: string,
  documentId: string,
  token: string
): string {
  const params = new URLSearchParams({ g: token })
  return `/sessions/${encodeURIComponent(bookingId)}/documents/${encodeURIComponent(documentId)}/download?${params.toString()}`
}
