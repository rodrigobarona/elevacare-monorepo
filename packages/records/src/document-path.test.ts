import { describe, expect, it } from "vitest"
import {
  isSessionDocumentPathname,
  sessionDocumentPrefix,
} from "./document-path"

const ORG = "11111111-1111-4111-8111-111111111111"
const MEMBER = "22222222-2222-4222-8222-222222222222"
const BOOKING = "33333333-3333-4333-8333-333333333333"

describe("sessionDocumentPrefix", () => {
  it("uses the member user id when present", () => {
    expect(
      sessionDocumentPrefix({
        orgId: ORG,
        memberUserId: MEMBER,
        bookingId: BOOKING,
      })
    ).toBe(`records/${ORG}/${MEMBER}/`)
  })

  it("falls back to guest-<bookingId> without a member", () => {
    expect(
      sessionDocumentPrefix({
        orgId: ORG,
        memberUserId: null,
        bookingId: BOOKING,
      })
    ).toBe(`records/${ORG}/guest-${BOOKING}/`)
  })
})

describe("isSessionDocumentPathname", () => {
  const prefix = sessionDocumentPrefix({
    orgId: ORG,
    memberUserId: MEMBER,
    bookingId: BOOKING,
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
})
