import { describe, expect, it } from "vitest"

import {
  becomePartnerSubmissionSchema,
  documentSchema,
  type BecomePartnerSubmissionInput,
} from "./schema"

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
        url: "https://blob.vercel-storage.com/license.pdf",
        pathname: "applications/license.pdf",
        contentType: "application/pdf",
        size: 1024,
      },
    ],
    consent: true,
    ...overrides,
  }
}

describe("documentSchema", () => {
  it("accepts a well-formed document", () => {
    expect(
      documentSchema.parse({
        kind: "license",
        name: "license.pdf",
        url: "https://example.com/license.pdf",
        pathname: "x/license.pdf",
        contentType: "application/pdf",
        size: 100,
      })
    ).toBeDefined()
  })

  it("rejects oversized documents", () => {
    expect(() =>
      documentSchema.parse({
        kind: "license",
        name: "license.pdf",
        url: "https://example.com/license.pdf",
        pathname: "x/license.pdf",
        contentType: "application/pdf",
        size: 11 * 1024 * 1024,
      })
    ).toThrow()
  })

  it("rejects unsupported MIME types", () => {
    expect(() =>
      documentSchema.parse({
        kind: "license",
        name: "license.txt",
        url: "https://example.com/license.txt",
        pathname: "x/license.txt",
        contentType: "text/plain",
        size: 100,
      })
    ).toThrow()
  })

  it("rejects unknown kinds", () => {
    expect(() =>
      documentSchema.parse({
        kind: "passport",
        name: "x.pdf",
        url: "https://example.com/x.pdf",
        pathname: "x/x.pdf",
        contentType: "application/pdf",
        size: 100,
      })
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
            url: "https://example.com/id.pdf",
            pathname: "x/id.pdf",
            contentType: "application/pdf",
            size: 100,
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
