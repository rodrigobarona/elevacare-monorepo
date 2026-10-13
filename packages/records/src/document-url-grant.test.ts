import { describe, expect, it } from "vitest"
import {
  DOCUMENT_URL_TTL_MS,
  mintDocumentUrlGrant,
  sessionDocumentDownloadPath,
  verifyDocumentUrlGrant,
} from "./document-url-grant"

const SECRET = "test-document-url-secret-value"
const BOOKING = "11111111-1111-4111-8111-111111111111"
const DOC = "22222222-2222-4222-8222-222222222222"
const ACTOR = "33333333-3333-4333-8333-333333333333"

describe("document URL grants", () => {
  it("mints a grant that expires within 15 minutes", () => {
    const now = new Date("2026-10-13T08:00:00.000Z")
    const { token, expiresAt } = mintDocumentUrlGrant({
      bookingId: BOOKING,
      documentId: DOC,
      actorUserId: ACTOR,
      now,
      secret: SECRET,
    })
    expect(expiresAt.getTime() - now.getTime()).toBe(DOCUMENT_URL_TTL_MS)
    expect(DOCUMENT_URL_TTL_MS).toBe(15 * 60 * 1000)
    const claims = verifyDocumentUrlGrant(token, { secret: SECRET, now })
    expect(claims).toEqual({
      purpose: "session-document",
      bookingId: BOOKING,
      documentId: DOC,
      actorUserId: ACTOR,
      exp: expiresAt.getTime(),
    })
  })

  it("rejects an expired or tampered grant", () => {
    const now = new Date("2026-10-13T08:00:00.000Z")
    const { token } = mintDocumentUrlGrant({
      bookingId: BOOKING,
      documentId: DOC,
      actorUserId: ACTOR,
      now,
      secret: SECRET,
      ttlMs: 1,
    })
    expect(
      verifyDocumentUrlGrant(token, {
        secret: SECRET,
        now: new Date(now.getTime() + 2),
      })
    ).toBeNull()
    expect(
      verifyDocumentUrlGrant(`${token}x`, { secret: SECRET, now })
    ).toBeNull()
  })

  it("builds a download path with the grant query", () => {
    expect(sessionDocumentDownloadPath(BOOKING, DOC, "abc.def")).toBe(
      `/sessions/${BOOKING}/documents/${DOC}/download?g=abc.def`
    )
  })
})
