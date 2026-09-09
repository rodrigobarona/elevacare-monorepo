const STORAGE_KEY = "bookingFunnel:v1"

export type FunnelReturnSnapshot = {
  reservation: {
    reservationId: string
    reservationToken: string
    expiresAt: string
  }
  payment: {
    clientSecret: string
    paymentIntentId: string
    bookingId: string
    publishableKey: string
  }
  slot: {
    start: string
    end: string
    startLocal: string
    endLocal: string
  }
  modeId: string
  name: string
  email: string
  phone: string
  timeZone: string
  country: string
  language: string
}

export function parseRedirectStatus(
  search: string
): "succeeded" | "processing" | "failed" | null {
  const query = search.startsWith("?") ? search.slice(1) : search
  const status = new URLSearchParams(query).get("redirect_status")
  if (
    status === "succeeded" ||
    status === "processing" ||
    status === "failed"
  ) {
    return status
  }
  return null
}

export function saveFunnelReturn(snapshot: FunnelReturnSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Private mode or quota — redirect restore will simply fail closed.
  }
}

export function loadFunnelReturn(): FunnelReturnSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FunnelReturnSnapshot
    if (
      !parsed.reservation?.reservationId ||
      !parsed.reservation?.reservationToken ||
      !parsed.payment?.clientSecret ||
      !parsed.payment?.publishableKey ||
      !parsed.slot?.start ||
      !parsed.modeId
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearFunnelReturn(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function bookingReturnUrl(href = window.location.href): string {
  const url = new URL(href)
  url.searchParams.delete("payment_intent")
  url.searchParams.delete("payment_intent_client_secret")
  url.searchParams.delete("redirect_status")
  return url.toString()
}
