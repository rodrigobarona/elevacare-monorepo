import { describe, expect, it } from "vitest"
import { pendingFromMarkers } from "./apply-migrations"

describe("pendingFromMarkers", () => {
  it("starts pending at the first failed object check", () => {
    expect(
      pendingFromMarkers(
        [
          "0000_a",
          "0020_add_academy_org_type",
          "0021_expert_profiles_user_org_unique",
          "0022_better_auth_identity",
        ],
        {
          "0000_a": null,
          "0020_add_academy_org_type": true,
          "0021_expert_profiles_user_org_unique": false,
          "0022_better_auth_identity": false,
        }
      )
    ).toBe(2)
  })

  it("treats files after the last passing check as pending", () => {
    expect(
      pendingFromMarkers(["0000_a", "0022_better_auth_identity", "0023_next"], {
        "0000_a": null,
        "0022_better_auth_identity": true,
        "0023_next": null,
      })
    ).toBe(2)
  })

  it("records every file when the folder has no object checks", () => {
    expect(
      pendingFromMarkers(["0000_watery_cardiac"], {
        "0000_watery_cardiac": null,
      })
    ).toBe(1)
  })
})
