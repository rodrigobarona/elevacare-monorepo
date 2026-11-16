import type { OrgType, ProductLabel } from "@eleva/auth/types"
import { resolveOrgHomeUrl } from "./resolve-org-home-url"

/** The expert practice the person already has (one per person, ADR-026). */
export interface ExistingPractice {
  name: string
  href: string
}

interface WorkspaceLike {
  orgSlug: string
  orgType: OrgType | string
  name: string
  productLabel: ProductLabel
  membershipRole: string
}

/**
 * The practice the person runs, from their workspace list: an `expert`
 * organization where they are the owner or an admin. Clinic seats are `team`
 * organizations and never count.
 */
export function findExistingPractice(
  workspaces: readonly WorkspaceLike[]
): ExistingPractice | null {
  const practice = workspaces.find(
    (w) =>
      w.orgType === "expert" &&
      w.productLabel === "expert" &&
      (w.membershipRole === "admin" || w.membershipRole === "owner")
  )
  if (!practice) return null
  return {
    name: practice.name,
    href: resolveOrgHomeUrl({
      orgSlug: practice.orgSlug,
      productLabel: practice.productLabel,
      orgType: practice.orgType as OrgType,
    }),
  }
}
