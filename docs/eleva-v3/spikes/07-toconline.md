# Spike 07.0 — TOConline test-series probe

**Status:** partial — **not complete**. OAuth, refresh, TEST series lookup,
customer, and service are proven. Invoice, PDF, credit-note, and document AT
are blocked because TEST FT/NC are `at_status=uncommunicated`. Do not start
PR 07.1.
**Date:** 2026-09-14 (re-run after Dados API secret)
**TOConline:** Eleva company credentials from local env. Live `ELEVA` series
refused. Founder series **TEST** accepted by the runner.
**Instance:** throwaway `pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts`

## Verdict

07.0 is **still blocked**. Token exchange works. TEST series exist (FT id
337, NC id 343) but TOConline refuses issuance until the founder communicates
those series to AT in the UI. No FT, PDF, or NC was created. Document AT
(check 06) stayed off.

## Why issuance stopped

Local env now has a Dados API secret that is **not** a copy of the client id
(lengths differ; values not recorded). `TOCONLINE_SERIES_PREFIX=TEST`.
Redirect is `https://oauth.pstmn.io/v1/callback`. `TOCONLINE_SPIKE_SEND_AT`
is unset. `TOCONLINE_AT_*` keys are absent.

OAuth follows official docs
(https://api-docs.toconline.pt/autenticacao-simplificada): `GET {OAUTH_URL}/auth`
returns **302** `Location: https://oauth.pstmn.io/v1/callback?code=…` (runner
does not follow the 302). `POST {OAUTH_URL}/token` with HTTP Basic
`client_id:secret` + `redirect_uri` returns Bearer + refresh,
`expires_in=14400`. Refresh grant also returns `expires_in=14400`.

Series lookup:

- TEST / FT id=337, `at_status=uncommunicated`, number=0
- TEST / NC id=343, `at_status=uncommunicated`, number=0
- description: “E uma serie para testar integração de API”

Customer upsert: NIF `999999990` → id=3.
Service upsert: code `ELEVA-SPIKE-070` → id=6.

First FT attempt used `payment_mechanism=TB` (SAF-T bank-transfer code) and
TOConline returned 500: “O meio de pagamento (TB) não é reconhecido.” Official
receipt docs list `MO`, `CH`, `DC`, `CC`, `TR`, `DDA`, `MB`. Runner now sends
`MO`.

Second FT attempt (`MO`, TEST prefix + id 337) returned 500: “Não pode usar a
série TEST (FT) porque ainda não foi comunicada. Comunique se pretende
utilizar.” The runner now fails check 04 before POST when `at_status` is
`uncommunicated`.

Live `ELEVA` was never used as a series. No document was sent to AT.

## Versions / API (docs + this run)

Verified 2026-09-14 against https://api-docs.toconline.pt/llms.txt,
https://api-docs.toconline.pt/autenticacao-detalhada,
https://api-docs.toconline.pt/autenticacao-simplificada,
https://api-docs.toconline.pt/apis/vendas/documentos-de-venda.md, and
https://api-docs.toconline.pt/apis/vendas/recibos-de-venda:

| Item                                                                             | What the official docs say                                                                                                   | This run                                                                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `API_URL` / `OAUTH_URL`                                                          | Issued **per company** on Dados API, not published as a global hostname                                                      | Env hosts: `api33.toconline.pt`, `app33.toconline.pt` (Dados API snapshot, not source literals) |
| OAuth                                                                            | Authorization Code; `GET {OAUTH_URL}/auth` (`scope=commercial`); `POST {OAUTH_URL}/token` with HTTP Basic `client_id:secret` | `/auth` 302 + code. `/token` Bearer + refresh, `expires_in=14400`.                              |
| Client credentials                                                               | Not in official auth pages                                                                                                   | `POST /token` `grant_type=client_credentials` → **501** `BROK…` / “Not Implemented”             |
| Access token TTL                                                                 | `expires_in` (example 14400 s ≈ 4 h); refresh grant `grant_type=refresh_token`                                               | Proven: authorization_code and refresh both return `expires_in=14400`, `token_type=Bearer`.     |
| Default Postman redirect                                                         | `https://oauth.pstmn.io/v1/callback`                                                                                         | Matches env; Location code scraped, 302 not followed.                                           |
| v1 sales / purchase / receipt / payment headers                                  | `Authorization: Bearer`, `Content-Type: application/json`, `Accept: application/json`                                        | Customer/service/series exercised. Sales POST refused (uncommunicated series).                  |
| Legacy JSON:API headers (customer, supplier, address, contact, product, service) | `Authorization: Bearer`, `Content-Type: application/vnd.api+json`, `Accept: application/json`                                | Customer + service upsert proven.                                                               |
| Sales document series fields                                                     | `document_series_id` and `document_series_prefix` on `POST /api/v1/commercial_sales_documents`                               | Runner passed TEST + looked-up id; never `ELEVA`. Series `at_status=uncommunicated`.            |
| Payment mechanism                                                                | Receipts: `MO`, `CH`, `DC`, `CC`, `TR`, `DDA`, `MB`                                                                          | SAF-T `TB` rejected. Runner uses `MO`.                                                          |
| AT communication                                                                 | `PATCH /send_document_at_webservice` requires Portal das Finanças `entity_username` + base64 `entity_password`               | Env has no `TOCONLINE_AT_*` keys. `TOCONLINE_SPIKE_SEND_AT` unset. Check 06 skipped.            |

Historical internal table (`docs/eleva-v3/toconline-api-reference.md`) lists
`https://api33.toconline.pt` and `https://app33.toconline.pt/oauth` as a
**historical snapshot only**. 07.1 must read `TOCONLINE_API_BASE_URL` /
`TOCONLINE_OAUTH_BASE_URL` from the per-company Dados API credential (aliases
`TOCONLINE_API_URL` / `TOCONLINE_OAUTH_URL`) and never paste those hosts into
`packages/accounting/src`.

## Contract checks

### 00 — TEST series guard — proven (local)

- **Request:** runner with `TOCONLINE_SERIES_PREFIX=TEST`.
- **Response:** guard passes; process continues. `ELEVA` still exits 2.
- **Absorb:** exact `TEST` is allowed, not only `TEST-…`. Live `ELEVA` stays
  refused.

### 01 — OAuth hostnames + authorization code — proven

- **Request:** `GET {OAUTH_URL}/auth?response_type=code&scope=commercial`
  (no redirect follow), then `POST /token` HTTP Basic + `redirect_uri`.
- **Response:** **302** Location host `oauth.pstmn.io` + 64-char `code`.
  Token exchange succeeded: Bearer, refresh present, `expires_in=14400`.
- **Absorb:** official simplified flow (no PKCE) works with a real Dados API
  secret. Worktree `.env.local` may still hold a placeholder; use the updated
  gitignored root/apps/api env (secret length ≠ client-id length).

### 01b — Client credentials — proven unused

- **Request:** `POST /token` `grant_type=client_credentials` + HTTP Basic.
- **Response:** **501** Not Implemented.
- **Absorb:** do not implement client-credentials in 07.1.

### 01c — Series list — proven (TEST uncommunicated)

- **Request:** `GET /api/commercial_document_series?filter[document_type]=FT&filter[prefix]=TEST`
  and the NC equivalent.
- **Response:** TEST FT id=337, TEST NC id=343, both `at_status=uncommunicated`,
  `communication_date=null`, `atcud_prefix=null`, `number=0`.
- **Absorb:** 07.1 must refuse issuance when `at_status` is not communicated.
  Series communication is a TOConline UI step (Empresa → Configurações →
  Séries de Documentos → Comunicar série), not `send_document_at_webservice`.

### 02 — Customer upsert — proven

- **Request:** search NIF `999999990`, create if missing.
- **Response:** customer id=3, name `Eleva 07.0 spike TEST customer`.

### 03 — Service upsert — proven

- **Request:** search code `ELEVA-SPIKE-070`, create if missing.
- **Response:** service id=6.

### 04 — Invoice in TEST series — failed (series not communicated)

- **Request:** `POST /api/v1/commercial_sales_documents` with
  `document_series_prefix=TEST`, `document_series_id=337`, `payment_mechanism=MO`.
- **Response:** 500, series TEST (FT) not communicated. Earlier `TB` attempt
  also 500 (unrecognized payment). Runner now exits before POST when
  `at_status=uncommunicated`.
- **Absorb:** communicate TEST FT + NC only. Never issue on `ELEVA` /
  `ELEVA-FEE-{YYYY}`. Use official payment codes (`MO` / `TR`), not SAF-T `TB`.

### 05 — PDF retrieval — skipped

No invoice id. Planned:
`GET /api/url_for_print/:id?filter[type]=Document&filter[copies]=1`.

### 06 — AT communication — skipped

`TOCONLINE_SPIKE_SEND_AT` unset (founder did not enable document AT). Official
payload also needs Portal das Finanças credentials. The runner still requires
a TEST NC before any AT call.

### 07 — Credit note — skipped

No invoice id. TEST NC series exists (id=343) but is also uncommunicated.

### 08 — Refresh-token expiry — proven (TTL only)

- **Request:** `POST /token` `grant_type=refresh_token` + HTTP Basic.
- **Response:** new Bearer, `expires_in=14400`.
- **Absorb:** access TTL is 4 h as documented. Full 401 → refresh after expiry
  was not waited out.

### 09 — Rate limits and error payloads — proven (sample)

- `client_credentials` 501 JSON:API `errors[]` with `status: "501 - Not Implemented"`.
- `GET /api/v1/commercial_sales_documents/0` → 404 `{ "error": "Document not found." }`.
- Sales POST 500 Portuguese validation strings for payment mechanism and
  uncommunicated series. No 429 observed.

## Env keys for 07.1 (do not put secrets in git)

```
TOCONLINE_CLIENT_ID=
TOCONLINE_CLIENT_SECRET=   # real Dados API secret; must not equal client id
TOCONLINE_API_BASE_URL=   # from Dados API; alias TOCONLINE_API_URL
TOCONLINE_OAUTH_BASE_URL= # from Dados API; alias TOCONLINE_OAUTH_URL
TOCONLINE_OAUTH_REDIRECT= # alias TOCONLINE_URI_REDIRECT; default Postman callback
TOCONLINE_SERIES_PREFIX=TEST
TOCONLINE_AT_USERNAME=    # Portal das Finanças; required for check 06
TOCONLINE_AT_PASSWORD=
```

Decision log: `docs/eleva-v3/decision-log.md` (2026-09-14 Phase 07.0 entry).
D-09 stays `proposed`; this spike does not sign it.

## Follow-up

1. Operator: in TOConline, communicate **TEST** FT and NC only
   (Empresa → Configurações → Séries de Documentos → Comunicar série).
   Do not communicate or issue on live `ELEVA`. Re-run this spike.
2. Optional: Portal das Finanças AT user + `TOCONLINE_SPIKE_SEND_AT=1` for
   check 06 after a TEST NC exists.
3. Accountant: IVA matrix + **D-09 sign-off** (still `proposed`).
4. Delete `packages/accounting/spikes/` before PR 07.1.
