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
 * Manual / SAF-T adapter.
 *
 * Per ADR-013 Tier 2 design:
 *   - The expert chooses NOT to auto-issue invoices through Eleva.
 *   - Eleva still surfaces booking + patient fiscal data to the
 *     expert dashboard and produces a monthly SAF-T / CSV export.
 *   - `issueInvoice` always succeeds with a sentinel result so the
 *     dispatcher can mark the expert_invoice_log row as
 *     'manual_acknowledged' without paging.
 *
 * The expert's acknowledgment of their legal obligation is recorded
 * during Become-Partner onboarding (step 4) and re-confirmed on
 * yearly renewal — that flow uses `connect()` here with
 * `payload.acknowledged === true`.
 */

const MANIFEST: AdapterManifest = {
  slug: "manual",
  displayName: "Manual / SAF-T export",
  countries: ["PT", "ES"],
  installType: "manual",
  description: {
    en: "Issue invoices in your own software. Eleva exports a monthly SAF-T / CSV bundle of all bookings.",
    pt: "Emita faturas no seu próprio software. A Eleva exporta um pacote mensal SAF-T / CSV de todas as marcações.",
    es: "Emita facturas en su propio software. Eleva exporta un paquete mensual SAF-T / CSV de todas las reservas.",
  },
}

async function connect(input: ConnectInput): Promise<ConnectResult> {
  if (input.payload.acknowledged !== true) {
    throw new AdapterError(
      "validation",
      "Manual invoicing requires explicit legal-obligation acknowledgment"
    )
  }
  return {
    vaultRef: "",
    metadata: {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      userId: input.userId,
      expertProfileId: input.expertProfileId,
    },
  }
}

async function issueInvoice(
  _creds: { vaultRef: string; metadata?: Record<string, unknown> },
  input: IssueInvoiceInput
): Promise<IssueInvoiceResult> {
  const total = input.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice * (1 + l.taxRate / 100),
    0
  )
  const currency = input.lines[0]?.currency ?? "EUR"

  // Sentinel marker: dispatcher sees the externalId prefix and writes
  // the row as 'manual_acknowledged' instead of treating it as a real
  // adapter response.
  return {
    externalId: `manual:${input.bookingId}`,
    invoiceNumber: "MANUAL",
    total,
    currency,
    issuedAt: new Date().toISOString(),
  }
}

async function status(): Promise<AdapterStatus> {
  return { status: "healthy", message: "Manual mode — no provider to check" }
}

async function disconnect(_input: DisconnectInput): Promise<void> {
  // Nothing to revoke — manual mode is record-keeping only.
}

export const manualAdapter: ExpertInvoicingAdapter = {
  manifest: MANIFEST,
  connect,
  issueInvoice,
  status,
  disconnect,
}
