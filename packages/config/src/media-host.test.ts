import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  mediaBaseUrl,
  mediaKeyFromUrl,
  mediaOrigin,
  mediaRemotePatterns,
  mediaUrl,
} from "./media-host.mjs"

describe("media host", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("R2_PUBLIC_BASE_URL", "")
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://media.example.com/")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("normalises the base URL and builds object URLs", () => {
    expect(mediaBaseUrl()).toBe("https://media.example.com")
    expect(mediaOrigin()).toBe("https://media.example.com")
    expect(mediaUrl("media/eleva/a.jpg")).toBe(
      "https://media.example.com/media/eleva/a.jpg"
    )
  })

  it("falls back to R2_PUBLIC_BASE_URL on the API", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "")
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.example.com")
    expect(mediaBaseUrl()).toBe("https://media.example.com")
  })

  it("stays root-relative with no configured host", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "")
    expect(mediaBaseUrl()).toBeNull()
    expect(mediaOrigin()).toBeNull()
    expect(mediaUrl("media/a.jpg")).toBe("/media/a.jpg")
    expect(mediaKeyFromUrl("https://media.example.com/media/a.jpg")).toBeNull()
    expect(mediaRemotePatterns()).toEqual([])
  })

  it("extracts keys only from URLs on the media host", () => {
    expect(mediaKeyFromUrl("https://media.example.com/avatar/p/a.jpg")).toBe(
      "avatar/p/a.jpg"
    )
    for (const url of [
      "http://media.example.com/avatar/p/a.jpg",
      "https://media.example.com.evil.test/avatar/p/a.jpg",
      "https://evil.test/https://media.example.com/a.jpg",
      "https://abc.public.blob.vercel-storage.com/avatar/p/a.jpg",
      "https://media.example.com/a.jpg?x=1",
      "https://media.example.com/a.jpg#x",
      "https://media.example.com/",
      "not a url",
    ]) {
      expect(mediaKeyFromUrl(url), url).toBeNull()
    }
  })

  it("keeps a path on the base for local S3 servers", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "http://127.0.0.1:9100/eleva")
    expect(mediaKeyFromUrl("http://127.0.0.1:9100/eleva/a.jpg")).toBe("a.jpg")
    expect(mediaKeyFromUrl("http://127.0.0.1:9100/other/a.jpg")).toBeNull()
    expect(mediaRemotePatterns()).toEqual([
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9100",
        pathname: "/eleva/**",
      },
    ])
  })

  it("refuses r2.dev in production only", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "https://pub-1.r2.dev")
    expect(mediaBaseUrl()).toBe("https://pub-1.r2.dev")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(() => mediaBaseUrl()).toThrow(/r2\.dev/)
  })
})
