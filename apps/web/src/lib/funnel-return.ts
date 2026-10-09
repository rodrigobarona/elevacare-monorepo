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
    checkoutSessionId: string
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
  checkoutSessionId: string | null
}

type RestoreMemo = {
  status: FunnelRedirectStatus
  paymentIntentId: string
  checkoutSessionId: string | null
  snapshot: FunnelReturnSnapshot
}

let restoreMemo: RestoreMemo | null = null
const confirmLocks = new Set<string>()

function parseRedirectStatusValue(
  value: string | null
): FunnelRedirectStatus | null {
  if (value === "succeeded" || value === "processing" || value === "failed") {
    return value
  }
  // Stripe's failed-payment return uses requires_payment_method, not failed.
  return value === "requires_payment_method" ? "failed" : null
}

export function parseRedirect(search: string): FunnelRedirect | null {
  const query = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(query)
  const checkoutSessionId = params.get("session_id")
  const status =
    parseRedirectStatusValue(params.get("redirect_status")) ??
    (checkoutSessionId ? "succeeded" : null)
  if (!status) return null
  const paymentIntentId = params.get("payment_intent")
  return {
    status,
    paymentIntentId: paymentIntentId ? paymentIntentId : null,
    checkoutSessionId: checkoutSessionId ? checkoutSessionId : null,
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
    const storedStatus = parseRedirectStatusValue(stored)
    if (storedStatus) {
      return {
        status: storedStatus,
        paymentIntentId: null,
        checkoutSessionId: null,
      }
    }
    const parsed = JSON.parse(stored) as Partial<FunnelRedirect>
    const status = parseRedirectStatusValue(parsed.status ?? null)
    if (!status) return null
    return {
      status,
      paymentIntentId: parsed.paymentIntentId ?? null,
      checkoutSessionId: parsed.checkoutSessionId ?? null,
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

function snapshotMatchesRedirect(
  snapshot: FunnelReturnSnapshot,
  redirect: Pick<FunnelRedirect, "paymentIntentId" | "checkoutSessionId">
): boolean {
  if (
    redirect.checkoutSessionId &&
    snapshot.payment.checkoutSessionId === redirect.checkoutSessionId
  ) {
    return true
  }
  if (
    redirect.paymentIntentId &&
    snapshot.payment.paymentIntentId === redirect.paymentIntentId
  ) {
    return true
  }
  return Boolean(
    redirect.paymentIntentId &&
    !snapshot.payment.paymentIntentId &&
    snapshot.payment.checkoutSessionId
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
  const { status, paymentIntentId, checkoutSessionId } = source
  const loaded =
    loadFunnelReturn({
      allowExpired: status === "succeeded" || status === "processing",
    }) ?? restoreMemo?.snapshot
  if (
    !loaded ||
    !snapshotMatchesRedirect(loaded, { paymentIntentId, checkoutSessionId })
  ) {
    return null
  }
  const snapshot =
    paymentIntentId && !loaded.payment.paymentIntentId
      ? {
          ...loaded,
          payment: { ...loaded.payment, paymentIntentId },
        }
      : loaded
  restoreMemo = {
    status,
    paymentIntentId: paymentIntentId ?? snapshot.payment.paymentIntentId,
    checkoutSessionId:
      checkoutSessionId ?? snapshot.payment.checkoutSessionId ?? null,
    snapshot,
  }
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
  url.searchParams.delete("session_id")
  return url.toString()
}
