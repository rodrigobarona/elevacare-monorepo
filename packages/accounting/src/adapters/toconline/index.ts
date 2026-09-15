import {
  decryptOAuthToken,
  encryptOAuthToken,
  revokeOAuthToken,
} from "@eleva/encryption"
import { requireToconlineEnv } from "@eleva/config/env"
import { AdapterError } from "../../types"
import type {
  AdapterManifest,
  AdapterStatus,
  ConnectInput,
  ConnectResult,
  DisconnectInput,
  ExpertInvoicingAdapter,
  IssueInvoiceInput,
  IssueInvoiceResult,
} from "../../types"
import { assertV1SalesDocumentPostAllowed } from "./issuance-gate"
import { resolveDocumentSeriesId } from "./lookups"

/**
 * TOConline Tier 2 adapter — expert-side issuance.
 *
 * Authentication: OAuth 2.0 Authorization Code (simplified flow proven
 * in PR 07.0). No PKCE. HTTP Basic `client_id:secret` on POST /token.
 * Hosts come from env (`TOCONLINE_API_BASE_URL` /
 * `TOCONLINE_OAUTH_BASE_URL`), never literals.
 *
 * v1 `POST /api/v1/commercial_sales_documents` auto-finalizes. This
 * increment never POSTs that path — accountant 2026-09-15 forbids
 * fictitious finalized docs on TEST and ELEVA. `issueInvoice` maps and
 * validates, then throws `toconline_v1_auto_finalize_blocked`.
 */

const MANIFEST: AdapterManifest = {
  slug: "toconline",
  displayName: "TOConline",
  countries: ["PT"],
  installType: "oauth",
  description: {
    en: "Connect your TOConline account to issue AT-certified invoices automatically.",
    pt: "Ligue a sua conta TOConline para emitir faturas certificadas pela AT automaticamente.",
    es: "Conecte su cuenta TOConline para emitir facturas certificadas por AT automáticamente.",
  },
}

const SCOPE = "commercial"

const API_HOST_OR_BASE_RE = /API (base|host)/i

function isFatalSeriesLookupFailure(err: unknown): boolean {
  if (!(err instanceof AdapterError)) return false
  if (err.kind === "credentials" || err.kind === "fatal") return true
  return err.kind === "validation" && API_HOST_OR_BASE_RE.test(err.message)
}

