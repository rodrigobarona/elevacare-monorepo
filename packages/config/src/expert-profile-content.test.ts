import { describe, expect, it } from "vitest"
import { isAllowedSocialLinkUrl } from "./expert-profile-content"

describe("isAllowedSocialLinkUrl", () => {
  it("accepts platform links on their own domain", () => {
    expect(
      isAllowedSocialLinkUrl("instagram", "https://www.instagram.com/fisiomota")
    ).toBe(true)
    expect(
      isAllowedSocialLinkUrl("linkedin", "https://pt.linkedin.com/in/ana")
    ).toBe(true)
    expect(isAllowedSocialLinkUrl("youtube", "https://youtu.be/abc")).toBe(true)
  })

  it("rejects other domains, lookalikes and non-https links", () => {
    expect(
      isAllowedSocialLinkUrl("instagram", "https://instagram.com.evil.io/x")
    ).toBe(false)
    expect(isAllowedSocialLinkUrl("tiktok", "https://example.com/@ana")).toBe(
      false
    )
    expect(isAllowedSocialLinkUrl("website", "http://ana.pt")).toBe(false)
    expect(isAllowedSocialLinkUrl("website", "javascript:alert(1)")).toBe(false)
    expect(isAllowedSocialLinkUrl("website", "https://user:pass@ana.pt")).toBe(
      false
    )
  })

  it("accepts any https website with a real host", () => {
    expect(isAllowedSocialLinkUrl("website", "https://fisiomota.pt")).toBe(true)
    expect(isAllowedSocialLinkUrl("website", "https://localhost")).toBe(false)
  })
})
