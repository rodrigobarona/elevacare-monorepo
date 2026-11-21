import { describe, expect, it } from "vitest"
import { renderAuthEmail } from "./render"

const invitation = {
  kind: "organization-invitation" as const,
  url: "https://account.eleva.care/accept-invitation?id=1",
}

describe("organization invitation email", () => {
  it("names the clinic and the inviter and says why it was sent", async () => {
    const email = await renderAuthEmail({
      ...invitation,
      locale: "en",
      organizationName: "Clínica Lumen",
      inviterName: "Ana Mota",
    })
    expect(email.subject).toBe(
      "You are invited to join Clínica Lumen on Eleva Care"
    )
    expect(email.body).toBe(
      "Ana Mota invited you to join Clínica Lumen on Eleva Care. This invitation is valid for 7 days."
    )
    expect(email.html).toContain(
      "Clínica Lumen gave us your email address to send you this invitation."
    )
    // The person may have no account: no "you have an active account" line.
    expect(email.html).not.toContain("active account")
    // Someone with no account is told who is writing and where the privacy
    // notice is.
    expect(email.html).toContain("eleva.care/legal/privacy")
    expect(email.html).toContain("NIPC 515001708")
    expect(email.html).toContain("support@eleva.care")
  })

  it("is written in Portuguese and Spanish too", async () => {
    const pt = await renderAuthEmail({
      ...invitation,
      locale: "pt",
      organizationName: "Clínica Lumen",
      inviterName: "Ana Mota",
    })
    expect(pt.body).toBe(
      "Ana Mota enviou-lhe um convite para se juntar a Clínica Lumen na Eleva Care. O convite é válido durante 7 dias."
    )
    expect(pt.html).not.toContain("conta ativa")
    const es = await renderAuthEmail({
      ...invitation,
      locale: "es",
      organizationName: "Clínica Lumen",
    })
    expect(es.body).toBe(
      "Tienes una invitación para unirte a Clínica Lumen en Eleva Care. La invitación es válida durante 7 días."
    )
  })

  it("shows names as one plain line that mail apps cannot link", async () => {
    const email = await renderAuthEmail({
      ...invitation,
      locale: "en",
      organizationName:
        "Eleva Security https://evil.example/login\r\nBcc: x@evil.example <b>eleva-login.com‮",
      inviterName: "www.evil.example",
    })
    expect(email.subject).not.toMatch(/[\r\n‮<>]/)
    expect(email.subject).not.toContain("https://")
    expect(email.subject).not.toContain("eleva-login.com")
    expect(email.subject).toContain("eleva-login com")
    // An inviter name that was only a link is dropped.
    expect(email.body).toMatch(/^You are invited to join /)
    expect(email.subject.length).toBeLessThan(140)
  })

  it("keeps the general wording when no organization name is known", async () => {
    const email = await renderAuthEmail({ ...invitation, locale: "en" })
    expect(email.subject).toBe("You are invited to an Eleva Care organization")
  })

  it("keeps the account line on other account emails", async () => {
    const email = await renderAuthEmail({
      kind: "magic-link",
      url: "https://eleva.care/magic",
      locale: "en",
    })
    expect(email.html).toContain("active account")
  })
})
