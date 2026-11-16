import { describe, expect, it } from "vitest"
import { isSpacePath, workspaceSlugFromPath } from "./workspace-slug"

describe("workspaceSlugFromPath", () => {
  it("reads the workspace from an org-scoped address", () => {
    expect(workspaceSlugFromPath("/expert/patricia-mota-pt/setup")).toBe(
      "patricia-mota-pt"
    )
    expect(workspaceSlugFromPath("/expert/clinica-mota")).toBe("clinica-mota")
  })

  it("ignores reserved routes and empty paths", () => {
    expect(workspaceSlugFromPath("/account/settings")).toBeNull()
    expect(workspaceSlugFromPath("/dashboard")).toBeNull()
    expect(workspaceSlugFromPath("/")).toBeNull()
    expect(workspaceSlugFromPath(null)).toBeNull()
    expect(workspaceSlugFromPath("/expert")).toBeNull()
    expect(workspaceSlugFromPath("/expert/settings")).toBeNull()
  })
})

describe("isSpacePath", () => {
  it("matches /space and its pages only", () => {
    expect(isSpacePath("/space")).toBe(true)
    expect(isSpacePath("/space/sessions?tab=past")).toBe(true)
    expect(isSpacePath("/spaces")).toBe(false)
    expect(isSpacePath("/space-3d4f155f88c8")).toBe(false)
    expect(isSpacePath(null)).toBe(false)
  })

  it("names no workspace slug in the address", () => {
    expect(workspaceSlugFromPath("/space/sessions")).toBeNull()
  })
})
