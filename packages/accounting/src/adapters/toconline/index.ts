import { createHash, randomBytes } from "node:crypto"
import {
  decryptOAuthToken,
  encryptOAuthToken,
  revokeOAuthToken,
  type VaultRef,
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

/**
 * TOConline Tier 2 adapter — expert-side issuance.
 *
 * Tier 1 (Eleva → expert) lives separately under
 * `eleva-platform/toconline.ts` (S6); Tier 2 here is the
 * expert-owned account used to issue patient invoices.
 *
 * Authentication: OAuth 2.0 Authorization Code + PKCE (S256)
 * against `app33.toconline.pt/oauth`. Tokens are encrypted via
 * @eleva/encryption and the vault ref is persisted in
 * `expert_integration_credentials.vault_ref`.
 *
 * Reference: docs/eleva-v3/toconline-api-reference.md
 */

const MANIFEST: AdapterManifest = {
  slug: "toconline",
  displayName: "TOConline",
  countries: ["PT"],
  installType: "oauth",
  description: {
    en: "Connect your TOConline account to issue AT-certified patient invoices automatically.",
    pt: "Ligue a sua conta TOConline para emitir faturas certificadas pela AT automaticamente.",
    es: "Conecte su cuenta TOConline para emitir facturas certificadas por AT automáticamente.",
  },
}

const SCOPE = "commercial"

interface ToconlineMetadata {
  /** Authoritative TOConline series id used for ELEVA-prefixed docs. */
  seriesId?: string
  /** Cached business-name from the connected account for admin UI. */
  businessName?: string
  /** Last `/v1/me`-style probe timestamp. */
  lastProbeAt?: string
}

async function buildAuthUrl(input: {
  state: string
  expertProfileId: string
}): Promise<{ url: string; codeVerifier: string }> {
  const env = requireToconlineEnv()
  const codeVerifier = base64Url(randomBytes(32))
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest()
  )

  const url = new URL(`${env.TOCONLINE_OAUTH_URL.replace(/\/$/, "")}/auth`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", env.TOCONLINE_CLIENT_ID)
  url.searchParams.set("redirect_uri", env.TOCONLINE_URI_REDIRECT)
  url.searchParams.set("scope", SCOPE)
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", input.state)

  return { url: url.toString(), codeVerifier }
}

async function connect(input: ConnectInput): Promise<ConnectResult> {
  const env = requireToconlineEnv()

  const code = stringOrThrow(
    input.payload.code,
    "TOConline callback missing 'code'"
  )
  const codeVerifier = stringOrThrow(
    input.payload.codeVerifier,
    "TOConline callback missing 'codeVerifier'"
  )

  const tokenRes = await fetch(
    `${env.TOCONLINE_OAUTH_URL.replace(/\/$/, "")}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.TOCONLINE_URI_REDIRECT,
        client_id: env.TOCONLINE_CLIENT_ID,
        client_secret: env.TOCONLINE_CLIENT_SECRET,
        code_verifier: codeVerifier,
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

  return {
    vaultRef,
    metadata: { seriesPrefix: env.TOCONLINE_SERIES_PREFIX },
    expiresAt: expiresAt.toISOString(),
  }
}

async function issueInvoice(
  creds: { vaultRef: string; metadata?: Record<string, unknown> },
  input: IssueInvoiceInput
): Promise<IssueInvoiceResult> {
  const token = await loadAccessToken(creds.vaultRef as VaultRef)
  const env = requireToconlineEnv()
  const meta = (creds.metadata ?? {}) as ToconlineMetadata

  const total = input.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice * (1 + l.taxRate / 100),
    0
  )
  const currency = input.lines[0]?.currency ?? "EUR"

  const body = {
    document_type: "FT",
    date: input.date,
    series_id: meta.seriesId,
    customer_tax_registration_number: input.patient.fiscalId || "999999990",
    customer_business_name: input.patient.name,
    customer_country: input.patient.country,
    notes: input.notes,
    lines: input.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      tax_rate: l.taxRate,
      currency: l.currency,
    })),
  }

  const res = await fetch(
    `${env.TOCONLINE_API_URL.replace(/\/$/, "")}/api/v1/sales-documents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": `eleva-booking-${input.bookingId}`,
      },
      body: JSON.stringify(body),
    }
  )

  if (res.status === 401) {
    throw new AdapterError(
      "credentials",
      "TOConline access token rejected (token expired or revoked)"
    )
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "60")
    throw new AdapterError(
      "retryable",
      `TOConline rate limit hit (retry-after ${retryAfter}s)`
    )
  }
  if (!res.ok) {
    const errBody = await safeBody(res)
    throw new AdapterError(
      "provider",
      `TOConline issueInvoice failed: ${res.status} ${errBody}`,
      String(res.status)
    )
  }

  const json = (await res.json()) as {
    id: string
    document_number: string
    pdf_url?: string
    total_amount?: number
    issued_at?: string
  }

  return {
    externalId: json.id,
    invoiceNumber: json.document_number,
    pdfUrl: json.pdf_url,
    total: json.total_amount ?? total,
    currency,
    issuedAt: json.issued_at ?? new Date().toISOString(),
  }
}

async function status(creds: {
  vaultRef: string
  metadata?: Record<string, unknown>
}): Promise<AdapterStatus> {
  try {
    const token = await loadAccessToken(creds.vaultRef as VaultRef)
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
  await revokeOAuthToken(input.vaultRef as VaultRef)
  // TOConline does not expose a public revoke endpoint; the access
  // token will simply expire. Removing the vault ref is sufficient
  // to lock the adapter out.
}

async function loadAccessToken(ref: VaultRef): Promise<string> {
  try {
    const decrypted = await decryptOAuthToken(ref)
    if (!decrypted.accessToken) {
      throw new AdapterError(
        "credentials",
        "TOConline credentials missing access_token"
      )
    }
    return decrypted.accessToken
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

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
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

export const toconlineAdapter: ExpertInvoicingAdapter = {
  manifest: MANIFEST,
  buildAuthUrl,
  connect,
  issueInvoice,
  status,
  disconnect,
}
