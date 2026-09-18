import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  CLOSED_GATE_INVOICE_NOTIFICATION_KINDS,
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_VALUES,
  ORG_SCOPED_NOTIFICATION_KINDS,
  USER_SCOPED_NOTIFICATION_KINDS,
} from "./kinds"

function quotedKindsFromCheck(sql: string, constraint: string): string[] {
  const start = sql.indexOf(`ADD CONSTRAINT "${constraint}"`)
  expect(start).toBeGreaterThan(-1)
  const checkIdx = sql.indexOf("CHECK (", start)
  const end = sql.indexOf(");", checkIdx)
  const body = sql.slice(checkIdx, end)
  const kinds: string[] = []
  for (const match of body.matchAll(/'([a-z0-9._]+)'/g)) {
    const kind = match[1]
    if (kind) {
      kinds.push(kind)
    }
  }
  return kinds
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

describe("NOTIFICATION_KINDS", () => {
  it("keeps closed-gate invoice kinds email-only and org-scoped", () => {
    for (const kind of Object.keys(
      CLOSED_GATE_INVOICE_NOTIFICATION_KINDS
    ) as Array<keyof typeof CLOSED_GATE_INVOICE_NOTIFICATION_KINDS>) {
      expect(NOTIFICATION_KINDS[kind]).toEqual(
        CLOSED_GATE_INVOICE_NOTIFICATION_KINDS[kind]
      )
      expect(NOTIFICATION_KINDS[kind].channels).toEqual(["email"])
      expect(NOTIFICATION_KINDS[kind].scope).toBe("org")
      expect(NOTIFICATION_KINDS[kind].category).toBe("payment")
    }
  })

  it("does not register invoice.issued or invoice.failed", () => {
    expect("invoice.issued" in NOTIFICATION_KINDS).toBe(false)
    expect("invoice.failed" in NOTIFICATION_KINDS).toBe(false)
    expect("invoice.credited" in NOTIFICATION_KINDS).toBe(false)
  })

  it("marks the 1h reminder and payment.failed as urgent", () => {
    expect(NOTIFICATION_KINDS["booking.reminder_1h"].urgency).toBe("urgent")
    expect(NOTIFICATION_KINDS["payment.failed"].urgency).toBe("urgent")
    expect(NOTIFICATION_KINDS["booking.reminder_24h"].urgency).toBe("normal")
  })

  it("requires org scope for booking and payment kinds", () => {
    expect(NOTIFICATION_KINDS["booking.confirmed"].scope).toBe("org")
    expect(NOTIFICATION_KINDS["payment.receipt"].scope).toBe("org")
    expect(NOTIFICATION_KINDS["payout.paid"].scope).toBe("org")
  })

  it("keeps auth kinds user-scoped except org invitations", () => {
    expect(NOTIFICATION_KINDS["auth.magic_link"].scope).toBe("user")
    expect(NOTIFICATION_KINDS["auth.verify_email"].scope).toBe("user")
    expect(NOTIFICATION_KINDS["auth.reset_password"].scope).toBe("user")
    expect(NOTIFICATION_KINDS["auth.two_factor_otp"].scope).toBe("user")
    expect(NOTIFICATION_KINDS["auth.org_invitation"].scope).toBe("org")
    expect(NOTIFICATION_KINDS["auth.magic_link"].channels).toEqual(["email"])
    expect(USER_SCOPED_NOTIFICATION_KINDS).toEqual([
      "auth.magic_link",
      "auth.verify_email",
      "auth.reset_password",
      "auth.two_factor_otp",
    ])
    expect(ORG_SCOPED_NOTIFICATION_KINDS).not.toContain("auth.magic_link")
    expect(ORG_SCOPED_NOTIFICATION_KINDS).toContain("auth.org_invitation")
  })

  it("keeps SQL CHECK kinds in lockstep with NOTIFICATION_KINDS", () => {
    const sql = readFileSync(
      resolve(
        import.meta.dirname,
        "../../db/src/migrations/main/0042_notifications.sql"
      ),
      "utf8"
    )
    const expected = sortedStrings(NOTIFICATION_KIND_VALUES)
    expect(
      sortedStrings(quotedKindsFromCheck(sql, "notifications_kind"))
    ).toEqual(expected)
    expect(
      sortedStrings(quotedKindsFromCheck(sql, "notification_deliveries_kind"))
    ).toEqual(expected)
    const userScoped = quotedKindsFromCheck(sql, "notifications_kind_org_scope")
    expect(sortedStrings([...new Set(userScoped)])).toEqual(
      sortedStrings(USER_SCOPED_NOTIFICATION_KINDS)
    )
  })
})
