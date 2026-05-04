/**
 * @eleva/accounting — Tier 2 expert→patient invoicing adapter
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
  type ConnectInput,
  type ConnectResult,
  type DisconnectInput,
  type ExpertInvoicingAdapter,
  type IssueInvoiceInput,
  type IssueInvoiceResult,
  InvoicingProviderSlug,
} from "./types"

export { getAdapter, listAdapters, adapterCountriesIndex } from "./registry"
