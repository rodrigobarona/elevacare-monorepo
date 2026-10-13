import { describe, expect, it } from "vitest"
import {
  isSessionDocumentPathname,
  sessionDocumentPrefix,
} from "./document-path"

const ORG = "11111111-1111-4111-8111-111111111111"
const MEMBER = "22222222-2222-4222-8222-222222222222"
const BOOKING = "33333333-3333-4333-8333-333333333333"
const ACTOR = "44444444-4444-4444-8444-444444444444"
const OTHER = "55555555-5555-4555-8555-555555555555"

describe("sessionDocumentPrefix", () => {
  it("uses the member user id and actor when present", () => {
    expect(
      sessionDocumentPrefix({
        orgId: ORG,
        memberUserId: MEMBER,
        bookingId: BOOKING,
        actorUserId: ACTOR,
      })
    ).toBe(`records/${ORG}/${MEMBER}/${ACTOR}/`)
  })

  it("falls back to guest-<bookingId> without a member", () => {
    expect(
      sessionDocumentPrefix({
        orgId: ORG,
        memberUserId: null,
        bookingId: BOOKING,
        actorUserId: ACTOR,
      })
    ).toBe(`records/${ORG}/guest-${BOOKING}/${ACTOR}/`)
  })

  it("keeps expert and member prefixes distinct", () => {
    expect(
      sessionDocumentPrefix({
        orgId: ORG,
        memberUserId: MEMBER,
        bookingId: BOOKING,
        actorUserId: ACTOR,
      })
    ).not.toBe(
      sessionDocumentPrefix({
        orgId: ORG,
        memberUserId: MEMBER,
        bookingId: BOOKING,
        actorUserId: OTHER,
      })
    )
  })
})

describe("isSessionDocumentPathname", () => {
  const prefix = sessionDocumentPrefix({
    orgId: ORG,
    memberUserId: MEMBER,
    bookingId: BOOKING,
    actorUserId: ACTOR,
  })

  it("accepts a file under the prefix", () => {
    expect(isSessionDocumentPathname(`${prefix}note.pdf`, prefix)).toBe(true)
    expect(isSessionDocumentPathname(`${prefix}docs/scan.png`, prefix)).toBe(
      true
    )
  })

  it("rejects traversal and other orgs", () => {
    expect(isSessionDocumentPathname(`${prefix}../secret.pdf`, prefix)).toBe(
      false
    )
    expect(isSessionDocumentPathname(`${prefix}//x.pdf`, prefix)).toBe(false)
    expect(
      isSessionDocumentPathname(`records/${ORG}/other/file.pdf`, prefix)
    ).toBe(false)
    expect(isSessionDocumentPathname(prefix, prefix)).toBe(false)
  })

  it("rejects another actor's blob on the same booking", () => {
    const otherPrefix = sessionDocumentPrefix({
      orgId: ORG,
      memberUserId: MEMBER,
      bookingId: BOOKING,
      actorUserId: OTHER,
    })
    expect(isSessionDocumentPathname(`${otherPrefix}scan.pdf`, prefix)).toBe(
      false
    )
  })
})
