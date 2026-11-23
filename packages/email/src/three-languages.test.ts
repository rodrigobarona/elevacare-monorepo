import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { getEmailTranslations, type EmailLocale } from "./i18n"
import {
  renderAuthEmail,
  renderBookingCancelled,
  renderBookingConfirmed,
  renderBookingReminder,
  renderBookingRescheduled,
  renderClinicDecision,
  renderInvoiceClosedGate,
  renderPartnerDecision,
  renderPaymentPayoutNotice,
} from "./render"

/**
 * Every email Eleva sends, in every form it takes, in English, Portuguese
 * and Spanish (slice 13.34). A new email or a new sentence that exists in
 * one language only fails here: a member who reads Portuguese must not get
 * a paragraph of English in the middle of their booking.
 *
 * What is given to each email is the same in the three languages and is
 * not a sentence (names, a date as digits, an amount), so whatever
 * sentence is the same in two languages came from the email itself.
 */
const LOCALES = ["en", "pt", "es"] as const satisfies readonly EmailLocale[]

// What the caller supplies. None of it is prose.
const GIVEN = {
  member: "Leonor Matos",
  expert: "Patricia Mota",
  clinic: "Clinica Lumen",
  event: "FV-60",
  date: "2026-12-01 10:00",
  earlier: "2026-11-28 09:30",
  amount: "EUR 60,00",
  reference: "REF-20261201-0042",
  href: "https://eleva.care/x/1",
  reason: "R-17",
}

type Render = (locale: EmailLocale) => Promise<string>

const booking = { memberName: GIVEN.member, eventTypeName: GIVEN.event }
// The three ways a session is held: each has its own words in an email.
const online = { ...booking, sessionMode: "online", joinHref: GIVEN.href }
const inPerson = {
  ...booking,
  sessionMode: "in_person",
  place: {
    name: GIVEN.clinic,
    address: "Rua 12, 1200-195",
    mapsHref: GIVEN.href,
  },
}
const byPhone = {
  ...booking,
  sessionMode: "phone",
  maskedPhone: "+351 *** *** 000",
}
const session = online

