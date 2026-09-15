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
export type {
  IssueExpertServiceInvoiceInput,
  IssueExpertServiceInvoiceResult,
} from "./dispatch"

export {
  ACCOUNTING_OAUTH_STATE_TTL_MS,
  createAccountingOAuthNonce,
  encodeAccountingOAuthState,
  parseAccountingOAuthState,
  storedAccountingOAuthNonce,
  verifyStoredAccountingOAuthNonce,
} from "./oauth-state"
