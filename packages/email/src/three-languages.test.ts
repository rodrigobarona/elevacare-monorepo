import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { LEGAL_ENTITY, LEGAL_ENTITY_LINE } from "@eleva/config/legal-entity"
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
 * not a sentence (names, a date as digits, an amount, a policy's code
 * name), so whatever sentence is the same in two languages came from the
 * email itself.
 *
 * Two checks work together. The rendered emails catch words written in a
 * template. The shared words (`i18n.ts`) are compared entry by entry, at
 * any length, so a branch no form here reaches is still read.
 */
const LOCALES = ["en", "pt", "es"] as const satisfies readonly EmailLocale[]

// What the caller supplies, taken out of the text before it is compared.
// None of it is prose.
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
  email: "leonor@example.test",
  phone: "+351 910 000 000",
  masked: "+351 *** *** 000",
  street: "Rua 12, 1200-195",
  zone: "Europe/Lisbon",
  // Written by the sender in the reader's language before the email is
  // made: the policy's name, and the member's language and country.
  policy: "PL-2",
  language: "LG-1",
  country: "CT-1",
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
    address: GIVEN.street,
    mapsHref: GIVEN.href,
  },
}
const byPhone = {
  ...booking,
  sessionMode: "phone",
  maskedPhone: GIVEN.masked,
}

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
  "organization-invitation, no organisation named": async (locale) =>
    (
      await renderAuthEmail({
        kind: "organization-invitation",
        url: GIVEN.href,
        locale,
      })
    ).html,
  "booking confirmed, to the member": (locale) =>
    renderBookingConfirmed({
      ...online,
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
      ...online,
      audience: "expert",
      greetingName: GIVEN.expert,
      formattedDate: GIVEN.date,
      memberEmail: GIVEN.email,
      memberPhone: GIVEN.phone,
      duration: "60",
      timezone: GIVEN.zone,
      language: GIVEN.language,
      country: GIVEN.country,
      cancellationPolicyName: GIVEN.policy,
      price: GIVEN.amount,
      calendarHref: GIVEN.href,
      locale,
    }),
  "booking confirmed, in person": (locale) =>
    renderBookingConfirmed({
      ...inPerson,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      cancellationPolicyName: GIVEN.policy,
      locale,
    }),
  "booking confirmed, by phone": (locale) =>
    renderBookingConfirmed({
      ...byPhone,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      locale,
    }),
  "booking confirmed, by phone, the number not known": (locale) =>
    renderBookingConfirmed({
      ...byPhone,
      maskedPhone: null,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      locale,
    }),
  "booking rescheduled": (locale) =>
    renderBookingRescheduled({
      ...online,
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
      cancellationPolicyName: GIVEN.policy,
      urgentHelp: "emergency",
      locale,
    }),
  "reminder, a day before": (locale) =>
    renderBookingReminder({
      ...online,
      window: "24h",
      formattedDate: GIVEN.date,
      locale,
    }),
  "reminder, an hour before": (locale) =>
    renderBookingReminder({
      ...online,
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
  "platform invoice, blocked, with why and a name": (locale) =>
    renderInvoiceClosedGate({
      status: "blocked",
      invoiceId: GIVEN.reference,
      error: "toconline_v1_auto_finalize_blocked",
      name: GIVEN.expert,
      locale,
    }),
  "platform invoice, skipped, nothing to invoice": (locale) =>
    renderInvoiceClosedGate({
      status: "skipped",
      invoiceId: GIVEN.reference,
      error: "zero_fee",
      locale,
    }),
  "platform invoice, pending, the tax number not checked yet": (locale) =>
    renderInvoiceClosedGate({
      status: "pending",
      invoiceId: GIVEN.reference,
      error: "iva_lookup_unavailable",
      locale,
    }),
  "licence approved": (locale) =>
    renderPartnerDecision({
      kind: "partner.approved",
      licenceHref: GIVEN.href,
      locale,
    }),
  "licence approved, with a name": (locale) =>
    renderPartnerDecision({
      kind: "partner.approved",
      licenceHref: GIVEN.href,
      name: GIVEN.expert,
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
  "clinic, newer details refused while verified": (locale) =>
    renderClinicDecision({
      kind: "clinic.rejected",
      verificationHref: GIVEN.href,
      clinicName: GIVEN.clinic,
      reason: GIVEN.reason,
      verified: true,
      name: GIVEN.expert,
      locale,
    }),
  "clinic verified, its name not usable": (locale) =>
    renderClinicDecision({
      kind: "clinic.verified",
      verificationHref: GIVEN.href,
      clinicName: "",
      verified: true,
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
  "payment receipt, with a name": (locale) =>
    renderPaymentPayoutNotice({
      kind: "payment.receipt",
      amountFormatted: GIVEN.amount,
      reference: GIVEN.reference,
      name: GIVEN.member,
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

/**
 * A paragraph as its sentences. A paragraph half translated is not the
 * English paragraph, but one of its sentences is an English sentence.
 */
function split(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/** What a reader sees: the email's text, sentence by sentence, without its markup. */
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
    .flatMap(split)
}

// The company's registered details and the product's name: the same in
// every language, and meant to be.
const SAME_EVERYWHERE = [
  LEGAL_ENTITY_LINE,
  LEGAL_ENTITY.name,
  LEGAL_ENTITY.supportEmail,
  "Eleva Care",
  "Eleva",
]

/**
 * The words of a piece of text that are the email's own, once what the
 * caller gave, the company's details, addresses and numbers are taken out.
 */
function ownWords(piece: string): string[] {
  let rest = piece
  for (const value of [...Object.values(GIVEN), ...SAME_EVERYWHERE]) {
    rest = rest.split(value).join(" ")
  }
  return rest
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\S+@\S+/g, " ")
    .replace(/[\d.,:;!?()[\]"'+\-–—/%€@·|*]/g, " ")
    .split(/\s+/)
    .filter((word) => /\p{L}{2,}/u.test(word))
}

/**
 * Text that is rightly the same in English and another language. Each is
 * a decision: add one only for a word both languages really share.
 */
const SAME_AS_ENGLISH = new Set<string>(["Email"])

/**
 * The pieces of one email found, word for word, in another: those with at
 * least `words` words of the email's own.
 */
function sameSentences(html: string, other: string, words: number): string[] {
  const there = new Set(sentences(other))
  return sentences(html)
    .filter((piece) => ownWords(piece).length >= words)
    .filter((piece) => there.has(piece))
}

/** Any text of an English email, a single word included, left in another. */
function englishLeft(english: string, other: string): string[] {
  return sameSentences(english, other, 1).filter(
    (piece) => !SAME_AS_ENGLISH.has(piece)
  )
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
    "%s: no English is left in Portuguese or Spanish",
    async (name) => {
      const english = await EMAILS[name]!("en")
      // The check can see this email: against itself, every piece of its
      // own is found. Without that, an email whose words the check cannot
      // read would pass by saying nothing.
      expect(
        sameSentences(english, english, 1).length,
        `${name}: pieces the check can see`
      ).toBeGreaterThan(3)
      for (const locale of ["pt", "es"] as const) {
        expect(
          englishLeft(english, await EMAILS[name]!(locale)),
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

  it("would catch English left in another language", async () => {
    const english = await EMAILS["booking confirmed, to the member"]!("en")
    const portuguese = await EMAILS["booking confirmed, to the member"]!("pt")
    const pieces = sentences(english).filter(
      (piece) => ownWords(piece).length >= 1
    )
    const sentence = pieces.find((piece) => ownWords(piece).length >= 3)!
    const button = pieces.find((piece) => ownWords(piece).length <= 2)!
    expect(englishLeft(english, portuguese)).toEqual([])
    // A Portuguese email with one English sentence, then one short English
    // label, left in it.
    for (const left of [sentence, button]) {
      const mixed = portuguese.replace("</body>", `<p>${left}</p></body>`)
      expect(englishLeft(english, mixed)).toEqual([left])
    }
    // A paragraph half translated: an English sentence, then a Portuguese
    // one, in the same paragraph.
    const full = pieces.find(
      (piece) => ownWords(piece).length >= 3 && piece.endsWith(".")
    )!
    const half = portuguese.replace(
      "</body>",
      `<p>${full} Esta frase está em português.</p></body>`
    )
    expect(englishLeft(english, half)).toEqual([full])
    // What the caller gave, and the company's own details, are not words
    // of the email.
    expect(
      ownWords(`${GIVEN.member} · ${GIVEN.date} · ${GIVEN.amount}`)
    ).toEqual([])
    expect(ownWords(`Eleva Care · ${LEGAL_ENTITY_LINE}`)).toEqual([])
    expect(ownWords("Your session is booked.").length).toBe(4)
  })

  it("the subject, title and body of each sign-in email follow the language", async () => {
    const forms = [
      { kind: "verify-email" },
      { kind: "reset-password" },
      { kind: "magic-link" },
      { kind: "two-factor-otp" },
      { kind: "organization-invitation" },
      { kind: "organization-invitation", organizationName: GIVEN.clinic },
      {
        kind: "organization-invitation",
        organizationName: GIVEN.clinic,
        inviterName: GIVEN.expert,
      },
    ] as const
    for (const form of forms) {
      const [en, pt, es] = await Promise.all(
        LOCALES.map((locale) =>
          renderAuthEmail({ ...form, url: GIVEN.href, code: "482913", locale })
        )
      )
      const which = JSON.stringify(form)
      for (const part of ["subject", "title", "body"] as const) {
        expect(en![part], `${which} ${part}`).not.toBe("")
        expect(pt![part], `${which} ${part} in pt`).not.toBe(en![part])
        expect(es![part], `${which} ${part} in es`).not.toBe(en![part])
        expect(es![part], `${which} ${part} pt and es`).not.toBe(pt![part])
      }
    }
  })
})

describe("the list of emails above", () => {
  const here = import.meta.dirname
  const read = (...path: string[]) => readFileSync(join(here, ...path), "utf8")
  // The list itself and what it is built from, not the checks after it.
  const thisFile = read("three-languages.test.ts")
  const list = thisFile.slice(0, thisFile.indexOf("\n/** What a reader sees"))

  it("has every email the package can render", () => {
    const renderers = [
      ...read("render.tsx").matchAll(
        /export (?:async function|function|const) (render\w+)/g
      ),
    ].map((match) => match[1]!)
    // The nine there are today; more are found by the pattern above.
    expect(renderers).toEqual(
      expect.arrayContaining([
        "renderAuthEmail",
        "renderBookingConfirmed",
        "renderBookingRescheduled",
        "renderBookingCancelled",
        "renderBookingReminder",
        "renderInvoiceClosedGate",
        "renderPartnerDecision",
        "renderClinicDecision",
        "renderPaymentPayoutNotice",
      ])
    )
    for (const renderer of renderers) {
      expect(list, `${renderer} has no entry`).toContain(`${renderer}({`)
    }
  })

  it("has every form of each email that comes in forms", () => {
    // `export type SomethingKind = "a" | "b"`: a form added to an email and
    // not to the list above fails here. The name's ending says which input
    // carries it.
    const INPUT = {
      Kind: "kind",
      Status: "status",
      Window: "window",
      Detail: "urgentHelp",
      Mode: "sessionMode",
    } as const
    const sources = [
      read("session-mode.ts"),
      ...["components", "templates"].flatMap((folder) =>
        readdirSync(join(here, folder))
          .filter((file) => file.endsWith(".tsx"))
          .map((file) => read(folder, file))
      ),
    ].join("\n")
    const declared = [
      ...sources.matchAll(
        /export type (\w+(Kind|Status|Window|Detail|Mode))\b[^=\n]*=/g
      ),
    ].map((match) => match[1]!)
    const unions = [
      ...sources.matchAll(
        /export type (\w+(Kind|Status|Window|Detail|Mode)) =\s*\|?((?:\s*"[^"]+"\s*\|?)+)/g
      ),
    ].map((match) => ({
      name: match[1]!,
      input: INPUT[match[2] as keyof typeof INPUT],
      members: [...match[3]!.matchAll(/"([^"]+)"/g)].map((one) => one[1]!),
    }))
    // Every such type was read: one written in a way this cannot read
    // fails here instead of being skipped.
    expect(unions.map((union) => union.name).sort()).toEqual(declared.sort())
    expect(declared).toEqual(
      expect.arrayContaining([
        "AuthEmailKind",
        "PartnerDecisionKind",
        "ClinicDecisionKind",
        "PaymentPayoutNoticeKind",
        "InvoiceClosedGateStatus",
        "BookingReminderWindow",
        "UrgentHelpDetail",
        "SessionMode",
      ])
    )
    for (const { name, input, members } of unions) {
      for (const member of members) {
        expect(list, `${name} "${member}" has no entry`).toContain(
          `${input}: "${member}"`
        )
      }
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

  // A function is read by what it says: called with each of these, which
  // between them reach both sides of a yes or no, and one and many.
  const SAMPLES: unknown[][] = [
    ["Zq", "Zq"],
    [true, true],
    [false, false],
    [1, 1],
    [5, 5],
  ]

  /** Every text of a translations object, by its path. */
  function texts(value: unknown, path = ""): [string, string][] {
    if (typeof value === "string") return [[path, value]]
    if (typeof value === "function") {
      return SAMPLES.map((given, index) => [
        `${path}(${index})`,
        String((value as (...given: unknown[]) => unknown)(...given)),
      ])
    }
    if (typeof value !== "object" || value === null) return []
    return Object.entries(value).flatMap(([key, inner]) =>
      texts(inner, path ? `${path}.${key}` : key)
    )
  }

  it("leave no entry empty, and none in English, at any length", () => {
    const english = new Map(texts(getEmailTranslations("en")))
    expect(english.size).toBeGreaterThan(150)
    for (const locale of ["pt", "es"] as const) {
      const same: string[] = []
      for (const [path, text] of texts(getEmailTranslations(locale))) {
        expect(text.trim(), `${locale} ${path}`).not.toBe("")
        // Sentence by sentence: an entry half translated has English in it.
        const inEnglish = new Set(split(english.get(path) ?? ""))
        for (const sentence of split(text)) {
          if (
            inEnglish.has(sentence) &&
            ownWords(sentence).length > 0 &&
            !SAME_AS_ENGLISH.has(sentence)
          ) {
            same.push(`${path}: ${sentence}`)
          }
        }
      }
      expect(same, `${locale}: entries still in English`).toEqual([])
    }
  })
})
