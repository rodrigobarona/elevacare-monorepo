import { describe, expect, it } from "vitest"
import { getEmailTranslations } from "./i18n"
import { renderClinicDecision } from "./render"
import { clinicDecisionCopy } from "./templates"

const base = {
  verificationHref: "https://eleva.care/team/clinica-lumen/verification",
  clinicName: "Clínica Lumen",
  name: "Ana",
}

describe("clinic decision email", () => {
  it("says what staff found and links to the Verification page", async () => {
    const html = await renderClinicDecision({
      ...base,
      kind: "clinic.needs_changes",
      reason:
        "The legal name in the register is Clínica Lumen, Unipessoal Lda.",
      locale: "en",
    })
    expect(html).toContain("We need a change to your clinic")
    expect(html).toContain("What we found")
    expect(html).toContain(
      "The legal name in the register is Clínica Lumen, Unipessoal Lda."
    )
    expect(html).toContain(base.verificationHref)
    expect(html).toContain("Correct your details")
    // Says why this person got it, in place of the generic account line.
    expect(html).toContain(
      "You received this email because you are an owner or admin of Clínica Lumen on Eleva Care."
    )
    expect(html).not.toContain("you have an active account")
  })

  it("shows a reason as text, never as markup", async () => {
    const html = await renderClinicDecision({
      ...base,
      kind: "clinic.rejected",
      reason: '<a href="https://example.test">click</a>',
      locale: "en",
    })
    expect(html).not.toContain('<a href="https://example.test">')
    expect(html).toContain("&lt;a href=")
  })

  it("never turns a clinic's name into a link", async () => {
    const html = await renderClinicDecision({
      ...base,
      clinicName: "Pay now at https://evil.example or evil.example",
      kind: "clinic.verified",
      locale: "en",
    })
    expect(html).not.toContain("https://evil.example")
    expect(html).not.toContain("evil.example")
    expect(html).toContain("evil example")
  })

  it("keeps the line breaks of what staff wrote", async () => {
    const html = await renderClinicDecision({
      ...base,
      kind: "clinic.needs_changes",
      reason: "First line.\nSecond line.",
      locale: "en",
    })
    expect(html).toContain("white-space:pre-line")
    expect(html).toContain("First line.\nSecond line.")
  })

  it("is written in Portuguese and Spanish too", async () => {
    const pt = await renderClinicDecision({
      ...base,
      kind: "clinic.verified",
      locale: "pt",
    })
    expect(pt).toContain("A sua clínica está verificada")
    expect(pt).toContain("Ver a verificação da clínica")
    const es = await renderClinicDecision({
      ...base,
      kind: "clinic.verified",
      locale: "es",
    })
    expect(es).toContain("Tu clínica está verificada")
  })

  it("tells a verified clinic that it stays verified", () => {
    for (const locale of ["en", "pt", "es"] as const) {
      const t = getEmailTranslations(locale)
      const rejected = clinicDecisionCopy(t, "clinic.rejected", true)
      expect(rejected.subject).toBe(t.subject.clinicRejectedStillVerified)
      expect(rejected.subject).not.toBe(t.subject.clinicRejected)
      expect(clinicDecisionCopy(t, "clinic.needs_changes", true).subtitle).toBe(
        t.clinic.needsChangesStillVerifiedSubtitle
      )
      expect(clinicDecisionCopy(t, "clinic.rejected").subject).toBe(
        t.subject.clinicRejected
      )
    }
  })
})
