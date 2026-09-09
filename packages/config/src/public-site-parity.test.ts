import { describe, expect, it } from "vitest"
import {
  PUBLIC_SITE_PARITY_REDIRECTS,
  rewriteParityPath,
} from "./public-site-parity"

describe("rewriteParityPath", () => {
  it("matches every exported D-10 redirect row", () => {
    for (const row of PUBLIC_SITE_PARITY_REDIRECTS) {
      expect(rewriteParityPath(row.path), row.id).toBe(row.locationPath)
    }
  })

  it("leaves live marketplace and legal paths alone", () => {
    expect(rewriteParityPath("/experts")).toBeNull()
    expect(rewriteParityPath("/pt/experts")).toBeNull()
    expect(rewriteParityPath("/fisiomota")).toBeNull()
    expect(rewriteParityPath("/legal/cookies")).toBeNull()
    expect(rewriteParityPath("/trust/security")).toBeNull()
    expect(rewriteParityPath("/pt/trust/ers")).toBeNull()
    expect(rewriteParityPath("/contact")).toBeNull()
    expect(rewriteParityPath("/community")).toBeNull()
  })

  it("does not treat a username that starts with a retired segment suffix", () => {
    expect(rewriteParityPath("/quizmaster")).toBeNull()
    expect(rewriteParityPath("/helpful")).toBeNull()
  })
})
