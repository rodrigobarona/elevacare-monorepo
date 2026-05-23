/** Minimal localStorage helpers for Design Lab prototypes. */

export type LabDraft = {
  specialty?: string
  practiceCountry?: "PT" | "ES" | "BR"
  city?: string
  sessionTitle?: string
  eventDuration?: number
  eventPrice?: number
  name?: string
  headline?: string
  workspaceName?: string
  accentColor?: string
  path?: "solo" | "clinic"
  tier?: "community" | "growth" | "insurance"
  mfaEnabled?: boolean
  payoutPercent?: number
  introOffers?: boolean
  photosDone?: boolean
  stripeDone?: boolean
  complianceDone?: boolean
  termsAccepted?: boolean
  nif?: string
  licenseScope?: string
  spaceCreated?: boolean
}

const PREFIX = "eleva-lab"

export const SEED_DRAFT: LabDraft = {
  spaceCreated: true,
  workspaceName: "Ana's Expert Space",
  specialty: "Clinical nutrition",
  practiceCountry: "PT",
  city: "Lisbon",
  name: "Dr. Ana Silva",
  headline: "Helping members build sustainable nutrition habits",
  sessionTitle: "Intro consultation",
  eventDuration: 45,
  eventPrice: 65,
  tier: "community",
}

export function loadLabDraft(slug: string): LabDraft {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(`${PREFIX}:${slug}`)
    return raw ? (JSON.parse(raw) as LabDraft) : {}
  } catch {
    return {}
  }
}

export function saveLabDraft(slug: string, draft: LabDraft): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`${PREFIX}:${slug}`, JSON.stringify(draft))
  } catch {
    /* quota / private browsing */
  }
}

export function patchLabDraft(
  slug: string,
  patch: Partial<LabDraft>
): LabDraft {
  const next = { ...loadLabDraft(slug), ...patch }
  saveLabDraft(slug, next)
  return next
}

export function seedSetupDraft(slug: string): LabDraft {
  const next = { ...SEED_DRAFT, ...loadLabDraft(slug), spaceCreated: true }
  saveLabDraft(slug, next)
  return next
}

export function markSpaceCreated(slug: string): LabDraft {
  return patchLabDraft(slug, { spaceCreated: true })
}
