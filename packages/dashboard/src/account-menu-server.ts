import { cache } from "react"
import { listUserOrganizations } from "@eleva/auth/organizations"
import { UnauthorizedError } from "@eleva/auth/types"
import { resolveGatewayUrl } from "@eleva/config/env"
import {
  buildAccountMenuModel,
  type AccountMenuModel,
  type AccountMenuWorkspace,
} from "./account-menu-model"
import {
  resolveAdminUrl,
  resolveProductHomeUrl,
} from "./resolve-product-home-url"

/**
 * Every membership of the person, once per request. Layouts that also need
 * the list (the member Space's switcher) call this too instead of querying
 * again.
 */
export const loadUserWorkspaces = cache(
  async (userId: string, currentOrgId: string | null) =>
    listUserOrganizations({ userId, currentOrgId }).catch((err) => {
      if (err instanceof UnauthorizedError) return []
      throw err
    })
)

/** Avatar menu rows for this person, from their memberships. */
export function accountMenuFor(
  workspaces: readonly AccountMenuWorkspace[],
  overrides?: { accountHref?: string; logoutHref?: string }
): AccountMenuModel {
  return buildAccountMenuModel(workspaces, {
    gatewayUrl: resolveGatewayUrl(),
    adminUrl: resolveAdminUrl(),
    homeUrlFor: (workspace) =>
      resolveProductHomeUrl({
        orgSlug: workspace.orgSlug,
        productLabel: workspace.productLabel,
        orgType: workspace.orgType,
      }),
    ...overrides,
  })
}
