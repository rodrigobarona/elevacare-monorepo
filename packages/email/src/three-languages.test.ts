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
 * Three checks work together. The rendered emails catch words written in
 * a template. The shared words (`i18n.ts`) are compared entry by entry, at
 * any length, so a branch no form here reaches is still read. And common
 * English words (the, your, with) fail wherever they turn up in Portuguese
 * or Spanish, so English that was reworded is nearly always caught too.
 *
 * What this cannot see: words a template writes itself in a branch that no
 * form below renders (a new branch with words of its own needs a form),
 * and text in attributes such as `alt` (today only the logo's name).
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
  code: "482913",
  email: "leonor@example.test",
  phone: "+351 910 000 000",
  masked: "+351 *** *** 000",
  street: "Rua 12, 1200-195",
  zone: "Europe/Lisbon",
  // Written by the sender in the reader's language before the email is
  // made: the policy's name, and the member's language and country.
  policy: "PL-2",
  directions: "D-9, 2",
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
    instructions: GIVEN.directions,
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
  "verify-email, with a name": async (locale) =>
    (
      await renderAuthEmail({
        kind: "verify-email",
        url: GIVEN.href,
        name: GIVEN.member,
        locale,
      })
    ).html,
  "reset-password": async (locale) =>
    (await renderAuthEmail({ kind: "reset-password", url: GIVEN.href, locale }))
      .html,
  "magic-link": async (locale) =>
    (await renderAuthEmail({ kind: "magic-link", url: GIVEN.href, locale }))
      .html,
  "two-factor-otp": async (locale) =>
    (
      await renderAuthEmail({
        kind: "two-factor-otp",
        code: GIVEN.code,
        locale,
      })
    ).html,
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
  "booking request sent, as the sender words it": (locale) => {
    const t = getEmailTranslations(locale)
    return renderBookingConfirmed({
      ...online,
      expertName: GIVEN.expert,
      formattedDate: GIVEN.date,
      heading: t.booking.requestedTitle,
      subheading: t.booking.requestedSubtitle,
      preview: t.subject.requested(GIVEN.member, GIVEN.date),
      showIcsHint: false,
      locale,
    })
  },
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
  "booking rescheduled, by phone": (locale) =>
    renderBookingRescheduled({
      ...byPhone,
      previousDate: GIVEN.earlier,
      newDate: GIVEN.date,
      locale,
    }),
  "booking cancelled by the expert, to the member": (locale) => {
    const t = getEmailTranslations(locale)
    return renderBookingCancelled({
      ...booking,
      formattedDate: GIVEN.date,
      refundAmount: GIVEN.amount,
      subheading: t.booking.cancelledByExpertSubtitle(GIVEN.expert, true),
      preview: t.booking.cancelledByExpertSubject(GIVEN.expert),
      counterpartLabel: t.labels.expert,
      counterpartName: GIVEN.expert,
      rebookHref: GIVEN.href,
      locale,
    })
  },
  "booking cancelled by the expert, to the expert": (locale) => {
    const t = getEmailTranslations(locale)
    return renderBookingCancelled({
      ...booking,
      formattedDate: GIVEN.date,
      greetingName: GIVEN.expert,
      subheading: t.booking.expertCancelledByYouSubtitle(true),
      locale,
    })
  },
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
  "reminder, in person": (locale) =>
    renderBookingReminder({
      ...inPerson,
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

/** A sentence without its capitals and its last full stop. */
function plain(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[.!?:…]+$/, "")
    .trim()
}

/**
 * Text that is rightly the same in English and another language. Each is
 * a decision: add one only for a word both languages really share.
 */
const SAME_AS_ENGLISH = new Set<string>(["email"])

/**
 * The sentences of one text found in another, whatever their capitals or
 * last full stop: those with at least `words` words of the email's own.
 */
function shared(text: string[], other: string[], words: number): string[] {
  const there = new Set(other.map(plain))
  return text
    .filter((piece) => ownWords(piece).length >= words)
    .filter((piece) => there.has(plain(piece)))
}

function sameSentences(html: string, other: string, words: number): string[] {
  return shared(sentences(html), sentences(other), words)
}

/** English left in another language's text, a single word included. */
function englishIn(english: string[], other: string[]): string[] {
  return shared(english, other, 1).filter(
    (piece) => !SAME_AS_ENGLISH.has(plain(piece))
  )
}

function englishLeft(english: string, other: string): string[] {
  return englishIn(sentences(english), sentences(other))
}

/**
 * Common English words that neither Portuguese nor Spanish has. English
 * that was reworded, so that no sentence matches the English email any
 * more, nearly always has one. A short English label can have none ("On
 * hold"): this narrows the gap, it does not close it.
 *
 * Left out on purpose, because Portuguese or Spanish use them: for, a, no,
 * do, as, has, can; in, on and by (inside "check-in", "on-line",
 * "stand-by"); and at (AT is the Portuguese tax authority).
 */
const ENGLISH_WORDS = new Set(
  (
    "the your you this with and will please that from have been was were " +
    "our their they here when what not to is of it an we be if"
  ).split(" ")
)

/** The sentences of a Portuguese or Spanish text that have English words. */
function withEnglishWords(text: string[]): string[] {
  return text.filter((piece) =>
    ownWords(piece).some((word) => ENGLISH_WORDS.has(word.toLowerCase()))
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
        /\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b|\{\{|\}\}|\{[\w.]+\}/
      )
    }
  })

  it.each(names)("%s: says the same things in each", async (name) => {
    // A name, a date or an amount the English email shows is somewhere in
    // the other two: a translation that dropped one everywhere would send
    // an email without it. One shown twice and dropped once is not seen
    // here; the shared words below check each sentence that is given one.
    const english = await EMAILS[name]!("en")
    const shown = Object.values(GIVEN).filter((value) =>
      english.includes(value)
    )
    expect(shown.length, `${name}: values shown`).toBeGreaterThan(0)
    for (const locale of ["pt", "es"] as const) {
      const html = await EMAILS[name]!(locale)
      expect(
        shown.filter((value) => !html.includes(value)),
        `${name}: missing in ${locale}`
      ).toEqual([])
    }
  })

  it.each(names)(
    "%s: no English is left in Portuguese or Spanish",
    async (name) => {
      const english = await EMAILS[name]!("en")
      // The check can see this email: against itself, every sentence of
      // its own is found, and the shortest email has more than three.
      // Without that, an email whose words the check cannot read would
      // pass by saying nothing.
      expect(
        sameSentences(english, english, 1).length,
        `${name}: sentences the check can see`
      ).toBeGreaterThan(3)
      expect(
        withEnglishWords(sentences(english)).length,
        `${name}: English words seen in English`
      ).toBeGreaterThan(0)
      for (const locale of ["pt", "es"] as const) {
        const html = await EMAILS[name]!(locale)
        expect(
          englishLeft(english, html),
          `${name}: English left in ${locale}`
        ).toEqual([])
        expect(
          withEnglishWords(sentences(html)),
          `${name}: English words in ${locale}`
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
    // English with its capitals or its full stop changed is still English.
    const changed = portuguese.replace(
      "</body>",
      `<p>${full.toUpperCase().replace(/\.$/, "")}</p></body>`
    )
    expect(englishLeft(english, changed)).toHaveLength(1)
    // English reworded matches no sentence, and still has English words.
    expect(withEnglishWords(sentences(portuguese))).toEqual([])
    expect(
      withEnglishWords(["A sua sessão.", "Thank you for your booking."])
    ).toEqual(["Thank you for your booking."])
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
          renderAuthEmail({
            ...form,
            url: GIVEN.href,
            code: GIVEN.code,
            locale,
          })
        )
      )
      const which = JSON.stringify(form)
      for (const part of ["subject", "title", "body"] as const) {
        expect(en![part], `${which} ${part}`).not.toBe("")
        expect(pt![part], `${which} ${part} in pt`).not.toBe(en![part])
        expect(es![part], `${which} ${part} in es`).not.toBe(en![part])
        expect(es![part], `${which} ${part} pt and es`).not.toBe(pt![part])
        // Reworded English is still English.
        expect(
          withEnglishWords([...split(pt![part]), ...split(es![part])]),
          `${which} ${part}: English words`
        ).toEqual([])
      }
    }
  })
})

