import { z } from "zod"

/**
 * Tier 2 — Expert → Patient invoicing adapter contract.
 *
 * Per ADR-013, every supported invoicing provider implements this
 * interface. Adapters live under
 * `packages/accounting/src/adapters/<slug>/` and are registered in
 * `registry.ts`.
 *
 * Design rules:
 *   - All credentials encrypted via `@eleva/encryption`. Adapters
 *     never see plain tokens; the framework decrypts → calls →
 *     re-encrypts on refresh.
 *   - Adapters are purely functional with respect to their inputs;
 *     persistence (`expert_integration_credentials`,
 *     `expert_invoice_log`) lives in the dispatcher layer.
 *   - Errors are typed `AdapterError` so the dispatcher can map to
 *     DLQ vs retryable vs fatal.
 */

export const InvoicingProviderSlug = z.enum(["toconline", "moloni", "manual"])
export type InvoicingProviderSlug = z.infer<typeof InvoicingProviderSlug>

/** Adapter manifest — descriptive metadata surfaced in the expert UI. */
export const AdapterManifest = z.object({
  slug: InvoicingProviderSlug,
  displayName: z.string(),
  /** Country codes where the adapter is offered. ISO-3166-1 alpha-2. */
  countries: z.array(z.string().length(2)),
  /** OAuth (browser redirect) vs API key (form input) vs none (manual). */
  installType: z.enum(["oauth", "api_key", "manual"]),
  /** Marketing description (en/pt/es) shown on the invoicing setup step. */
  description: z.object({
    en: z.string(),
    pt: z.string(),
    es: z.string(),
  }),
})
export type AdapterManifest = z.infer<typeof AdapterManifest>

/**
 * Map an accounting AdapterManifest to the shared IntegrationManifest
 * shape used by the unified integration registry.
 */
export function toIntegrationManifest(manifest: AdapterManifest): {
  slug: string
  category: "invoicing"
  displayName: string
  icon: string
  publisher: string
  countries: string[]
  connectType: "oauth" | "api_key" | "manual"
  description: { en: string; pt: string; es: string }
} {
  return {
    slug: manifest.slug,
    category: "invoicing",
    displayName: manifest.displayName,
    icon: "file-text",
    publisher: manifest.displayName,
    countries: manifest.countries,
    connectType: manifest.installType,
    description: manifest.description,
  }
}

/** Result of `connect()` after the OAuth callback (or manual ack). */
export const ConnectResult = z.object({
  /**
   * Vault ref returned by `encryptOAuthToken()`. Stored in
   * `expert_integration_credentials.vault_ref`. For 'manual' adapter
   * this is empty string.
   */
  vaultRef: z.string(),
  /** Adapter-specific identifiers (account ID, series ID, etc.). */
  metadata: z.record(z.unknown()).optional(),
  /** ISO timestamp of the underlying token expiry, if known. */
  expiresAt: z.string().datetime().optional(),
})
export type ConnectResult = z.infer<typeof ConnectResult>

/** Input passed to `issueInvoice()` — built from booking + payment data. */
export const IssueInvoiceInput = z.object({
  /** Eleva booking ID — used for idempotency. */
  bookingId: z.string().uuid(),
  /** Eleva expert profile issuing the invoice. */
  expertProfileId: z.string().uuid(),
  /** Patient billing details (resolved by dispatcher). */
  patient: z.object({
    /**
     * NIF / VAT number / fiscal ID. Empty string for "consumidor final".
     * Adapters that require a NIF will fail with `'fiscal-id-missing'`.
     */
    fiscalId: z.string(),
    /** Display name (business name or person name). */
    name: z.string(),
    /** Optional billing address (required for cross-border). */
    address: z.string().optional(),
    /** ISO-3166-1 alpha-2. */
    country: z.string().length(2),
    email: z.string().email().optional(),
  }),
  /** One line per service rendered. */
  lines: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        /** Tax rate as percentage (23 for PT IVA). */
        taxRate: z.number().nonnegative(),
        /** Currency in ISO 4217 (default 'EUR'). */
        currency: z.string().length(3).default("EUR"),
      })
    )
    .min(1),
  /** Issue date (ISO date string YYYY-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Free-form notes printed on the invoice. */
  notes: z.string().optional(),
})
export type IssueInvoiceInput = z.infer<typeof IssueInvoiceInput>

