import { describe, expect, it } from "vitest"
import {
  buildAccountMenuModel,
  type AccountMenuWorkspace,
} from "./account-menu-model"

const urls = {
  gatewayUrl: "https://eleva.care/",
  adminUrl: "https://admin.eleva.care",
  homeUrlFor: (w: AccountMenuWorkspace) => `https://eleva.care/${w.orgSlug}`,
}

function ws(
  orgType: AccountMenuWorkspace["orgType"],
  name: string,
  extra: Partial<AccountMenuWorkspace> = {}
): AccountMenuWorkspace {
  const productLabel = (
    {
      personal: "member",
      expert: "expert",
      team: "team_admin",
      academy: "lecturer",
      staff: "staff",
    } as const
  )[orgType]
  return {
    orgId: `${orgType}-${name}`,
    orgSlug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    orgType,
    name,
    productLabel,
    isCurrent: false,
    ...extra,
  }
}

describe("buildAccountMenuModel", () => {
  it("offers to set up a practice when the person only has a Space", () => {
    const model = buildAccountMenuModel(
      [ws("personal", "Patricia's Space", { isCurrent: true })],
      urls
    )
    expect(model.shortcuts).toEqual([
      {
        kind: "offer",
        href: "https://eleva.care/account/workspaces/create/expert",
      },
    ])
    expect(model.staffHref).toBeNull()
    expect(model.helpHref).toBe("https://eleva.care/docs/members")
  })

  it("links straight to the practice from the Space", () => {
    const model = buildAccountMenuModel(
      [
        ws("personal", "Patricia's Space", { isCurrent: true }),
        ws("expert", "Patricia Mota"),
      ],
      urls
    )
    expect(model.shortcuts).toEqual([
      {
        kind: "workspace",
        href: "https://eleva.care/patricia-mota",
        name: "Patricia Mota",
        workspaceKind: "expert",
      },
    ])
  })

  it("links back to the Space from the practice", () => {
    const model = buildAccountMenuModel(
      [
        ws("personal", "Patricia's Space"),
        ws("expert", "Patricia Mota", { isCurrent: true }),
      ],
      urls
    )
    expect(model.shortcuts.map((s) => s.kind)).toEqual(["space"])
    expect(model.helpHref).toBe("https://eleva.care/docs/experts")
  })

  it("collapses many workspaces into one switch row and keeps staff apart", () => {
    const model = buildAccountMenuModel(
      [
        ws("personal", "Patricia's Space"),
        ws("expert", "Patricia Mota", { isCurrent: true }),
        ws("team", "Clinic One"),
        ws("team", "Clinic Two"),
        ws("academy", "Pelvic Academy"),
        ws("staff", "Eleva staff"),
      ],
      urls
    )
    expect(model.shortcuts).toEqual([
      { kind: "space", href: "https://eleva.care/patricia-s-space" },
      {
        kind: "switch",
        href: "https://eleva.care/account/organizations",
        count: 5,
      },
    ])
    expect(model.staffHref).toBe("https://admin.eleva.care")
  })

  it("lists every workspace on the public site, where none is current", () => {
    const model = buildAccountMenuModel(
      [
        ws("academy", "Pelvic Academy"),
        ws("personal", "Ana's Space"),
        ws("expert", "Ana Quick"),
      ],
      urls
    )
    expect(model.shortcuts.map((s) => s.kind)).toEqual([
      "space",
      "workspace",
      "workspace",
    ])
    // Practice before academy.
    expect(
      model.shortcuts.flatMap((s) => (s.kind === "workspace" ? [s.name] : []))
    ).toEqual(["Ana Quick", "Pelvic Academy"])
    expect(model.helpHref).toBe("https://eleva.care/docs")
  })

  it("never offers a practice to someone who already works in a clinic", () => {
    const model = buildAccountMenuModel(
      [ws("personal", "Space", { isCurrent: true }), ws("team", "Clinic One")],
      urls
    )
    expect(model.shortcuts.some((s) => s.kind === "offer")).toBe(false)
  })

  it("hides the staff row inside the staff console", () => {
    const model = buildAccountMenuModel(
      [
        ws("personal", "Space"),
        ws("staff", "Eleva staff", { isCurrent: true }),
      ],
      urls
    )
    expect(model.staffHref).toBeNull()
    expect(model.shortcuts.map((s) => s.kind)).toEqual(["space", "offer"])
  })

  it("uses the account app's own settings link when given", () => {
    const model = buildAccountMenuModel([], {
      ...urls,
      accountHref: "/account/settings",
    })
    expect(model.accountHref).toBe("/account/settings")
    expect(model.logoutHref).toBe("https://eleva.care/logout")
    expect(model.homeHref).toBe("https://eleva.care/home")
  })
})
