import { describe, expect, it } from "vitest"

import {
  becomePartnerSubmissionSchema,
  documentSchema,
  type BecomePartnerSubmissionInput,
} from "./schema"

const VALID_DOC_URL =
  "https://example.public.blob.vercel-storage.com/become-partner/license/license.pdf"

const FIXED_UPLOADED_AT = "2026-05-04T10:00:00.000Z"

function validSubmission(
  overrides: Partial<BecomePartnerSubmissionInput> = {}
): unknown {
  return {
    type: "solo_expert",
    displayName: "Ana Silva",
    username: "ana-silva",
    bio: "",
    nif: "",
    licenseNumber: "",
    licenseScope: "",
    languages: ["pt"],
    practiceCountries: ["PT"],
    categorySlugs: ["pelvic-health"],
    documents: [
      {
        kind: "license",
        name: "license.pdf",
        url: VALID_DOC_URL,
        pathname: "become-partner/license/license.pdf",
        contentType: "application/pdf",
        size: 1024,
        uploadedAt: FIXED_UPLOADED_AT,
      },
    ],
    consent: true,
    ...overrides,
  }
}

describe("documentSchema", () => {
  function validDoc(overrides: Record<string, unknown> = {}) {
    return {
      kind: "license",
      name: "license.pdf",
      url: VALID_DOC_URL,
      pathname: "become-partner/license/license.pdf",
      contentType: "application/pdf",
      size: 100,
      uploadedAt: FIXED_UPLOADED_AT,
      ...overrides,
    }
  }

  it("accepts a well-formed document", () => {
    expect(documentSchema.parse(validDoc())).toBeDefined()
  })

  it("rejects oversized documents", () => {
    expect(() =>
      documentSchema.parse(validDoc({ size: 11 * 1024 * 1024 }))
    ).toThrow()
  })

  it("rejects unsupported MIME types", () => {
    expect(() =>
      documentSchema.parse(
        validDoc({
          name: "license.txt",
          url: VALID_DOC_URL.replace(".pdf", ".txt"),
          pathname: "become-partner/license/license.txt",
          contentType: "text/plain",
        })
      )
    ).toThrow()
  })

  it("rejects unknown kinds", () => {
    expect(() =>
      documentSchema.parse(
        validDoc({
          kind: "passport",
          pathname: "become-partner/passport/x.pdf",
        })
      )
    ).toThrow()
  })

  it("rejects URLs with non-blob hosts", () => {
    expect(() =>
      documentSchema.parse(
        validDoc({ url: "https://example.com/become-partner/license/x.pdf" })
      )
    ).toThrow()
  })

  it("rejects http (insecure) URLs", () => {
    expect(() =>
      documentSchema.parse(
        validDoc({
          url: "http://example.public.blob.vercel-storage.com/become-partner/license/x.pdf",
        })
      )
    ).toThrow()
  })

  it("rejects pathnames that do not match the kind prefix", () => {
    expect(() =>
      documentSchema.parse(
        validDoc({ pathname: "become-partner/id/license.pdf" })
      )
    ).toThrow()
  })

  it("rejects missing or invalid uploadedAt", () => {
    expect(() => documentSchema.parse(validDoc({ uploadedAt: "" }))).toThrow()
    expect(() =>
      documentSchema.parse(validDoc({ uploadedAt: "not-a-date" }))
    ).toThrow()
  })
})

describe("becomePartnerSubmissionSchema", () => {
  it("accepts a complete valid submission", () => {
    const parsed = becomePartnerSubmissionSchema.parse(validSubmission())
    expect(parsed.type).toBe("solo_expert")
    expect(parsed.username).toBe("ana-silva")
  })

  it("lowercases the username", () => {
    const parsed = becomePartnerSubmissionSchema.parse(
      validSubmission({ username: "ANA-Silva" })
    )
    expect(parsed.username).toBe("ana-silva")
  })

  it("rejects reserved usernames", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ username: "admin" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("reserved")
    }
  })

  it("rejects malformed usernames", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ username: "Ana Silva" })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("invalid-chars")
    }
  })

  it("rejects submissions without a license document", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({
        documents: [
          {
            kind: "id",
            name: "id.pdf",
            url: VALID_DOC_URL.replace("license/license.pdf", "id/id.pdf"),
            pathname: "become-partner/id/id.pdf",
            contentType: "application/pdf",
            size: 100,
            uploadedAt: FIXED_UPLOADED_AT,
          },
        ],
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "license-required")
      ).toBe(true)
    }
  })

  it("rejects submissions with no documents", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ documents: [] })
    )
    expect(result.success).toBe(false)
  })

  it("rejects submissions with no languages", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ languages: [] })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "languages-required")
      ).toBe(true)
    }
  })

  it("rejects submissions with too many categories", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({
        categorySlugs: ["a-1", "b-2", "c-3", "d-4"],
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "categories-too-many")
      ).toBe(true)
    }
  })

  it("rejects category slugs with invalid characters", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ categorySlugs: ["Bad Slug"] })
    )
    expect(result.success).toBe(false)
  })

  it("requires consent === true", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ consent: false as unknown as true })
    )
    expect(result.success).toBe(false)
  })

  it("rejects unsupported applicant types", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({
        type: "patient" as unknown as "solo_expert",
      })
    )
    expect(result.success).toBe(false)
  })

  it("treats clinic_admin as a valid applicant type", () => {
    const result = becomePartnerSubmissionSchema.safeParse(
      validSubmission({ type: "clinic_admin" })
    )
    expect(result.success).toBe(true)
  })

  it("trims optional bio/license fields gracefully", () => {
    const parsed = becomePartnerSubmissionSchema.parse(
      validSubmission({
        bio: "Helping mothers since 2010.",
        nif: "PT123456789",
        licenseNumber: "OE-12345",
        licenseScope: "Lisbon, Porto",
      })
    )
    expect(parsed.bio).toBe("Helping mothers since 2010.")
    expect(parsed.nif).toBe("PT123456789")
  })
})
