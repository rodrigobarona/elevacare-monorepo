# TOConline setup (operator)

Status: **stub** for Phase 07.2. Automatic **production** issuance (PR 07.1)
stays blocked until remaining fiscal parameters are confirmed (tax codes,
rates, legal mentions, VIES 24h cache + downtime procedure). This file is
the operator checklist for credentials and series — not permission to issue.

## TEST vs ELEVA

| Series prefix | What it is                                        | Allowed now                                                                                                                                          |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST`        | TOConline-only sandbox. Not a tax sandbox.        | Lookups, OAuth, token refresh. **Never** `Comunicar série` to AT. **Never** finalize fictitious documents. **Never** POST FT/NC.                     |
| `ELEVA`       | Production (`ELEVA-FEE-YYYY`, `ELEVA-SAAS-YYYY`). | Create the series in TOConline when legal procedures are ready. **Do not** use ELEVA to simulate. Communicate and issue only after those procedures. |

Accountant 2026-09-15: non-communication of TEST does not make it a fiscal
test environment and does not authorize fictitious documents.

## OAuth app (Dados API)

Keep the Dados API `redirect_uri` in lockstep with env:

- Product callback: `GET /accounting/callback`
- Production URL: `https://api.eleva.care/accounting/callback`
- Env: `TOCONLINE_OAUTH_REDIRECT` (required; no Postman fallback)

Flow (proven in the 07.0 spike): Authorization Code **without PKCE**, HTTP
Basic `client_id:secret`, scope `commercial`. Hosts come from
`TOCONLINE_API_BASE_URL` and `TOCONLINE_OAUTH_BASE_URL` — never hardcoded.

Also set: `TOCONLINE_CLIENT_ID`, `TOCONLINE_CLIENT_SECRET`,
`TOCONLINE_SERIES_PREFIX` (staging may use `TEST` locally; production is
`ELEVA` at go-live).

## Issuance gate (still closed)

`issueInvoice()` must not POST `/api/v1/commercial_sales_documents` (v1
auto-finalizes). Retries record `toconline_v1_auto_finalize_blocked`.
`POST /workflows/invoicing-retry` (every 30 min) re-dispatches **failed**
expert invoices through that same closed gate.

`POST /workflows/stripe-toconline-reconciliation` (monthly, 1st 04:00 UTC
= 04:00 WET / 05:00 WEST) compares Stripe `booking_payments` to
`expert_invoices`. It does **not** POST FTs. Provision with
`pnpm qstash:setup:invoicing`.

## Still to do before 07.1

- [ ] Confirm remaining fiscal parameters with the accountant
- [ ] Create and communicate **ELEVA** series only after legal procedures
- [ ] Provision QStash: `pnpm qstash:setup:invoicing` (or `pnpm qstash:setup`)
- [ ] Do **not** Comunicar TEST; do **not** issue TEST or ELEVA FTs to simulate

Spike evidence: [`../spikes/07-toconline.md`](../spikes/07-toconline.md).
