import { describe, expect, it } from "vitest"
import { invitationAcceptUrl } from "./invitation-accept-url"

describe("invitationAcceptUrl", () => {
  it("builds an absolute accept-invitation URL from ACCOUNT_URL", () => {
    expect(
      invitationAcceptUrl("inv-1", {
        ACCOUNT_URL: "https://account.eleva.care/",
      })
    ).toBe("https://account.eleva.care/accept-invitation?id=inv-1")
  })

  it("encodes the invitation id", () => {
    expect(
      invitationAcceptUrl("a b", { ACCOUNT_URL: "https://account.eleva.care" })
    ).toBe("https://account.eleva.care/accept-invitation?id=a%20b")
  })
})