/** Every email, in each form whose words differ. */
const EMAILS: Record<string, Render> = {
  "verify-email": async (locale) =>
    (await renderAuthEmail({ kind: "verify-email", url: GIVEN.href, locale }))
      .html,
  "reset-password": async (locale) =>
    (await renderAuthEmail({ kind: "reset-password", url: GIVEN.href, locale }))
      .html,
  "magic-link": async (locale) =>
    (await renderAuthEmail({ kind: "magic-link", url: GIVEN.href, locale }))
      .html,
  "two-factor-otp": async (locale) =>
    (await renderAuthEmail({ kind: "two-factor-otp", code: "482913", locale }))
      .html,
  "organization-invitation": async (locale) =>
    (
      await renderAuthEmail({
        kind: "organization-invitation",
        url: GIVEN.href,
        organizationName: GIVEN.clinic,
        inviterName: GIVEN.expert,
        locale,
      })
    ).html,
  "organization-invitation, no inviter named": async (locale) =>
    (
      await renderAuthEmail({
        kind: "organization-invitation",
        url: GIVEN.href,
        organizationName: GIVEN.clinic,
        locale,
      })
    ).html,
  "booking confirmed, to the member": (locale) =>
    renderBookingConfirmed({
      ...session,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      activateHref: GIVEN.href,
      calendarHref: GIVEN.href,
      price: GIVEN.amount,
      showIcsHint: true,
      locale,
    }),
  "booking confirmed, to the expert": (locale) =>
    renderBookingConfirmed({
      ...session,
      audience: "expert",
      greetingName: GIVEN.expert,
      formattedDate: GIVEN.date,
      memberEmail: "leonor@example.test",
      memberPhone: "+351 910 000 000",
      duration: "60",
      timezone: "Europe/Lisbon",
      price: GIVEN.amount,
      calendarHref: GIVEN.href,
      locale,
    }),
  "booking confirmed, in person": (locale) =>
    renderBookingConfirmed({
      ...inPerson,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      cancellationPolicyName: "moderate",
      locale,
    }),
  "booking confirmed, by phone": (locale) =>
    renderBookingConfirmed({
      ...byPhone,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      locale,
    }),
  "booking rescheduled": (locale) =>
    renderBookingRescheduled({
      ...session,
      previousDate: GIVEN.earlier,
      newDate: GIVEN.date,
      locale,
    }),
  "booking rescheduled, in person, with where to turn for urgent help": (
    locale
  ) =>
    renderBookingRescheduled({
      ...inPerson,
      previousDate: GIVEN.earlier,
      newDate: GIVEN.date,
      urgentHelp: "full",
      locale,
    }),
  "booking cancelled, with a refund": (locale) =>
    renderBookingCancelled({
      ...booking,
      formattedDate: GIVEN.date,
      refundAmount: GIVEN.amount,
      rebookHref: GIVEN.href,
      showIcsHint: true,
      locale,
    }),
  "booking cancelled, no refund": (locale) =>
    renderBookingCancelled({
      ...booking,
      formattedDate: GIVEN.date,
      locale,
    }),
  "booking cancelled, with the emergency line": (locale) =>
    renderBookingCancelled({
      ...booking,
      formattedDate: GIVEN.date,
      cancellationPolicyName: "strict",
      urgentHelp: "emergency",
      locale,
    }),
  "reminder, a day before": (locale) =>
    renderBookingReminder({
      ...session,
      window: "24h",
      formattedDate: GIVEN.date,
      locale,
    }),
  "reminder, an hour before": (locale) =>
    renderBookingReminder({
      ...session,
      window: "1h",
      formattedDate: GIVEN.date,
      locale,
    }),
  "reminder, by phone, with where to turn for urgent help": (locale) =>
    renderBookingReminder({
      ...byPhone,
      window: "24h",
      formattedDate: GIVEN.date,
      urgentHelp: "full",
      locale,
    }),
  "platform invoice, blocked": (locale) =>
    renderInvoiceClosedGate({
      status: "blocked",
      invoiceId: GIVEN.reference,
      locale,
    }),
  "platform invoice, skipped": (locale) =>
    renderInvoiceClosedGate({
      status: "skipped",
      invoiceId: GIVEN.reference,
      locale,
    }),
  "platform invoice, pending": (locale) =>
    renderInvoiceClosedGate({
      status: "pending",
      invoiceId: GIVEN.reference,
      locale,
    }),
  "licence approved": (locale) =>
    renderPartnerDecision({
      kind: "partner.approved",
      licenceHref: GIVEN.href,
      locale,
    }),
  "licence, changes asked": (locale) =>
    renderPartnerDecision({
      kind: "partner.needs_changes",
      licenceHref: GIVEN.href,
      reason: GIVEN.reason,
      locale,
    }),
  "licence rejected": (locale) =>
    renderPartnerDecision({
      kind: "partner.rejected",
      licenceHref: GIVEN.href,
      reason: GIVEN.reason,
      locale,
    }),
  "clinic verified": (locale) =>
    renderClinicDecision({
      kind: "clinic.verified",
      verificationHref: GIVEN.href,
      clinicName: GIVEN.clinic,
      verified: true,
      locale,
    }),
  "clinic, changes asked": (locale) =>
    renderClinicDecision({
      kind: "clinic.needs_changes",
      verificationHref: GIVEN.href,
      clinicName: GIVEN.clinic,
      reason: GIVEN.reason,
      locale,
    }),
  "clinic, changes asked while verified": (locale) =>
    renderClinicDecision({
      kind: "clinic.needs_changes",
      verificationHref: GIVEN.href,
      clinicName: GIVEN.clinic,
      reason: GIVEN.reason,
      verified: true,
      locale,
    }),
  "clinic rejected": (locale) =>
    renderClinicDecision({
      kind: "clinic.rejected",
      verificationHref: GIVEN.href,
      clinicName: GIVEN.clinic,
      reason: GIVEN.reason,
      locale,
    }),
  "payment failed": (locale) =>
    renderPaymentPayoutNotice({
      kind: "payment.failed",
      amountFormatted: GIVEN.amount,
      reference: GIVEN.reference,
      locale,
    }),
  "payment receipt": (locale) =>
    renderPaymentPayoutNotice({
      kind: "payment.receipt",
      amountFormatted: GIVEN.amount,
      reference: GIVEN.reference,
      locale,
    }),
  "payout paid": (locale) =>
    renderPaymentPayoutNotice({
      kind: "payout.paid",
      amountFormatted: GIVEN.amount,
      reference: GIVEN.reference,
      locale,
    }),
  "payout needs approval": (locale) =>
    renderPaymentPayoutNotice({
      kind: "payout.approval_required",
      amountFormatted: GIVEN.amount,
      reference: GIVEN.reference,
      locale,
    }),
}

