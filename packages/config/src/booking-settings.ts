/**
 * Per-service booking setting (Instant Book vs Request to book).
 * Snapshotted onto the reservation/booking so a later service edit never
 * rewrites an open request. Same “one preset” pattern as cancellation policy.
 */

export const BOOKING_SETTING_VALUES = ["instant", "request"] as const

export type BookingSetting = (typeof BOOKING_SETTING_VALUES)[number]

export const DEFAULT_BOOKING_SETTING: BookingSetting = "instant"

/** Expert must accept or decline within this many hours, or before start. */
export const APPROVAL_WINDOW_HOURS = 24

/**
 * Optional Instant Book lead time: slots starting sooner than this need the
 * expert to confirm (e.g. in-person offers). `null` means always instant.
 */
export const INSTANT_BOOK_LEAD_MINUTES_OPTIONS = [120, 720, 1440, 2880] as const

export const INSTANT_BOOK_LEAD_MINUTES_MAX = 7 * 24 * 60

export type BookingSettingLocale = "en" | "pt" | "es"

const SETTING_COPY: Record<
  BookingSettingLocale,
  {
    names: Record<BookingSetting, string>
    lines: Record<BookingSetting, readonly string[]>
  }
> = {
  en: {
    names: {
      instant: "Instant Book",
      request: "Request to book",
    },
    lines: {
      instant: [
        "The member pays or confirms and is booked immediately.",
        "Best for online sessions you can take without a prior check.",
      ],
      request: [
        "The member pays now. You accept or decline within 24 hours, or before the session if that is sooner.",
        "Fits in-person services where a few details need checking.",
        "A decline or timeout refunds 100% and frees the slot.",
      ],
    },
  },
  pt: {
    names: {
      instant: "Reserva imediata",
      request: "Pedido de reserva",
    },
    lines: {
      instant: [
        "O membro paga ou confirma e fica logo marcado.",
        "Melhor para sessões online que pode aceitar sem uma verificação prévia.",
      ],
      request: [
        "O membro paga agora. Aceita ou recusa em 24 horas, ou antes da sessão se for mais cedo.",
        "Adequado a serviços presenciais em que precisa de confirmar alguns detalhes.",
        "Uma recusa ou o fim do prazo devolve 100% e liberta o horário.",
      ],
    },
  },
  es: {
    names: {
      instant: "Reserva instantánea",
      request: "Solicitar reserva",
    },
    lines: {
      instant: [
        "El miembro paga o confirma y queda reservado al momento.",
        "Mejor para sesiones online que puedes aceptar sin una revisión previa.",
      ],
      request: [
        "El miembro paga ahora. Aceptas o rechazas en 24 horas, o antes de la sesión si es antes.",
        "Encaja en servicios presenciales donde hay que comprobar algunos detalles.",
        "Un rechazo o el fin del plazo reembolsa el 100% y libera el hueco.",
      ],
    },
  },
}

export function describeBookingSetting(
  setting: BookingSetting,
  locale: BookingSettingLocale
): { name: string; lines: readonly string[] } {
  const copy = SETTING_COPY[locale]
  return { name: copy.names[setting], lines: copy.lines[setting] }
}

export function isBookingSetting(value: string): value is BookingSetting {
  return (BOOKING_SETTING_VALUES as readonly string[]).includes(value)
}

export function bookingSettingFromRequiresApproval(
  requiresApproval: boolean
): BookingSetting {
  return requiresApproval ? "request" : "instant"
}

/** True when this slot needs the expert to accept before it is confirmed. */
export function slotRequiresApproval(input: {
  requiresApproval: boolean
  instantBookLeadMinutes: number | null
  startsAt: Date
  now: Date
}): boolean {
  if (input.requiresApproval) return true
  if (input.instantBookLeadMinutes == null) return false
  const leadMs = input.instantBookLeadMinutes * 60 * 1000
  return input.startsAt.getTime() - input.now.getTime() < leadMs
}

/**
 * Response window: 24 hours from now, or the session start if that is sooner.
 */
export function resolveApprovalDeadline(input: {
  startsAt: Date
  now: Date
}): Date {
  const windowEnd = new Date(
    input.now.getTime() + APPROVAL_WINDOW_HOURS * 60 * 60 * 1000
  )
  return windowEnd.getTime() <= input.startsAt.getTime()
    ? windowEnd
    : input.startsAt
}
