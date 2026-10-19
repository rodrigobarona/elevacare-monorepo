# TOConline platform-fee issuance (live path)

Status: Living. Operator SSOT while `issueInvoice()` stays closed.

Stripe already collected the 15% application fee. TOConline documents the Portuguese
FT (IVA as D-03 working example) and a Recibo so the list shows settled (green),
not pending AR (red).

## One sequence — no review queue

Do this in one go. Do not leave an FT at `status: 1` with `pending_total > 0`.

1. **FT header** — previous JSON:API `POST /api/commercial_sales_documents`
   (`status: 0`). `date` = session day Europe/Lisbon. `payment_mechanism: DDA`.
   `vat_included_prices: true`. Cliente by NIF (17 Patricia, 18 Bee, 21 Raquel,
   22 Jessica, 23 Madalena). Series prefix `ELEVA` → `FT ELEVA/{n}`.
2. **FT line** — `POST /api/commercial_sales_document_lines`. Inclusive
   `unit_price`. Service `item_id` 5, tax NOR 23% PT (D-03 working example,
   **not** accountant-confirmed for live issuance; see Tax status). Airbnb-style platform-fee
   copy; Stripe id is `external_reference` / internal notes only.
3. **Finalize** — `PATCH /api/commercial_sales_documents` `{ status: 1 }`.
   If the line fails, delete the draft header. No rascunho review.
4. **AT** — `PATCH /api/send_document_at_webservice` with
   `document_type: sales_document` and Portal das Finanças
   `entity_username` / base64 `entity_password`. Trust GET
   `communication_status`, not a stale PATCH echo. POST is 404.
5. **Recibo** — `POST /api/v1/commercial_sales_receipts` **with `lines`**
   (official; one call). Series `RC ELEVA` (`document_series_id` 303).
   `payment_mechanism: DDA`. `date` = FT date. `received_value` = FT
   `gross_total`. `receivable_type: Document`, `receivable_id` = FT id.
   This is **not** the banned v1 FT POST. Recibo create settles AR:
   FT `status: 3`, `pending_total: 0`, `receipts_ids` set. List circle goes
   green. Cloud = AT; envelope = email.
6. **Email the FT** — `PATCH /api/email/document/{id}` `{ to_email }`.
   Recibo email is optional; the FT mail is the expert copy.

`issueInvoice()` stays closed. Never `POST /api/v1/commercial_sales_documents`.

## Tax status (unresolved)

The 2026-09-15 accountant reply is conditional: fiscal codes and rates must be
confirmed before production. The 2026-10-13 batch used NOR 23% PT as the D-03
working example. That treatment is **not** approved for these documents yet.
Until the accountant confirms it in writing, treat the batch as unresolved. If
the code or rate changes, correct each affected FT with a credit note (NC) that
references it, then issue a new FT with the confirmed treatment. Never edit or
void a communicated FT in place.

## Recibo body (proven 2026-10-13)

```json
{
  "date": "2026-03-06",
  "payment_mechanism": "DDA",
  "document_series_id": 303,
  "customer_id": 17,
  "internal_observations": "ch_…",
  "lines": [
    {
      "receivable_type": "Document",
      "receivable_id": 225,
      "received_value": 10.5
    }
  ]
}
```

Clone pattern: `RC ELEVA/1` (id 94) on `FT ELEVA/1`. Live catch-up:
`RC ELEVA/16` id **126** → FT 225; `RC ELEVA/17` id **127** → FT 226.
Batch 2026-10-13: **FT ELEVA/18–90** (ids 227–299) each have matching
`RC ELEVA/{n}`. Julio session 2026-12-17 is deferred.
No `bank_account_id` / `cash_account_id` on DDA (cash_accounts is empty).

FR auto-creates a receipt on finalize. We issue **FT**, so Recibo is a
required step, not optional cleanup.

## Related

- [TOConline API reference](toconline-api-reference.md)
- Official Recibos: https://api-docs.toconline.pt/apis/vendas/recibos-de-venda.md
- Worksheet (outside git): `~/Documents/eleva-2026-commission-report.html`
