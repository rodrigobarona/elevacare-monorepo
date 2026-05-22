import type { OrgType, ProductLabel } from "@eleva/auth/types"
import { resolveProductHomeUrl } from "./resolve-product-home-url"

export function resolveOrgHomeUrl(input: {
  orgSlug: string
  productLabel: ProductLabel
  orgType?: OrgType | null
}): string {
  return resolveProductHomeUrl({
    orgSlug: input.orgSlug,
    productLabel: input.productLabel,
    orgType: input.orgType,
  })
}
