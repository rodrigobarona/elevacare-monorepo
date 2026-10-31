import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EXPERT_PORTRAIT_UPLOAD } from "@eleva/config/expert-profile-content"

const updateExpertProfile = vi.fn()
const emit = vi.fn()
const deletePublicObject = vi.fn()
const verifyUpload = vi.fn()
const MEDIA_BASE_URL = "https://media.example.com"
const PORTRAITS = `${MEDIA_BASE_URL}/expert/portrait`
const OLD_PORTRAIT = `${PORTRAITS}/user-1/old.jpg`
const NEW_PORTRAIT = `${PORTRAITS}/user-1/new.jpg`
const FOREIGN_PORTRAIT = `${PORTRAITS}/user-2/theirs.jpg`
let storedAvatarUrl: string | null = OLD_PORTRAIT

vi.mock("@eleva/storage", () => ({
  deletePublicObject: (...args: unknown[]) => deletePublicObject(...args),
}))

vi.mock("@eleva/storage/upload-handler", () => {
  class UploadRejectedError extends Error {}
  return {
    UploadRejectedError,
    verifyUpload: (...args: unknown[]) => verifyUpload(...args),
  }
})

vi.mock("@eleva/db", () => ({
  getExpertProfileByUserId: vi.fn(async () => ({
    id: "profile-1",
    orgId: "org-1",
    metadata: {},
    avatarUrl: storedAvatarUrl,
  })),
  updateExpertProfile: (...args: unknown[]) => updateExpertProfile(...args),
}))

vi.mock("@eleva/audit", () => ({
  withAudit: async (
    _options: unknown,
    fn: (tx: unknown, ctx: { emit: typeof emit }) => Promise<unknown>
  ) => fn({}, { emit }),
}))

vi.mock("@/lib/auth", () => ({
  requireApiCapability: vi.fn(async () => ({ user: { id: "user-1" } })),
  apiAuthFailure: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  rateLimitKey: () => "expert-profile",
  RATE_LIMITS: {
    authenticated: { prefix: "auth", maxRequests: 60, windowMs: 60_000 },
  },
}))

import { PATCH } from "./route"

