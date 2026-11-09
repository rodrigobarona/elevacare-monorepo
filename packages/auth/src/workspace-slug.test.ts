import { describe, expect, it } from "vitest"
import { workspaceSlugFromPath } from "./workspace-slug"

describe("workspaceSlugFromPath", () => {
  it("reads the workspace from an org-scoped address", () => {
    expect(workspaceSlugFromPath("/patricia-mota-pt/team/setup")).toBe(
      "patricia-mota-pt"
    )
    expect(workspaceSlugFromPath("/space-3d4f155f88c8/sessions?x=1")).toBe(
      "space-3d4f155f88c8"
    )
  })

  it("ignores reserved routes and empty paths", () => {
    expect(workspaceSlugFromPath("/account/settings")).toBeNull()
    expect(workspaceSlugFromPath("/dashboard")).toBeNull()
    expect(workspaceSlugFromPath("/")).toBeNull()
    expect(workspaceSlugFromPath(null)).toBeNull()
  })
})
