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
 * Moloni Tier 2 adapter — stub.
 *
 * The full implementation lands when MOLONI_CLIENT_ID /
 * MOLONI_CLIENT_SECRET are provisioned (post-S2-A). The shape is
 * frozen so the registry can advertise Moloni in the onboarding UI
 * but the adapter throws `AdapterError('fatal')` if any expert
 * actually picks it before the implementation is filled.
 *
 * `ff.invoicing.moloni` flag should remain OFF until the OAuth flow
 * + invoice issuance ship.
 *
 * Reference: https://www.moloni.pt/dev/
 */

const MANIFEST: AdapterManifest = {
  slug: "moloni",
  displayName: "Moloni",
  countries: ["PT", "ES"],
  installType: "oauth",
  description: {
    en: "Connect your Moloni account to issue patient invoices automatically.",
    pt: "Ligue a sua conta Moloni para emitir faturas aos pacientes automaticamente.",
    es: "Conecte su cuenta Moloni para emitir facturas a los pacientes automáticamente.",
  },
}

async function buildAuthUrl(): Promise<never> {
  throw new AdapterError(
    "fatal",
    "Moloni adapter not yet implemented (S2-A scaffold). Toggle ff.invoicing.moloni when shipping."
  )
}

async function connect(_input: ConnectInput): Promise<ConnectResult> {
  throw new AdapterError(
    "fatal",
    "Moloni adapter not yet implemented (S2-A scaffold)."
  )
}

async function issueInvoice(
  _creds: { vaultRef: string; metadata?: Record<string, unknown> },
  _input: IssueInvoiceInput
): Promise<IssueInvoiceResult> {
  throw new AdapterError(
    "fatal",
    "Moloni adapter not yet implemented (S2-A scaffold)."
  )
}

async function status(): Promise<AdapterStatus> {
  return {
    status: "error",
    message: "Moloni adapter is registered but not yet implemented.",
  }
}

async function disconnect(_input: DisconnectInput): Promise<void> {
  throw new AdapterError(
    "fatal",
    "Moloni adapter not yet implemented (S2-A scaffold)."
  )
}

export const moloniAdapter: ExpertInvoicingAdapter = {
  manifest: MANIFEST,
  buildAuthUrl,
  connect,
  issueInvoice,
  status,
  disconnect,
}