function patch(body: unknown) {
  return PATCH(
    new Request("http://127.0.0.1:3002/expert/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

function updatedFields(): Record<string, unknown> {
  return updateExpertProfile.mock.calls[0]?.[2] as Record<string, unknown>
}

describe("PATCH /expert/profile content", () => {
  beforeEach(() => {
    updateExpertProfile.mockReset()
    emit.mockReset()
    deletePublicObject.mockReset()
    verifyUpload.mockReset()
    verifyUpload.mockResolvedValue({})
    vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", MEDIA_BASE_URL)
    storedAvatarUrl = OLD_PORTRAIT
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("verifies a new portrait against the upload limits before saving", async () => {
    const response = await patch({ avatarUrl: NEW_PORTRAIT })

    expect(response.status).toBe(200)
    expect(verifyUpload).toHaveBeenCalledWith({
      store: "public",
      pathname: "expert/portrait/user-1/new.jpg",
      allowedContentTypes: EXPERT_PORTRAIT_UPLOAD.contentTypes,
      maxBytes: EXPERT_PORTRAIT_UPLOAD.maxBytes,
    })
  })

  it("does not save a portrait that fails verification", async () => {
    const { UploadRejectedError } =
      await import("@eleva/storage/upload-handler")
    verifyUpload.mockRejectedValue(new UploadRejectedError("too-large"))
    const response = await patch({ avatarUrl: NEW_PORTRAIT })

    expect(response.status).toBe(422)
    expect(updateExpertProfile).not.toHaveBeenCalled()
    expect(deletePublicObject).not.toHaveBeenCalled()
  })

  it("does not re-verify an unchanged portrait", async () => {
    const response = await patch({ avatarUrl: OLD_PORTRAIT })

    expect(response.status).toBe(200)
    expect(verifyUpload).not.toHaveBeenCalled()
  })

  it("replaces the portrait and deletes the old file", async () => {
    const response = await patch({ avatarUrl: NEW_PORTRAIT })

    expect(response.status).toBe(200)
    expect(updatedFields().avatarUrl).toBe(NEW_PORTRAIT)
    expect(deletePublicObject).toHaveBeenCalledWith(OLD_PORTRAIT)
  })

  it("rejects portraits from outside the portrait upload path", async () => {
    const response = await patch({
      avatarUrl: "https://example.com/expert/portrait/x.jpg",
    })

    expect(response.status).toBe(422)
    expect(deletePublicObject).not.toHaveBeenCalled()
  })

  it("rejects another expert's portrait", async () => {
    const response = await patch({ avatarUrl: FOREIGN_PORTRAIT })

    expect(response.status).toBe(422)
    expect(updateExpertProfile).not.toHaveBeenCalled()
    expect(deletePublicObject).not.toHaveBeenCalled()
  })

  it("never deletes a previous portrait the expert does not own", async () => {
    storedAvatarUrl = FOREIGN_PORTRAIT
    const response = await patch({ avatarUrl: NEW_PORTRAIT })

    expect(response.status).toBe(200)
    expect(deletePublicObject).not.toHaveBeenCalled()
  })

  it("derives sanitized html and mirrors the source text into bio", async () => {
    const response = await patch({
      bioRich: {
        sourceLocale: "pt",
        locales: {
          pt: {
            json: [
              {
                type: "p",
                children: [
                  { text: "Fisioterapeuta " },
                  { text: "desportiva", bold: true },
                ],
              },
            ],
          },
        },
      },
    })

    expect(response.status).toBe(200)
    const fields = updatedFields()
    expect(fields.bio).toBe("Fisioterapeuta desportiva")
    expect(fields.bioSourceLocale).toBe("pt")
    const rich = fields.bioRich as { pt: { html: string; source: string } }
    expect(rich.pt.html).toContain("<strong>desportiva</strong>")
    expect(rich.pt.source).toBe("human")
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it("clears the bio when bioRich is null", async () => {
    const response = await patch({ bioRich: null })

    expect(response.status).toBe(200)
    expect(updatedFields()).toMatchObject({
      bio: null,
      bioRich: null,
      bioSourceLocale: null,
    })
  })

  it("drops the rich bio when only the plain bio changes", async () => {
    const response = await patch({ bio: "Plain bio" })

    expect(response.status).toBe(200)
    expect(updatedFields()).toMatchObject({
      bio: "Plain bio",
      bioRich: null,
      bioSourceLocale: null,
    })
  })

  it("defaults omitted credential fields to null", async () => {
    const response = await patch({ credentials: [{ title: "BSc" }] })

    expect(response.status).toBe(200)
    expect(updatedFields().credentials).toEqual([
      { title: "BSc", institution: null, year: null },
    ])
  })

  it("rejects a rich bio without its source locale", async () => {
    const response = await patch({
      bioRich: {
        sourceLocale: "en",
        locales: {
          pt: { json: [{ type: "p", children: [{ text: "Olá" }] }] },
        },
      },
    })

    expect(response.status).toBe(422)
    expect(updateExpertProfile).not.toHaveBeenCalled()
  })

  it("rejects malformed Plate nodes", async () => {
    const response = await patch({
      bioRich: {
        sourceLocale: "en",
        locales: { en: { json: [{ text: "no type or children" }] } },
      },
    })

    expect(response.status).toBe(422)
    expect(updateExpertProfile).not.toHaveBeenCalled()
  })

  it("stores valid social links and credentials", async () => {
    const response = await patch({
      socialLinks: [
        { kind: "instagram", url: "https://www.instagram.com/fisiomota" },
        { kind: "website", url: "https://fisiomota.pt" },
      ],
      credentials: [
        { title: "MSc Physiotherapy", institution: "ESS Porto", year: 2015 },
      ],
    })

    expect(response.status).toBe(200)
    expect(updatedFields()).toMatchObject({
      socialLinks: [
        { kind: "instagram", url: "https://www.instagram.com/fisiomota" },
        { kind: "website", url: "https://fisiomota.pt" },
      ],
      credentials: [
        { title: "MSc Physiotherapy", institution: "ESS Porto", year: 2015 },
      ],
    })
  })

  it("rejects a social link whose host does not match its network", async () => {
    const response = await patch({
      socialLinks: [{ kind: "linkedin", url: "https://evil.example.com/in/x" }],
    })

    expect(response.status).toBe(422)
    expect(updateExpertProfile).not.toHaveBeenCalled()
  })

  it("rejects duplicate networks", async () => {
    const response = await patch({
      socialLinks: [
        { kind: "website", url: "https://a.example.com" },
        { kind: "website", url: "https://b.example.com" },
      ],
    })

    expect(response.status).toBe(422)
  })
})
