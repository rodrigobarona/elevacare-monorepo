import type { OrgType, ProductLabel } from "@eleva/auth/types"

/** The fields of a membership the avatar menu needs. */
export interface AccountMenuWorkspace {
  orgId: string
  orgSlug: string
  orgType: OrgType
  name: string
  productLabel: ProductLabel
  isCurrent: boolean
}

export type WorkspaceKind = "expert" | "team" | "academy"

export type AccountMenuShortcut =
  | { kind: "space"; href: string }
  | {
      kind: "workspace"
      href: string
      name: string
      workspaceKind: WorkspaceKind
    }
  | { kind: "switch"; href: string; count: number }
  | { kind: "offer"; href: string }

/** Everything the avatar menu shows besides the person: serializable. */
export interface AccountMenuModel {
  shortcuts: AccountMenuShortcut[]
  /** Staff console URL, only for people with a staff membership who are elsewhere. */
  staffHref: string | null
  accountHref: string
  helpHref: string
  homeHref: string
  logoutHref: string
}

export interface AccountMenuUrls {
  /** Absolute gateway origin, e.g. https://eleva.care */
  gatewayUrl: string
  /** Staff console origin, e.g. https://admin.eleva.care */
  adminUrl: string
  /** Absolute home URL of a workspace (its app). */
  homeUrlFor: (workspace: AccountMenuWorkspace) => string
  /** Overrides for apps that serve these pages themselves. */
  accountHref?: string
  logoutHref?: string
}

/** Above this many other workspaces, one "Switch workspace" row replaces the list. */
const MAX_DIRECT_SHORTCUTS = 2

const KIND_ORDER: Record<WorkspaceKind, number> = {
  expert: 0,
  team: 1,
  academy: 2,
}

function workspaceKind(orgType: OrgType): WorkspaceKind | null {
  if (orgType === "expert" || orgType === "team" || orgType === "academy") {
    return orgType
  }
  return null
}

/** Help centre section for the workspace the person is in. */
function helpPath(current: AccountMenuWorkspace | undefined): string {
  switch (current?.productLabel) {
    case "member":
      return "/docs/members"
    case "expert":
      return "/docs/experts"
    case "team_admin":
      return "/docs/clinics"
    default:
      return "/docs"
  }
}

/**
 * Decides the avatar menu's workspace rows:
 *
 * - Only a Space: "Your Space" (when elsewhere) plus "Offer sessions on Eleva".
 * - One or two other workspaces: a direct row for each.
 * - More: "Your Space" (when elsewhere) and one "Switch workspace" row.
 *
 * Staff memberships never appear as a workspace; they become the separate
 * staff row, shown only to people who have one.
 */
export function buildAccountMenuModel(
  workspaces: readonly AccountMenuWorkspace[],
  urls: AccountMenuUrls
): AccountMenuModel {
  const gateway = urls.gatewayUrl.replace(/\/$/, "")
  const staff = workspaces.find((w) => w.orgType === "staff")
  const visible = workspaces.filter((w) => w.orgType !== "staff")
  const current = visible.find((w) => w.isCurrent)
  const space = visible.find((w) => w.orgType === "personal")
  const work = visible
    .map((w) => ({ w, kind: workspaceKind(w.orgType) }))
    .filter(
      (entry): entry is { w: AccountMenuWorkspace; kind: WorkspaceKind } =>
        entry.kind !== null
    )
    .sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        a.w.name.localeCompare(b.w.name)
    )

  const shortcuts: AccountMenuShortcut[] = []
  if (space && !space.isCurrent) {
    shortcuts.push({ kind: "space", href: urls.homeUrlFor(space) })
  }

  const otherWork = work.filter(({ w }) => !w.isCurrent)
  if (otherWork.length > MAX_DIRECT_SHORTCUTS) {
    shortcuts.push({
      kind: "switch",
      href: `${gateway}/account/organizations`,
      count: visible.length,
    })
  } else {
    for (const { w, kind } of otherWork) {
      shortcuts.push({
        kind: "workspace",
        href: urls.homeUrlFor(w),
        name: w.name,
        workspaceKind: kind,
      })
    }
  }

  if (work.length === 0) {
    shortcuts.push({
      kind: "offer",
      href: `${gateway}/account/workspaces/create/expert`,
    })
  }

  return {
    shortcuts,
    // Hidden inside the staff console itself.
    staffHref:
      staff && !staff.isCurrent ? urls.adminUrl.replace(/\/$/, "") : null,
    accountHref: urls.accountHref ?? `${gateway}/account/settings`,
    helpHref: `${gateway}${helpPath(current)}`,
    homeHref: `${gateway}/home`,
    logoutHref: urls.logoutHref ?? `${gateway}/logout`,
  }
}
