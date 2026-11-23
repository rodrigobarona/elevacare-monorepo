import { describe, expect, it } from "vitest"
import {
  CreateOrganizationRequestSchema,
  UpdateEventTypeRequestSchema,
} from "@eleva/api-client"
import { orgCreateViolation, orgUpdateViolation } from "./org-type-guard"

describe("orgCreateViolation", () => {
  it("rejects staff organizations", () => {
    expect(orgCreateViolation({ type: "staff" })).toMatch(/cannot be created/)
  })

  it.each(["personal", "expert", "team", "academy", undefined])(
    "allows %s",
    (type) => {
      expect(orgCreateViolation({ type })).toBeNull()
    }
  )

  it.each([
    "events",
    "appointments",
    "unsubscribe",
    "sign-in",
    "dashboard",
    "account",
    "pt",
    // As typed: the word is the same word.
    "Events",
    "DASHBOARD",
  ])("refuses the address %s, which Eleva keeps for its own pages", (slug) => {
    expect(orgCreateViolation({ type: "expert", slug })).toMatch(
      /kept for Eleva's own pages/
    )
    expect(orgCreateViolation({ type: "team", slug })).not.toBeNull()
  })

  it.each(["fisiomota", "eventsclub", "clinica-lumen", "ana-s-space"])(
    "allows the address %s",
    (slug) => {
      expect(orgCreateViolation({ type: "expert", slug })).toBeNull()
    }
  )

  it("says nothing about an address that is not text", () => {
    expect(orgCreateViolation({ type: "expert", slug: 7 })).toBeNull()
    expect(orgCreateViolation({ type: "expert" })).toBeNull()
  })
})

describe("orgUpdateViolation", () => {
  it("rejects any update that carries a type", () => {
    expect(orgUpdateViolation({ type: "staff" })).toMatch(/cannot be changed/)
    expect(orgUpdateViolation({ type: "expert" })).not.toBeNull()
  })

  it("rejects any update that carries a slug (the held username)", () => {
    expect(orgUpdateViolation({ slug: "new-name" })).toMatch(
      /address cannot be changed/
    )
  })

  it("allows updates without a type", () => {
    expect(orgUpdateViolation({ name: "Clinic" })).toBeNull()
  })
})

describe("CreateOrganizationRequestSchema", () => {
  it("does not accept staff as a self-service type", () => {
    expect(
      CreateOrganizationRequestSchema.safeParse({ name: "Ops", type: "staff" })
        .success
    ).toBe(false)
  })
})

describe("UpdateEventTypeRequestSchema", () => {
  it("rejects published so offers only go live through the publish gates", () => {
    expect(
      UpdateEventTypeRequestSchema.safeParse({ published: true }).success
    ).toBe(false)
    expect(
      UpdateEventTypeRequestSchema.safeParse({ slug: "visit" }).success
    ).toBe(true)
  })
})
