export const TEMPLATE_PHI_DETECTORS = [
  "member_identifier",
  "email",
  "phone",
  "national_id",
  "date",
  "source_text",
] as const

export type TemplatePhiDetector = (typeof TEMPLATE_PHI_DETECTORS)[number]

export type TemplatePhiFinding = {
  detector: TemplatePhiDetector
  start: number
  end: number
  text: string
}

export type TemplatePhiContext = {
  /** Exact identifiers of the source booking's member (name, e-mail, phone, dates, location). */
  identifiers?: readonly string[]
  /** Decrypted text of the source record; long sentences must not be copied verbatim. */
  sourceTexts?: readonly string[]
}

const PLACEHOLDER = /\{\{\s*[a-zA-Z.]+\s*\}\}/g
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{7,}\d/g
const NATIONAL_ID = [
  /\b\d{9}\b/g, // PT NIF / NISS-style
  /\b\d{8}[A-Z]\b/g, // ES DNI
  /\b[XYZ]\d{7}[A-Z]\b/g, // ES NIE
  /\b\d{8}\s?\d\s?[A-Z]{2}\d\b/g, // PT Cartão de Cidadão
]
const MONTHS =
  "jan(?:uary|eiro)?|feb(?:ruary)?|fev(?:ereiro)?|mar(?:ch|ço|co|zo)?|apr(?:il)?|abr(?:il)?|may|mai(?:o)?|mayo|jun(?:e|ho|io)?|jul(?:y|ho|io)?|aug(?:ust)?|ago(?:sto)?|sep(?:tember)?|set(?:embro)?|sept(?:iembre)?|oct(?:ober|ubre)?|out(?:ubro)?|nov(?:ember|embro|iembre)?|dec(?:ember)?|dez(?:embro)?|dic(?:iembre)?|ene(?:ro)?|febrero|marzo|abril|junio|julio|agosto|septiembre|octubre|noviembre|diciembre"
const DATES = [
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g,
  new RegExp(
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:de\\s+)?(?:${MONTHS})\\.?(?:\\s+(?:de\\s+)?\\d{4})?\\b`,
    "gi"
  ),
  new RegExp(
    `\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`,
    "gi"
  ),
]
const SOURCE_SENTENCE_MIN = 40
const IDENTIFIER_MIN = 3

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Blank out placeholders so tokens like `{{session.date}}` never trip detectors. */
function maskPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER, (m) => " ".repeat(m.length))
}

function collect(
  out: TemplatePhiFinding[],
  text: string,
  pattern: RegExp,
  detector: TemplatePhiDetector,
  accept: (match: string) => boolean = () => true
) {
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined || !accept(match[0])) continue
    out.push({
      detector,
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    })
  }
}

function identifierTerms(identifiers: readonly string[]): string[] {
  const terms = new Set<string>()
  for (const raw of identifiers) {
    const value = raw.trim()
    if (value.length < IDENTIFIER_MIN) continue
    terms.add(value)
    for (const part of value.split(/\s+/)) {
      if (part.length >= IDENTIFIER_MIN) terms.add(part)
    }
  }
  return [...terms].sort((a, b) => b.length - a.length)
}

function sourceSentences(sourceTexts: readonly string[]): string[] {
  const sentences = new Set<string>()
  for (const text of sourceTexts) {
    for (const sentence of text.split(/[.!?\n]+/)) {
      const trimmed = sentence.trim().replace(/\s+/g, " ")
      if (trimmed.length >= SOURCE_SENTENCE_MIN) sentences.add(trimmed)
    }
  }
  return [...sentences]
}

/** Drop findings fully contained in an earlier, longer finding. */
function dedupe(findings: TemplatePhiFinding[]): TemplatePhiFinding[] {
  const sorted = [...findings].sort(
    (a, b) => a.start - b.start || b.end - a.end
  )
  const out: TemplatePhiFinding[] = []
  for (const finding of sorted) {
    const last = out.at(-1)
    if (last && finding.start >= last.start && finding.end <= last.end) continue
    out.push(finding)
  }
  return out
}

/**
 * Template PHI scrubber. Returns every span that looks like member data;
 * an empty array means the text is safe to store as a template.
 */
export function scanTemplateForPhi(
  text: string,
  context: TemplatePhiContext = {}
): TemplatePhiFinding[] {
  const masked = maskPlaceholders(text)
  const findings: TemplatePhiFinding[] = []

  for (const term of identifierTerms(context.identifiers ?? [])) {
    collect(
      findings,
      masked,
      new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
        "giu"
      ),
      "member_identifier"
    )
  }
  collect(findings, masked, EMAIL, "email")
  for (const pattern of NATIONAL_ID) {
    collect(findings, masked, pattern, "national_id")
  }
  collect(findings, masked, PHONE_CANDIDATE, "phone", (m) => {
    const digits = m.replace(/\D/g, "").length
    return digits >= 9 && digits <= 15
  })
  for (const pattern of DATES) {
    collect(findings, masked, pattern, "date")
  }

  for (const sentence of sourceSentences(context.sourceTexts ?? [])) {
    const pattern = sentence.split(" ").map(escapeRegExp).join("\\s+")
    collect(findings, masked, new RegExp(pattern, "gi"), "source_text")
  }

  return dedupe(findings)
}

export const TEMPLATE_PLACEHOLDERS = [
  "member.firstName",
  "session.date",
  "expert.name",
] as const

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number]

export type TemplatePlaceholderValues = Partial<
  Record<TemplatePlaceholder, string>
>

export function fillTemplatePlaceholders(
  body: string,
  values: TemplatePlaceholderValues
): string {
  return body.replace(PLACEHOLDER, (token) => {
    const key = token.slice(2, -2).trim() as TemplatePlaceholder
    return values[key] ?? token
  })
}

/** Reverse of fill: put tokens back where the filled values appear. */
export function tokenizeTemplatePlaceholders(
  body: string,
  values: TemplatePlaceholderValues
): string {
  let out = body
  const entries = Object.entries(values)
    .filter((entry): entry is [TemplatePlaceholder, string] =>
      Boolean(entry[1] && entry[1].trim().length >= IDENTIFIER_MIN)
    )
    .sort((a, b) => b[1].length - a[1].length)
  for (const [key, value] of entries) {
    out = out.replace(
      new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(value.trim())}(?![\\p{L}\\p{N}])`,
        "giu"
      ),
      `{{${key}}}`
    )
  }
  return out
}