/** What a reader sees: the email's text, piece by piece, without its markup. */
function sentences(html: string): string[] {
  const body = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
  return body
    .split(/<[^>]+>/)
    .map((piece) =>
      piece
        .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;|&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
}

/**
 * A piece of text that is a sentence of the email's own: at least three
 * words once what the caller gave, addresses, numbers and the company's
 * registered details are taken out. Those are the same in every language
 * and are meant to be.
 */
function ownWords(piece: string): string[] {
  let rest = piece
  for (const value of Object.values(GIVEN)) rest = rest.split(value).join(" ")
  rest = rest
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\S+@\S+/g, " ")
    .replace(/[\d.,:;!?()[\]"'+\-–—/%€@·|]/g, " ")
  return rest
    .split(/\s+/)
    .filter((word) => /\p{L}{2,}/u.test(word))
    .filter(
      (word) =>
        !/^(Eleva|Care|Búzios|Tartarugas|Lda|NIF|PT|Portugal|Lisboa|Europe|Lisbon|EUR|REF|FV|ICS|Rua|SNS|INEM)$/i.test(
          word
        )
    )
}

/** The sentences of one email that are found, word for word, in another. */
function sameSentences(html: string, other: string, words: number): string[] {
  const there = new Set(sentences(other))
  return sentences(html)
    .filter((piece) => ownWords(piece).length >= words)
    .filter((piece) => there.has(piece))
}

describe("every email, in three languages", () => {
  const names = Object.keys(EMAILS)

  it.each(names)("%s: renders in each, and says its language", async (name) => {
    for (const locale of LOCALES) {
      const html = await EMAILS[name]!(locale)
      expect(html, `${name} in ${locale}`).toMatch(
        new RegExp(`<html[^>]*\\blang="${locale}"`)
      )
      const text = sentences(html).join(" | ")
      expect(text.length, `${name} in ${locale}`).toBeGreaterThan(40)
      // Nothing that is a hole where a value or a sentence should be.
      expect(text, `${name} in ${locale}`).not.toMatch(
        /\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b|\{\{|\}\}|\{[a-zA-Z_.]+\}/
      )
    }
  })

  it.each(names)(
    "%s: no sentence of English is left in Portuguese or Spanish",
    async (name) => {
      const english = await EMAILS[name]!("en")
      // The check can see this email: against itself, every sentence of
      // its own is found. Without that, an email whose words the check
      // cannot read would pass by saying nothing.
      expect(
        sameSentences(english, english, 3).length,
        `${name}: sentences the check can see`
      ).toBeGreaterThan(1)
      for (const locale of ["pt", "es"] as const) {
        expect(
          sameSentences(english, await EMAILS[name]!(locale), 3),
          `${name}: English left in ${locale}`
        ).toEqual([])
      }
    }
  )

  it.each(names)(
    "%s: Portuguese and Spanish are each their own",
    async (name) => {
      // One language pasted into the other's place.
      expect(
        sameSentences(await EMAILS[name]!("pt"), await EMAILS[name]!("es"), 4),
        `${name}: the same sentence in pt and es`
      ).toEqual([])
    }
  )

  it("would catch a sentence left in English", async () => {
    const english = await EMAILS["booking confirmed, to the member"]!("en")
    const portuguese = await EMAILS["booking confirmed, to the member"]!("pt")
    const [sentence] = sentences(english).filter(
      (piece) => ownWords(piece).length >= 3
    )
    // A Portuguese email with one English sentence left in it.
    const mixed = portuguese.replace("</body>", `<p>${sentence}</p></body>`)
    expect(sameSentences(english, mixed, 3)).toEqual([sentence])
    // What the caller gave, and the company's own details, are not sentences.
    expect(
      ownWords(`${GIVEN.member} · ${GIVEN.date} · ${GIVEN.amount}`)
    ).toEqual([])
    expect(ownWords("Eleva Care, Búzios e Tartarugas, Lda")).toEqual([])
    expect(ownWords("Your session is booked.").length).toBe(4)
  })

  it("the subject, title and body of a sign-in email follow the language", async () => {
    for (const kind of [
      "verify-email",
      "reset-password",
      "magic-link",
      "two-factor-otp",
    ] as const) {
      const [en, pt, es] = await Promise.all(
        LOCALES.map((locale) =>
          renderAuthEmail({ kind, url: GIVEN.href, code: "482913", locale })
        )
      )
      for (const part of ["subject", "title", "body"] as const) {
        expect(en![part], `${kind} ${part}`).not.toBe("")
        expect(pt![part], `${kind} ${part} in pt`).not.toBe(en![part])
        expect(es![part], `${kind} ${part} in es`).not.toBe(en![part])
        expect(es![part], `${kind} ${part} pt and es`).not.toBe(pt![part])
      }
    }
  })
})

describe("the list of emails above", () => {
  const here = import.meta.dirname
  const read = (...path: string[]) => readFileSync(join(here, ...path), "utf8")
  const thisFile = read("three-languages.test.ts")

  it("has every email the package can render", () => {
    const renderers = [
      ...read("render.tsx").matchAll(/export async function (render\w+)/g),
    ].map((match) => match[1]!)
    expect(renderers.length).toBeGreaterThanOrEqual(9)
    for (const renderer of renderers) {
      expect(thisFile, `${renderer} has no entry`).toContain(`${renderer}({`)
    }
  })

  it("has every kind of each email that comes in kinds", () => {
    // `export type SomethingKind = | "a" | "b"`: a kind added to an email
    // and not to the list above fails here.
    const sources = ["components", "templates"].flatMap((folder) =>
      readdirSync(join(here, folder))
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => read(folder, file))
    )
    const kinds = sources.flatMap((source) =>
      [
        ...source.matchAll(/export type \w+Kind =((?:\s*\|\s*"[^"]+")+)/g),
      ].flatMap((match) =>
        [...match[1]!.matchAll(/"([^"]+)"/g)].map((kind) => kind[1]!)
      )
    )
    expect(kinds.length).toBeGreaterThanOrEqual(15)
    for (const kind of kinds) {
      expect(thisFile, `${kind} has no entry`).toContain(`kind: "${kind}"`)
    }
  })
})

describe("the words the emails share", () => {
  /** Every key of a translations object, by its path, with what kind of thing it is. */
  function shape(value: unknown, path = ""): Record<string, string> {
    if (typeof value === "function") {
      return { [path]: `function(${value.length})` }
    }
    if (typeof value !== "object" || value === null) {
      return { [path]: typeof value }
    }
    return Object.assign(
      {},
      ...Object.entries(value).map(([key, inner]) =>
        shape(inner, path ? `${path}.${key}` : key)
      )
    ) as Record<string, string>
  }

  it("have the same entries in each language, each of the same kind", () => {
    const english = shape(getEmailTranslations("en"))
    expect(Object.keys(english).length).toBeGreaterThan(50)
    for (const locale of ["pt", "es"] as const) {
      expect(shape(getEmailTranslations(locale)), locale).toEqual(english)
    }
  })

  it("leave no entry empty, and none in English where it should not be", () => {
    const flat = (value: unknown, path = ""): [string, string][] =>
      typeof value === "string"
        ? [[path, value]]
        : typeof value === "object" && value !== null
          ? Object.entries(value).flatMap(([key, inner]) =>
              flat(inner, path ? `${path}.${key}` : key)
            )
          : []
    const english = new Map(flat(getEmailTranslations("en")))
    for (const locale of ["pt", "es"] as const) {
      const same: string[] = []
      for (const [path, text] of flat(getEmailTranslations(locale))) {
        expect(text.trim(), `${locale} ${path}`).not.toBe("")
        // A sentence, not a name or a word that is the same in both.
        if (english.get(path) === text && text.split(/\s+/).length >= 4) {
          same.push(`${path}: ${text}`)
        }
      }
      expect(same, `${locale}: entries still in English`).toEqual([])
    }
  })
})
