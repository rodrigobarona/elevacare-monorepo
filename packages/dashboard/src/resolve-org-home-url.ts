import type { ProductLabel } from "@eleva/auth/types"
import { resolveProductHomeUrl } from "./resolve-product-home-url"

export function resolveOrgHomeUrl(input: {
  orgSlug: string
  productLabel: ProductLabel | string
  orgType?: string | null
}): string {
  return resolveProductHomeUrl({
    orgSlug: input.orgSlug,
    productLabel: input.productLabel as ProductLabel,
    orgType: input.orgType,
  })
}
