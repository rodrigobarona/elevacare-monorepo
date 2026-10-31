import { afterEach, describe, expect, it, vi } from "vitest"

import { avatarKey, isAvatarUrl } from "./avatar-upload"

const BASE = "https://media.example.com"
const OWNER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"

describe("avatar keys", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("places the file under the owner", () => {
    expect(avatarKey("avatar/profile/me.png", OWNER)).toBe(
      `avatar/profile/${OWNER}/me.png`
    )
  })

  it("accepts only the owner's avatar", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", BASE)
    const url = `${BASE}/${avatarKey("avatar/profile/me.png", OWNER)}`
    expect(isAvatarUrl(url, OWNER)).toBe(true)
    expect(isAvatarUrl(url, OTHER)).toBe(false)
    expect(isAvatarUrl(`${BASE}/avatar/profile/me.png`, OWNER)).toBe(false)
    expect(isAvatarUrl(`${BASE}/avatar/profile/${OWNER}/a/b.png`, OWNER)).toBe(
      false
    )
    expect(isAvatarUrl(`${BASE}/media/hero.png`, OWNER)).toBe(false)
  })
})
