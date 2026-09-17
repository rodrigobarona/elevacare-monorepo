/**
 * @eleva/accounting — Tier 2 expert→member invoicing adapter
 * registry. See ADR-013.
 *
 * Owns ALL provider SDK access (TOConline, Moloni, ...). Other
 * packages MUST NOT import provider SDKs directly — boundary lint
 * enforces.
 *
 * Sub-entrypoints:
 *   - "@eleva/accounting"          — types + AdapterError
 *   - "@eleva/accounting/registry" — getAdapter / listAdapters
 *   - "@eleva/accounting/adapters" — direct adapter exports (tests)
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
