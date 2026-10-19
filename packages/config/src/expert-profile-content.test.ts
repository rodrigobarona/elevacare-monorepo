import { describe, expect, it } from "vitest"
import {
  isAllowedSocialLinkUrl,
  isExpertPortraitUrl,
} from "./expert-profile-content"

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

describe("isExpertPortraitUrl", () => {
  const own =
    "https://abc123.public.blob.vercel-storage.com/expert/portrait/user-1/me-x1.jpg"

  it("accepts portraits in the public Blob store", () => {
    expect(isExpertPortraitUrl(own)).toBe(true)
  })

  it("checks the owner segment when an owner is given", () => {
    expect(isExpertPortraitUrl(own, "user-1")).toBe(true)
    expect(isExpertPortraitUrl(own, "user-2")).toBe(false)
  })

  it("rejects other paths, hosts and protocols", () => {
    expect(
      isExpertPortraitUrl(
        "https://abc123.public.blob.vercel-storage.com/avatar/profile/me.jpg"
      )
    ).toBe(false)
    expect(
      isExpertPortraitUrl(
        "https://abc123.public.blob.vercel-storage.com/expert/portrait/me.jpg"
      )
    ).toBe(false)
    expect(
      isExpertPortraitUrl(
        "https://evil.example.com/expert/portrait/user-1/me.jpg"
      )
    ).toBe(false)
    expect(
      isExpertPortraitUrl(
        "http://abc123.public.blob.vercel-storage.com/expert/portrait/user-1/me.jpg"
      )
    ).toBe(false)
  })
})
