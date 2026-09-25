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
 *   - "@eleva/accounting/platform-fee-events" — closed-gate invoice outbox
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
  PLATFORM_FEE_BACKFILL_BATCH_SIZE,
  PLATFORM_FEE_BACKFILL_LOOKBACK_MS,
  PLATFORM_FEE_BACKFILL_MIN_AGE_MS,
  PLATFORM_FEE_BACKFILL_WORKFLOW_NAME,
  backfillMissingPlatformFeeInvoices,
  emptyPlatformFeeBackfillResult,
} from "./platform-fee-backfill"
export type { PlatformFeeBackfillResult } from "./platform-fee-backfill"

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
export {
  D09_PLATFORM_FEE_STATUSES,
  decidePlatformFeeRecord,
  elevaFeeSeries,
  isD09PlatformFeeStatus,
  isTerminalPlatformFeeStatus,
  issuePlatformFeeCreditNote,
  issuePlatformFeeInvoice,
  ivaRateBpsFromLookups,
  shouldIssuePlatformFeeCreditNote,
} from "./platform-fee-issue"
export type {
  IssuePlatformFeeCreditNoteResult,
  IssuePlatformFeeInvoiceResult,
  PlatformFeeIssuanceOutcome,
  PlatformFeeIvaLookup,
} from "./platform-fee-issue"
export {
  CLOSED_GATE_INVOICE_EVENT_TYPES,
  CLOSED_GATE_INVOICE_STATUSES,
  CLOSED_GATE_INVOICE_SUBSCRIBERS,
  closedGateInvoiceEventType,
  closedGateInvoiceIdempotencyKey,
  closedGateInvoicePayload,
  emitClosedGateInvoiceDomainEvent,
} from "./platform-fee-events"
export type {
  ClosedGateInvoiceEventRef,
  ClosedGateInvoiceEventType,
  ClosedGateInvoicePayload,
  ClosedGateInvoiceStatus,
} from "./platform-fee-events"
