import { beforeEach, describe, expect, it } from "vitest"
import {
  firstNameFromDisplayName,
  syncMarketingContact,
  type SyncMarketingContactDeps,
} from "./sync-marketing-contact"

const USER_ID = "00000000-0000-4000-8000-000000000001"
const ORG_ID = "00000000-0000-4000-8000-000000000002"

describe("firstNameFromDisplayName", () => {
  it("takes only the first token", () => {
    expect(firstNameFromDisplayName("Ana Silva")).toBe("Ana")
    expect(firstNameFromDisplayName("  Ana  ")).toBe("Ana")
    expect(firstNameFromDisplayName(null)).toBeNull()
  })
})

describe("syncMarketingContact", () => {
  let createContact: SyncMarketingContactDeps["createContact"]
  let updateContact: SyncMarketingContactDeps["updateContact"]
  let removeContact: SyncMarketingContactDeps["removeContact"]
  let auditSync: SyncMarketingContactDeps["auditSync"]
  let createCalls: Array<{
    email: string
    firstName: string | null
    locale: "en" | "pt" | "es"
  }>
  let removeCalls: Array<{ email: string }>
  let auditCalls: unknown[]
  let deps: SyncMarketingContactDeps

  beforeEach(() => {
    createCalls = []
    removeCalls = []
    auditCalls = []
    createContact = async (input) => {
      createCalls.push(input)
      return { contactId: "contact_1" }
    }
    updateContact = async () => ({ contactId: "contact_1" })
    removeContact = async (input) => {
      removeCalls.push(input)
      return { contactId: "contact_1" }
    }
    auditSync = async (input) => {
      auditCalls.push(input)
    }
    deps = {
      loadUser: async () => ({
        userId: USER_ID,
        email: "ana@example.com",
        name: "Ana Silva",
        locale: "pt",
      }),
      hasMarketingConsent: async () => ({ granted: true, orgId: ORG_ID }),
      createContact,
      updateContact,
      removeContact,
      auditSync,
    }
  })

  it("upserts name/email/locale only when marketing consent is granted", async () => {
    const result = await syncMarketingContact({ userId: USER_ID }, deps)
    expect(result).toEqual({
      action: "upserted",
      email: "ana@example.com",
      contactId: "contact_1",
      firstName: "Ana",
      locale: "pt",
      orgId: ORG_ID,
    })
    expect(createCalls).toEqual([
      {
        email: "ana@example.com",
        firstName: "Ana",
        locale: "pt",
      },
    ])
    expect(removeCalls).toEqual([])
    expect(auditCalls).toEqual([
      expect.objectContaining({
        orgId: ORG_ID,
        action: "synced",
        payload: expect.objectContaining({
          userId: USER_ID,
          locale: "pt",
          hasFirstName: true,
        }),
      }),
    ])
  })

  it("deletes the Resend contact when marketing consent is withdrawn", async () => {
    deps.hasMarketingConsent = async () => ({ granted: false, orgId: null })
    const result = await syncMarketingContact(
      { userId: USER_ID, orgId: ORG_ID },
      deps
    )
    expect(result).toEqual({
      action: "deleted",
      email: "ana@example.com",
      contactId: "contact_1",
      orgId: ORG_ID,
    })
    expect(createCalls).toEqual([])
    expect(removeCalls).toEqual([{ email: "ana@example.com" }])
    expect(auditCalls).toEqual([
      expect.objectContaining({ action: "deleted", orgId: ORG_ID }),
    ])
  })

  it("skips when the user row is missing", async () => {
    deps.loadUser = async () => null
    const result = await syncMarketingContact({ userId: USER_ID }, deps)
    expect(result).toEqual({ action: "skipped_no_user" })
    expect(createCalls).toEqual([])
    expect(removeCalls).toEqual([])
  })
})