interface ToconlineMetadata {
  /** Authoritative TOConline series id (v1 `document_series_id`). */
  document_series_id?: string
  /** @deprecated Prefer `document_series_id`. */
  seriesId?: string
  businessName?: string
  lastProbeAt?: string
  orgId?: string
  userId?: string
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

async function buildAuthUrl(input: {
  state: string
  expertProfileId: string
}): Promise<{ url: string }> {
  const env = requireToconlineEnv()
  const url = new URL(`${env.TOCONLINE_OAUTH_URL.replace(/\/$/, "")}/auth`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", env.TOCONLINE_CLIENT_ID)
  url.searchParams.set("redirect_uri", env.TOCONLINE_URI_REDIRECT)
  url.searchParams.set("scope", SCOPE)
  url.searchParams.set("state", input.state)
  return { url: url.toString() }
}

async function connect(input: ConnectInput): Promise<ConnectResult> {
  const env = requireToconlineEnv()
  const code = stringOrThrow(
    input.payload.code,
    "TOConline callback missing 'code'"
  )

  const tokenRes = await fetch(
    `${env.TOCONLINE_OAUTH_URL.replace(/\/$/, "")}/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: basicAuthHeader(
          env.TOCONLINE_CLIENT_ID,
          env.TOCONLINE_CLIENT_SECRET
        ),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.TOCONLINE_URI_REDIRECT,
        scope: SCOPE,
      }).toString(),
    }
  )

  if (!tokenRes.ok) {
    const body = await safeBody(tokenRes)
    throw new AdapterError(
      "credentials",
      `TOConline token exchange failed: ${tokenRes.status} ${body}`
    )
  }

  const json = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000)

  const vaultRef = await encryptOAuthToken({
    provider: "toconline",
    userId: input.userId,
    orgId: input.orgId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt,
  })

  const metadata: ToconlineMetadata = {
    orgId: input.orgId,
    userId: input.userId,
  }

  try {
    const seriesId = await resolveDocumentSeriesId(
      {
        apiBase: env.TOCONLINE_API_URL.replace(/\/$/, ""),
        accessToken: json.access_token,
      },
      { documentType: "FT", prefix: env.TOCONLINE_SERIES_PREFIX }
    )
    if (seriesId) {
      metadata.document_series_id = seriesId
    }
  } catch (err) {
    if (isFatalSeriesLookupFailure(err)) {
      await revokeOAuthToken(vaultRef)
      throw err
    }
    console.warn(
      "[toconline] document series lookup failed after OAuth; connect continues",
      err instanceof Error ? err.message : err
    )
  }

  return {
    vaultRef,
    metadata: { ...metadata },
    expiresAt: expiresAt.toISOString(),
  }
}

async function issueInvoice(
  _creds: {
    vaultRef: string
    metadata?: Record<string, unknown>
    orgId?: string
  },
  _input: IssueInvoiceInput
): Promise<IssueInvoiceResult> {
  // Closed until 07.1: v1 create auto-finalizes. Assert the gate before
  // mapping so dispatch records `toconline_v1_auto_finalize_blocked`
  // instead of unsigned-IVA mapper errors (`exempt` has no signed code).
  return assertV1SalesDocumentPostAllowed()
}

async function status(creds: {
  vaultRef: string
  metadata?: Record<string, unknown>
  orgId?: string
}): Promise<AdapterStatus> {
  try {
    const loaded = await ensureToconlineAccessToken(
      creds.vaultRef,
      credsOrgId(creds.metadata, creds.orgId),
      credsUserId(creds.metadata)
    )
    const token = loaded.accessToken
    const env = requireToconlineEnv()
    const res = await fetch(
      `${env.TOCONLINE_API_URL.replace(/\/$/, "")}/api/v1/companies`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    )
    if (res.status === 401) {
      return {
        status: "expired",
        message: "TOConline token expired. Reconnect to resume invoicing.",
      }
    }
    if (res.status === 429) {
      return {
        status: "rate_limited",
        message: "TOConline rate limit; retry shortly.",
      }
    }
    if (!res.ok) {
      return {
        status: "error",
        message: `TOConline probe failed: ${res.status}`,
      }
    }
    return { status: "healthy" }
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

async function disconnect(input: DisconnectInput): Promise<void> {
  if (!input.vaultRef) return
  await revokeOAuthToken(input.vaultRef)
}

function credsOrgId(
  metadata?: Record<string, unknown>,
  fallbackOrgId?: string
): string {
  const orgId = metadata?.orgId
  if (typeof orgId === "string" && orgId.length > 0) return orgId
  if (typeof fallbackOrgId === "string" && fallbackOrgId.length > 0) {
    return fallbackOrgId
  }
  throw new AdapterError("credentials", "TOConline credentials missing orgId")
}

function credsUserId(metadata?: Record<string, unknown>): string {
  const userId = metadata?.userId
  if (typeof userId === "string" && userId.length > 0) return userId
  throw new AdapterError("credentials", "TOConline credentials missing userId")
}

const TOKEN_REFRESH_SKEW_MS = 60_000

export interface LoadedToconlineToken {
  accessToken: string
  vaultRef: string
  expiresAt: Date | null
  rotated: boolean
}

export function needsToconlineTokenRefresh(
  expiresAt: Date | null,
  now = Date.now()
): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= now
}

export async function ensureToconlineAccessToken(
  ciphertext: string,
  orgId: string,
  userId: string
): Promise<LoadedToconlineToken> {
  try {
    const decrypted = await decryptOAuthToken(orgId, ciphertext, {
      provider: "toconline",
      userId,
    })
    if (!decrypted.accessToken) {
      throw new AdapterError(
        "credentials",
        "TOConline credentials missing access_token"
      )
    }
    if (!needsToconlineTokenRefresh(decrypted.expiresAt)) {
      return {
        accessToken: decrypted.accessToken,
        vaultRef: ciphertext,
        expiresAt: decrypted.expiresAt,
        rotated: false,
      }
    }
    if (!decrypted.refreshToken) {
      throw new AdapterError(
        "credentials",
        "TOConline credentials expired and have no refresh_token"
      )
    }
    return refreshToconlineAccessToken({
      refreshToken: decrypted.refreshToken,
      orgId,
      userId,
    })
  } catch (err) {
    if (err instanceof AdapterError) throw err
    throw new AdapterError(
      "credentials",
      `Failed to load TOConline credentials: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

async function refreshToconlineAccessToken(input: {
  refreshToken: string
  orgId: string
  userId: string
}): Promise<LoadedToconlineToken> {
  const env = requireToconlineEnv()
  const tokenRes = await fetch(
    `${env.TOCONLINE_OAUTH_URL.replace(/\/$/, "")}/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: basicAuthHeader(
          env.TOCONLINE_CLIENT_ID,
          env.TOCONLINE_CLIENT_SECRET
        ),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
        scope: SCOPE,
      }).toString(),
    }
  )
  if (!tokenRes.ok) {
    const body = await safeBody(tokenRes)
    throw new AdapterError(
      "credentials",
      `TOConline token refresh failed: ${tokenRes.status} ${body}`
    )
  }
  const json = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!json.access_token) {
    throw new AdapterError(
      "credentials",
      "TOConline token refresh returned no access_token"
    )
  }
  const expiresAt = new Date(
    Date.now() + Math.max(1, json.expires_in ?? 3600) * 1000
  )
  const vaultRef = await encryptOAuthToken({
    provider: "toconline",
    userId: input.userId,
    orgId: input.orgId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? input.refreshToken,
    expiresAt,
  })
  return {
    accessToken: json.access_token,
    vaultRef,
    expiresAt,
    rotated: true,
  }
}

function stringOrThrow(value: unknown, msg: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AdapterError("validation", msg)
  }
  return value
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500)
  } catch {
    return "<unreadable body>"
  }
}

export { mapIssueInvoiceToV1Payload } from "./payload"
export {
  listOssTaxes,
  resolveCountryId,
  resolveCurrencyId,
  resolveCustomerId,
  resolveDocumentSeriesId,
  resolveExemptionReasonId,
  resolveServiceId,
  resolveTaxId,
} from "./lookups"
export {
  TOC_V1_AUTO_FINALIZE_BLOCKED,
  TOC_V1_AUTO_FINALIZE_MESSAGE,
} from "./issuance-gate"

export const toconlineAdapter: ExpertInvoicingAdapter = {
  manifest: MANIFEST,
  buildAuthUrl,
  connect,
  issueInvoice,
  status,
  disconnect,
}