describe("the list of emails above", () => {
  const here = import.meta.dirname
  const read = (...path: string[]) => readFileSync(join(here, ...path), "utf8")
  // The list itself and what it is built from, not the checks after it.
  const thisFile = read("three-languages.test.ts")
  const listEnds = thisFile.indexOf("\n/**\n * A paragraph as its sentences.")
  const list = thisFile.slice(0, listEnds)
  const listed = (text: string) => list.includes(text)

  it("is found in this file, whole", () => {
    expect(
      listEnds,
      "the list ends where the comment above split() begins: keep its first line"
    ).toBeGreaterThan(0)
    expect(listed("const EMAILS")).toBe(true)
    expect(listed("describe(")).toBe(false)
  })

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
      expect(listed(`${renderer}({`), `${renderer} has no entry`).toBe(true)
    }
  })

  it("has every form of each email that comes in forms", () => {
    // `export type SomethingKind = "a" | "b"`: a form added to an email and
    // not to the list above fails here. The name's ending says which input
    // carries it. The search is by text (`kind: "a"` somewhere in the list),
    // so it says a form was listed, not which email it was listed under.
    const INPUT = {
      Kind: "kind",
      Status: "status",
      Window: "window",
      Detail: "urgentHelp",
      Mode: "sessionMode",
    } as const
    const sources = [
      read("session-mode.ts"),
      read("render.tsx"),
      ...["components", "templates"].flatMap((folder) =>
        readdirSync(join(here, folder))
          .filter((file) => file.endsWith(".tsx"))
          .map((file) => read(folder, file))
      ),
    ]
      .join("\n")
      // A note written inside a type is not part of it.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
    const declared = [
      ...sources.matchAll(
        /export type (\w+(Kind|Status|Window|Detail|Mode))\b[^=\n]*=\s*\|?\s*"/g
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
    // Every such type that begins with a quoted name was read to its end.
    // Not read: a type built another way (`(typeof LIST)[number]`), one in
    // a file outside these folders, and a choice written inside a props
    // type (`audience?: "member" | "expert"`). Those need a form by hand.
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
        expect(
          listed(`${input}: "${member}"`),
          `${name} "${member}" has no entry`
        ).toBe(true)
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
  // A name given to a function is taken out again before comparing.
  const SAMPLES: unknown[][] = [
    [GIVEN.member, GIVEN.date],
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
    // Today there are more than 200: the strings, and each function five
    // times. Far fewer means this stopped reading them.
    expect(english.size).toBeGreaterThan(150)
    const portuguese = new Map(texts(getEmailTranslations("pt")))
    for (const locale of ["pt", "es"] as const) {
      const same: string[] = []
      const words: string[] = []
      const pasted: string[] = []
      for (const [path, text] of texts(getEmailTranslations(locale))) {
        expect(text.trim(), `${locale} ${path}`).not.toBe("")
        // Sentence by sentence: an entry half translated has English in it.
        for (const left of englishIn(
          split(english.get(path) ?? ""),
          split(text)
        )) {
          same.push(`${path}: ${left}`)
        }
        for (const sentence of withEnglishWords(split(text))) {
          words.push(`${path}: ${sentence}`)
        }
        // Spanish that is the Portuguese, pasted. Short entries are often
        // rightly the same in the two, so only sentences count.
        if (locale === "es") {
          for (const sentence of shared(
            split(portuguese.get(path) ?? ""),
            split(text),
            4
          )) {
            pasted.push(`${path}: ${sentence}`)
          }
        }
      }
      expect(same, `${locale}: entries still in English`).toEqual([])
      expect(words, `${locale}: entries with English words`).toEqual([])
      expect(pasted, `${locale}: entries the same as Portuguese`).toEqual([])
    }
  })

  it("say what they are given, in each language", () => {
    /** Every entry that is a function, by its path. */
    type Says = (...given: unknown[]) => unknown
    function functions(value: unknown, path = ""): [string, Says][] {
      if (typeof value === "function") return [[path, value as Says]]
      if (typeof value !== "object" || value === null) return []
      return Object.entries(value).flatMap(([key, inner]) =>
        functions(inner, path ? `${path}.${key}` : key)
      )
    }
    const english = functions(getEmailTranslations("en"))
    expect(english.length).toBeGreaterThan(10)
    for (const locale of ["pt", "es"] as const) {
      const other = new Map(functions(getEmailTranslations(locale)))
      const dropped: string[] = []
      for (const [path, say] of english) {
        for (const given of SAMPLES) {
          const there = String(other.get(path)!(...given))
          // A name, a date or a number the English sentence says. Not the
          // number one: "1 follow-up" is rightly "un seguimiento".
          for (const value of given) {
            if (typeof value === "boolean" || value === 1) continue
            if (
              String(say(...given)).includes(String(value)) &&
              !there.includes(String(value))
            ) {
              dropped.push(`${path}: ${String(value)} is not in "${there}"`)
            }
          }
        }
      }
      expect(dropped, `${locale}: values a sentence dropped`).toEqual([])
    }
  })
})
