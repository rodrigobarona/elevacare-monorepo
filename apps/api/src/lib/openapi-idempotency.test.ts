import { describe, expect, it } from "vitest"
import { generateOpenApiSpec } from "./openapi"

const IDEMPOTENT_OPERATIONS = [
  "/bookings/reserve",
  "/bookings/confirm",
  "/payments/intent",
  "/payments/{bookingPaymentId}/refund",
] as const

describe("OpenAPI Idempotency-Key", () => {
  const paths = generateOpenApiSpec().paths ?? {}

  it.each(IDEMPOTENT_OPERATIONS)("documents the header on POST %s", (route) => {
    const parameters = paths[route]?.post?.parameters ?? []
    const header = parameters.find(
      (parameter) =>
        "name" in parameter &&
        parameter.in === "header" &&
        parameter.name === "Idempotency-Key"
    )
    expect(header).toBeDefined()
    expect(header).not.toMatchObject({ required: true })
  })
})
