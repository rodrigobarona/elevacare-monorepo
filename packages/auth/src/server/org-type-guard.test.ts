import { describe, expect, it } from "vitest"
import {
  CreateOrganizationRequestSchema,
  UpdateEventTypeRequestSchema,
} from "@eleva/api-client"
import {
  assertCreatableOrgType,
  assertOrgTypeUnchanged,
} from "./org-type-guard"

describe("assertCreatableOrgType", () => {
  it("rejects staff organizations", () => {
    expect(() => assertCreatableOrgType({ type: "staff" })).toThrow(
      /cannot be created/
    )
  })

  it.each(["personal", "expert", "team", "academy", undefined])(
    "allows %s",
    (type) => {
      expect(() => assertCreatableOrgType({ type })).not.toThrow()
    }
  )
})

describe("assertOrgTypeUnchanged", () => {
  it("rejects any update that carries a type", () => {
    expect(() => assertOrgTypeUnchanged({ type: "staff" })).toThrow(
      /cannot be changed/
    )
    expect(() => assertOrgTypeUnchanged({ type: "expert" })).toThrow()
  })

  it("allows updates without a type", () => {
    expect(() => assertOrgTypeUnchanged({ name: "Clinic" })).not.toThrow()
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
