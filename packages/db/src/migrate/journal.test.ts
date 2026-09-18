import { describe, expect, it } from "vitest"
import { resolve } from "node:path"
import {
  hashMigrationSql,
  isAlreadyAppliedError,
  readPreparedMigrations,
  splitMigrationSql,
} from "./journal"

describe("migration journal helpers", () => {
  it("splits on drizzle breakpoints and drops empty chunks", () => {
    expect(
      splitMigrationSql(
        "CREATE TABLE a();\n--> statement-breakpoint\n\n--> statement-breakpoint\nCREATE TABLE b();"
      )
    ).toEqual(["CREATE TABLE a();", "CREATE TABLE b();"])
  })

  it("hashes the full SQL file the same way drizzle-orm does", () => {
    expect(hashMigrationSql("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
  })

  it("treats duplicate-object SQLSTATEs as already applied", () => {
    expect(
      isAlreadyAppliedError({ code: "42710", message: "type already exists" })
    ).toBe(true)
    expect(
      isAlreadyAppliedError({ code: "42P01", message: "undefined table" })
    ).toBe(false)
    expect(
      isAlreadyAppliedError({ message: "relation users already exists" })
    ).toBe(true)
  })

  it("reads the main journal including the latest migration", () => {
    const folder = resolve(import.meta.dirname, "../migrations/main")
    const migrations = readPreparedMigrations(folder)
    const last = migrations.at(-1)
    expect(last?.tag).toBe("0041_platform_fee_credit_note_refund")
    expect(last?.statements.length).toBeGreaterThan(0)
    expect(last?.hash).toHaveLength(64)
    const creditNoteRefundSql = last?.statements.join("\n") ?? ""
    expect(creditNoteRefundSql).toContain("booking_refund_id")
    expect(creditNoteRefundSql).toContain(
      "platform_fee_credit_notes_refund_key"
    )
    const blockedSkipped = migrations.find(
      (m) => m.tag === "0040_platform_fee_invoice_blocked_skipped"
    )
    expect(blockedSkipped?.statements.length).toBeGreaterThan(0)
    const blockedSkippedSql = blockedSkipped?.statements.join("\n") ?? ""
    expect(blockedSkippedSql).toContain("platform_fee_invoice_status")
    expect(blockedSkippedSql).toContain("'blocked'")
    expect(blockedSkippedSql).toContain("'skipped'")
    expect(blockedSkippedSql).toContain("BEFORE 'dead_lettered'")
    const platformFee = migrations.find(
      (m) => m.tag === "0039_platform_fee_invoices"
    )
    expect(platformFee?.statements.length).toBeGreaterThan(0)
    expect(platformFee?.hash).toHaveLength(64)
    const platformFeeSql = platformFee?.statements.join("\n") ?? ""
    expect(platformFeeSql).toContain("platform_fee_invoices")
    expect(platformFeeSql).toContain("platform_fee_credit_notes")
    expect(platformFeeSql).toContain("clinic_saas_invoices")
    expect(platformFeeSql).toContain("eu_unclassified")
    expect(platformFeeSql).toContain("extra_eu_unclassified")
    expect(platformFeeSql).toContain("vies_unavailable")
    expect(platformFeeSql).toContain("commission_reduction")
    expect(platformFeeSql).toContain("operator_gated")
    expect(platformFeeSql).toContain("eleva.platform_admin")
    expect(platformFeeSql).toContain("platform_fee_invoices_payment_key")
    expect(platformFeeSql).toContain("clinic_saas_invoices_subscription_org_fk")
    expect(platformFeeSql).toContain("billing_subscriptions_id_org_key")
    const dlqCleanup = migrations.find(
      (m) => m.tag === "0038_workflow_dead_letters_open_entity_cleanup"
    )
    expect(dlqCleanup?.statements.length).toBeGreaterThan(0)
    expect(dlqCleanup?.hash).toHaveLength(64)
    const dlqCleanupSql = dlqCleanup?.statements.join("\n") ?? ""
    expect(dlqCleanupSql).toContain("workflow_dead_letters")
    expect(dlqCleanupSql).toContain("discarded")
    expect(dlqCleanupSql).toContain("workflow_dead_letters_open_entity_uidx")
    const recon = migrations.find(
      (m) => m.tag === "0037_accounting_reconciliation_runs"
    )
    expect(recon?.statements.length).toBeGreaterThan(0)
    const reconSql = recon?.statements.join("\n") ?? ""
    expect(reconSql).toContain("accounting_reconciliation_runs")
    expect(reconSql).toContain("accounting_reconciliation_status")
    expect(reconSql).toContain("eleva.platform_admin")
    expect(reconSql).toContain("accounting_reconciliation_runs_month_key")
    const dlq = migrations.find(
      (m) => m.tag === "0036_workflow_dead_letters_open_entity"
    )
    const dlqSql = dlq?.statements.join("\n") ?? ""
    expect(dlqSql).toContain("workflow_dead_letters_open_entity_uidx")
    expect(dlqSql).toContain("workflow_dead_letters")
    const invoice = migrations.find((m) => m.tag === "0035_expert_invoices")
    const invoiceSql = invoice?.statements.join("\n") ?? ""
    expect(invoiceSql).toContain("expert_invoices")
    expect(invoiceSql).toContain("buyer_tax_id")
    expect(invoiceSql).toContain("expert_invoice_status")
    expect(invoiceSql).toContain("expert_invoices_booking_expert_key")
    expect(invoiceSql).toContain("expert_invoices_id_org_key")
    expect(invoiceSql).toContain(
      'ADD CONSTRAINT "expert_invoices_booking_expert_key"'
    )
    expect(invoiceSql).toContain('ADD CONSTRAINT "expert_invoices_id_org_key"')
    expect(invoiceSql).not.toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "expert_invoices_booking_expert_key"'
    )
    expect(invoiceSql).toContain("bookings_id_org_key")
    expect(invoiceSql).toContain("expert_invoices_booking_org_fk")
    expect(invoiceSql).toContain("eleva.platform_admin")
    expect(invoiceSql.indexOf("expert_invoices_booking_org_fk")).toBeLessThan(
      invoiceSql.indexOf('DROP CONSTRAINT IF EXISTS "bookings_id_org_key"')
    )
    const payout = migrations.find((m) => m.tag === "0034_payout_engine")
    const payoutSql = payout?.statements.join("\n") ?? ""
    expect(payoutSql).toContain("payout_states")
    expect(payoutSql).toContain("booking_refunds")
    expect(payoutSql).toContain("transfer_reversals")
    expect(payoutSql).toContain("workflow_dead_letters")
    expect(payoutSql).toContain("payout_states_forbid_destination_update")
    expect(payoutSql).toContain("payout_states_payment_org_fk")
    expect(payoutSql).toContain("transfer_reversals_payout_payment_fk")
    expect(payoutSql).toContain("payout_states_booking_payment_id_key")
    expect(payoutSql).toContain("booking_refunds_idempotency_key")
    const privacy = migrations.find((m) => m.tag === "0031_member_privacy")
    expect(privacy?.statements.length).toBeGreaterThan(0)
    const offer = migrations.find((m) => m.tag === "0027_offer_model")
    const offerSql = offer?.statements.join("\n") ?? ""
    expect(offerSql).toContain("public.iso3166_alpha2_codes")
    expect(offerSql).not.toContain("SELECT 1 FROM unnest(service_countries)")
    expect(offerSql).not.toContain(
      `"country_scope_type" "country_scope_type" DEFAULT 'list'`
    )
    const finalize = migrations.find((m) => m.tag === "0028_booking_finalize")
    expect(finalize?.statements.length).toBeGreaterThan(10)
    const finalizeSql = finalize?.statements.join("\n") ?? ""
    expect(finalizeSql).toContain("btree_gist")
    expect(finalizeSql).toContain("slot_reservations_no_overlap")
    expect(finalizeSql).toContain(`SET "status" = 'expired'`)
    expect(finalizeSql).toContain("counterparty_org_id")
    expect(finalizeSql).toContain("bookings_counterparty_org_idx")
    expect(finalizeSql).toContain("bookings_price_amount_match")
    expect(finalizeSql).toContain("bookings_counterparty_read")
    expect(finalizeSql).toContain("consents_active_user_idx")
    expect(finalizeSql).toContain("ON DELETE RESTRICT")
    expect(finalizeSql).toContain("gen_random_uuid()")
    expect(finalizeSql).not.toContain("sha256(id::text")
    const funnel = migrations.find(
      (m) => m.tag === "0029_reservation_funnel_snapshot"
    )
    const funnelSql = funnel?.statements.join("\n") ?? ""
    expect(funnelSql).toContain("funnel")
    expect(funnelSql).toContain("slot_reservations_funnel_object")
    const domainEvents = migrations.find(
      (m) => m.tag === "0030_domain_events_outbox"
    )
    const domainSql = domainEvents?.statements.join("\n") ?? ""
    expect(domainSql).toContain("domain_events_outbox")
    expect(domainSql).toContain("domain_event_deliveries")
    expect(domainSql).toContain("domain_event_delivery_status")
    expect(domainSql).toContain("'processing'")
    expect(domainSql).toContain("domain_events_publisher")
    expect(domainSql).toContain("guest_activation_sent_at")
    const lease = migrations.find((m) => m.tag === "0032_dsar_processing_lease")
    const leaseSql = lease?.statements.join("\n") ?? ""
    expect(leaseSql).toContain("processing_started_at")
    const connect = migrations.find((m) => m.tag === "0033_connect_settlement")
    const connectSql = connect?.statements.join("\n") ?? ""
    expect(connectSql).toContain("stripe_connect_account_id")
    expect(connectSql).toContain("applied_commission_bps")
    expect(connectSql).toContain("processing_fee_cents")
    const sql = privacy?.statements.join("\n") ?? ""
    expect(sql).toContain("notification_preferences")
    expect(sql).toContain("dsar_requests")
    expect(sql).toContain("account_deletion_requests")
    expect(sql).toContain("subject_pseudonym")
    expect(sql).toContain("refund_pending")
    expect(sql).toContain("'marketing'")
    expect(sql).toContain("deletion_scheduled_at")
    expect(sql).toContain("owner_user_visible")
    expect(sql).toContain("dsar_requests_owner_read")
    expect(sql).toContain("dsar_requests_admin_update")
    expect(sql).toContain("account_deletion_requests_completed_orphan")
    expect(sql).toContain("subject_kind = 'user'")
    expect(sql).toMatch(
      /subject_pseudonym IS NOT NULL\s+AND booking_id IS NOT NULL/
    )
    expect(sql).not.toMatch(
      /subject_kind = 'user'\s+AND user_id IS NULL\s+AND guest_email_hash IS NULL\s+AND subject_pseudonym IS NOT NULL\s+\)/
    )
    expect(sql).toContain("receipt_url")
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS")
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS")
    expect(sql).toContain('SET "guest_email_hash" = NULL')
  })
})
