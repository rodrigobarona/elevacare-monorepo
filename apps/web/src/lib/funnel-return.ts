const STORAGE_KEY = "bookingFunnel:v1"
const REDIRECT_KEY = "bookingFunnel:redirect"

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

export type FunnelRedirectStatus = "succeeded" | "processing" | "failed"

export type FunnelRedirect = {
  status: FunnelRedirectStatus
  paymentIntentId: string | null
}

type RestoreMemo = {
  status: FunnelRedirectStatus
  paymentIntentId: string
  snapshot: FunnelReturnSnapshot
}

let restoreMemo: RestoreMemo | null = null
const confirmLocks = new Set<string>()

function isRedirectStatus(value: string | null): value is FunnelRedirectStatus {
  return value === "succeeded" || value === "processing" || value === "failed"
}

export function parseRedirect(search: string): FunnelRedirect | null {
  const query = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(query)
  const status = params.get("redirect_status")
  if (!isRedirectStatus(status)) return null
  const paymentIntentId = params.get("payment_intent")
  return {
    status,
    paymentIntentId: paymentIntentId ? paymentIntentId : null,
  }
}

export function parseRedirectStatus(
  search: string
): FunnelRedirectStatus | null {
  return parseRedirect(search)?.status ?? null
}

function readStoredRedirect(): FunnelRedirect | null {
  try {
    const stored = sessionStorage.getItem(REDIRECT_KEY)
    if (!stored) return null
    if (isRedirectStatus(stored)) {
      return { status: stored, paymentIntentId: null }
    }
    const parsed = JSON.parse(stored) as Partial<FunnelRedirect>
    if (!isRedirectStatus(parsed.status ?? null)) return null
    return {
      status: parsed.status,
      paymentIntentId: parsed.paymentIntentId ?? null,
    }
  } catch {
    return null
  }
}

function persistRedirect(redirect: FunnelRedirect): void {
  try {
    sessionStorage.setItem(REDIRECT_KEY, JSON.stringify(redirect))
  } catch {
    // ignore
  }
}

/** Persist Stripe's redirect so a later client rewrite cannot drop it. */
export function captureRedirect(
  search = typeof window === "undefined" ? "" : window.location.search
): FunnelRedirect | null {
  const fromHash =
    typeof window === "undefined"
      ? null
      : parseRedirect(window.location.hash.replace(/^#/, "?"))
  const fromSearch = parseRedirect(search)
  const stored = readStoredRedirect()
  const redirect = fromSearch ?? fromHash ?? stored
  if (!redirect) return null
  persistRedirect(redirect)
  return redirect
}

export function captureRedirectStatus(
  search = typeof window === "undefined" ? "" : window.location.search
): FunnelRedirectStatus | null {
  return captureRedirect(search)?.status ?? null
}

export function confirmLockKey(
  reservationId: string,
  paymentIntentId: string
): string {
  return `${reservationId}:${paymentIntentId}`
}

export function tryAcquireConfirmLock(key: string): boolean {
  if (confirmLocks.has(key)) return false
  confirmLocks.add(key)
  return true
}

export function releaseConfirmLock(key: string): void {
  confirmLocks.delete(key)
}

function snapshotMatchesIntent(
  snapshot: FunnelReturnSnapshot,
  paymentIntentId: string | null
): paymentIntentId is string {
  return (
    Boolean(paymentIntentId) &&
    snapshot.payment.paymentIntentId === paymentIntentId
  )
}

/**
 * Resolve Stripe return + funnel snapshot. Module memo survives React Strict
 * Mode remounts that would otherwise clear sessionStorage mid-restore.
 */
export function takeFunnelRestore(
  search = typeof window === "undefined" ? "" : window.location.search
): RestoreMemo | null {
  const redirect = captureRedirect(search)
  const source = redirect ?? restoreMemo
  if (!source) return null
  const { status, paymentIntentId } = source
  const snapshot =
    loadFunnelReturn({
      allowExpired: status === "succeeded" || status === "processing",
    }) ?? restoreMemo?.snapshot
  if (!snapshot || !snapshotMatchesIntent(snapshot, paymentIntentId)) {
    return null
  }
  restoreMemo = { status, paymentIntentId, snapshot }
  return restoreMemo
}

export function saveFunnelReturn(snapshot: FunnelReturnSnapshot): void {
  restoreMemo = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Private mode or quota — redirect restore will simply fail closed.
  }
}

export function loadFunnelReturn(options?: {
  allowExpired?: boolean
}): FunnelReturnSnapshot | null {
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
    if (!options?.allowExpired) {
      const expiresAt = Date.parse(parsed.reservation.expiresAt)
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        clearFunnelReturn()
        return null
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function clearFunnelReturn(): void {
  restoreMemo = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
  } catch {
    // ignore
  }
}

/** Drop session keys now; drop the remount memo after this turn. */
export function consumeFunnelRestore(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
  } catch {
    // ignore
  }
  queueMicrotask(() => {
    restoreMemo = null
  })
}

export function bookingReturnUrl(href = window.location.href): string {
  const url = new URL(href)
  url.searchParams.delete("payment_intent")
  url.searchParams.delete("payment_intent_client_secret")
  url.searchParams.delete("redirect_status")
  return url.toString()
}
