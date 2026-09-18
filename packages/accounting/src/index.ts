/**
 * @eleva/accounting — invoicing domain (ADR-013).
 *
 * Owns Tier 1 Eleva→expert platform-fee ledgers, conservative IVA
 * classification for platform fees, Tier 2 expert→member adapters,
 * reconciliation, and ALL provider SDK access (TOConline, Moloni, ...).
 * Other packages MUST NOT import provider SDKs directly — boundary lint
 * enforces.
 *
 * Sub-entrypoints:
 *   - "@eleva/accounting"          — types + AdapterError + IVA classifier
 *   - "@eleva/accounting/registry" — getAdapter / listAdapters
 *   - "@eleva/accounting/adapters" — TOConline lookups including GET /taxes
 */

export {
  AdapterError,
  type AdapterManifest,
  type AdapterStatus,
  type AdapterStatusResult,
  type ConnectInput,
  type ConnectResult,
  type DisconnectInput,
  type ExpertInvoicingAdapter,
  type IssueInvoiceInput,
  type IssueInvoiceResult,
  type RotatedAdapterCredentials,
  InvoicingProviderSlug,
} from "./types"

export { getAdapter, listAdapters, adapterCountriesIndex } from "./registry"
export {
  issueExpertServiceInvoice,
  buildMemberInvoiceInput,
  invoiceStatusFromAdapterError,
} from "./dispatch"
export {
  persistExpertIntegrationCredentials,
  probeExpertInvoicingStatus,
  toPublicAdapterStatus,
} from "./persist-credentials"
export {
  ExpertInvoiceOpError,
  canMarkInvoiceManual,
  canRetryInvoice,
  isExpertInvoiceOpError,
  listExpertInvoices,
  markExpertInvoiceManual,
  retryExpertInvoice,
  toPublicExpertInvoice,
} from "./invoice-ops"
export type {
  IssueExpertServiceInvoiceInput,
  IssueExpertServiceInvoiceResult,
} from "./dispatch"
export type {
  ExpertInvoiceOpCode,
  ExpertInvoiceStatus,
  PublicExpertInvoice,
} from "./invoice-ops"
export {
  INVOICING_RETRY_BATCH_SIZE,
  INVOICING_RETRY_MAX_ATTEMPTS,
  INVOICING_RETRY_MIN_AGE_MS,
  INVOICING_RETRY_WORKFLOW_NAME,
  classifyFailedInvoiceForRetry,
  classifyRetryResult,
  retryFailedExpertInvoices,
} from "./invoicing-retry"
export type {
  FailedInvoiceRetryAction,
  InvoicingRetryResult,
} from "./invoicing-retry"

export {
  ACCOUNTING_OAUTH_STATE_TTL_MS,
  createAccountingOAuthNonce,
  encodeAccountingOAuthState,
  parseAccountingOAuthState,
  storedAccountingOAuthNonce,
  verifyStoredAccountingOAuthNonce,
} from "./oauth-state"
export {
  SAFT_EXPORT_MAX_ROWS,
  SAFT_SIGNED_URL_TTL_SECONDS,
  SaftExportError,
  buildSaftCsv,
  buildSaftDownloadUrl,
  buildSaftXmlSkeleton,
  isIssuedSaftInvoice,
  isSaftExportError,
  listSaftExportRows,
  parseSaftMonth,
  saftBlobPathname,
  saftMonthRange,
  signSaftDownloadToken,
  verifySaftDownloadToken,
} from "./saft-export"
export type { SaftInvoiceRow, SaftMonthRange } from "./saft-export"
export {
  RECONCILIATION_MISMATCH_THRESHOLD_BPS,
  RECONCILIATION_WORKFLOW_NAME,
  getAccountingReconciliation,
  mismatchBps,
  netCents,
  netFeeCents,
  previousLisbonMonth,
  runStripeToconlineReconciliation,
  summarizeReconciliation,
} from "./reconciliation"
export type {
  InvoiceLedgerRow,
  PaymentLedgerRow,
  PublicAccountingReconciliationRun,
  ReconciliationSummary,
} from "./reconciliation"
export {
  EU_MEMBER_ISO_ALPHA2,
  VIES_CACHE_TTL_MS,
  classifyIvaRegime,
  createViesCache,
  taxCountryRegionFromCountry,
  territoryFromCountry,
} from "./core/iva-matrix"
export type {
  ClassifyIvaInput,
  ExpertTerritory,
  IvaDecision,
  IvaRegime,
  ViesLookup,
  ViesLookupResult,
  ViesStatus,
} from "./core/iva-matrix"
export {
  PLATFORM_FEE_INVOICE_PAGE_SIZE,
  listPlatformFeeInvoices,
  toPublicPlatformFeeInvoice,
} from "./platform-fee-invoices"
export type {
  PlatformFeeAtStatus,
  PlatformFeeInvoiceStatus,
  PlatformFeeIvaRegime,
  PublicPlatformFeeInvoice,
} from "./platform-fee-invoices"
