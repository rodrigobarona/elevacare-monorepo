import {
  manualAdapter,
  moloniAdapter,
  toconlineAdapter,
} from "./adapters/index"
import type { ExpertInvoicingAdapter, InvoicingProviderSlug } from "./types"

/**
 * Tier 2 adapter registry.
 *
 * Adding a new adapter (P2: InvoiceXpress, Vendus; P3: Primavera;
 * Phase-2: Holded, FacturaDirecta):
 *
 *   1. Create `src/adapters/<slug>/index.ts` exporting an
 *      `ExpertInvoicingAdapter` instance.
 *   2. Re-export it from `src/adapters/index.ts`.
 *   3. Add it to the `ADAPTERS` map below.
 *   4. Add `<slug>` to the `InvoicingProviderSlug` enum in
 *      `src/types.ts` AND to the `invoicing_provider` Postgres enum
 *      in `packages/db/src/schema/main/expert-profiles.ts`.
 *   5. Add `ff.invoicing.<slug>` flag to
 *      packages/flags/src/catalog.ts.
 *
 * The dispatcher (S6: `issueExpertServiceInvoice` Vercel Workflow)
 * reads from this registry to fan out invoice issuance.
 */

const ADAPTERS: Readonly<
  Record<InvoicingProviderSlug, ExpertInvoicingAdapter>
> = {
  toconline: toconlineAdapter,
  moloni: moloniAdapter,
  manual: manualAdapter,
}

export function getAdapter(
  slug: InvoicingProviderSlug
): ExpertInvoicingAdapter {
  const adapter = ADAPTERS[slug]
  if (!adapter) {
    throw new Error(`No invoicing adapter registered for slug: ${slug}`)
  }
  return adapter
}

export function listAdapters(): readonly ExpertInvoicingAdapter[] {
  return Object.values(ADAPTERS)
}

export function adapterCountriesIndex(): Record<
  string,
  ExpertInvoicingAdapter[]
> {
  const out: Record<string, ExpertInvoicingAdapter[]> = {}
  for (const adapter of listAdapters()) {
    for (const country of adapter.manifest.countries) {
      out[country] ??= []
      out[country].push(adapter)
    }
  }
  return out
}
