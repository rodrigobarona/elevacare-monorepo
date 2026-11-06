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
})

describe("orgUpdateViolation", () => {
  it("rejects any update that carries a type", () => {
    expect(orgUpdateViolation({ type: "staff" })).toMatch(/cannot be changed/)
    expect(orgUpdateViolation({ type: "expert" })).not.toBeNull()
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