export const IssueInvoiceResult = z.object({
  /** Adapter-side invoice ID (e.g., TOConline doc id). */
  externalId: z.string(),
  /** Final invoice number (e.g., 'FT 2026/0042'). */
  invoiceNumber: z.string(),
  /** Public URL or signed PDF URL the patient receives. */
  pdfUrl: z.string().url().optional(),
  /** Total invoiced amount (sum of lines + tax). */
  total: z.number(),
  /** Currency. */
  currency: z.string().length(3),
  /** ISO timestamp the adapter recorded the invoice as issued. */
  issuedAt: z.string().datetime(),
})
export type IssueInvoiceResult = z.infer<typeof IssueInvoiceResult>

export const AdapterStatus = z.object({
  status: z.enum(["healthy", "expired", "rate_limited", "error"]),
  /** Optional informational message for admin UI. */
  message: z.string().optional(),
  /** When the next refresh / reconnection should be attempted. */
  retryAt: z.string().datetime().optional(),
})
export type AdapterStatus = z.infer<typeof AdapterStatus>

/**
 * Adapter error shape mapped to dispatcher behavior:
 *   retryable     -> exponential backoff retry
 *   credentials   -> mark credential expired, notify expert
 *   validation    -> bubble to caller, do not retry
 *   provider      -> non-2xx from provider, retryable up to 5x
 *   fatal         -> hard fail, DLQ + page operator
 */
export class AdapterError extends Error {
  readonly kind:
    | "retryable"
    | "credentials"
    | "validation"
    | "provider"
    | "fatal"
  readonly providerCode?: string

  constructor(
    kind: AdapterError["kind"],
    message: string,
    providerCode?: string
  ) {
    super(message)
    this.kind = kind
    this.providerCode = providerCode
    this.name = "AdapterError"
  }
}

/**
 * Connect input — what the dispatcher hands the adapter after the
 * OAuth callback resolves (or for 'manual', a marker payload).
 */
export interface ConnectInput {
  /** Eleva expert profile being connected. */
  expertProfileId: string
  /** Eleva org id (tenant scope). */
  orgId: string
  /** Eleva user id (the human running through onboarding). */
  userId: string
  /**
   * Adapter-specific bag from the OAuth callback. For TOConline this
   * carries `code` + `code_verifier`; for Moloni `code`; for manual
   * an `acknowledged: true` flag.
   */
  payload: Record<string, unknown>
}

/**
 * Disconnect input — used when the expert revokes or the dispatcher
 * sees a permanent credential error.
 */
export interface DisconnectInput {
  vaultRef: string
  metadata?: Record<string, unknown>
}

/**
 * The contract every Tier 2 adapter implements.
 *
 * Adapters MUST be stateless: any internal cache lives behind their
 * own module boundary. The framework owns persistence
 * (expert_integration_credentials, expert_invoice_log).
 */
export interface ExpertInvoicingAdapter {
  readonly manifest: AdapterManifest
  /**
   * Build the OAuth authorization URL the browser redirects to.
   * Returns null for non-OAuth adapters (manual). For PKCE adapters
   * the verifier is returned so the dispatcher can persist it
   * server-side and replay on callback.
   */
  buildAuthUrl?: (input: {
    state: string
    expertProfileId: string
  }) => Promise<{ url: string; codeVerifier?: string } | null>
  connect: (input: ConnectInput) => Promise<ConnectResult>
  issueInvoice: (
    creds: { vaultRef: string; metadata?: Record<string, unknown> },
    input: IssueInvoiceInput
  ) => Promise<IssueInvoiceResult>
  status: (creds: {
    vaultRef: string
    metadata?: Record<string, unknown>
  }) => Promise<AdapterStatus>
  disconnect: (input: DisconnectInput) => Promise<void>
}
