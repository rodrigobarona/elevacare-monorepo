# Phase 07.0 — TOConline spike (throwaway)

Evidence lives in `docs/eleva-v3/spikes/07-toconline.md`. Delete this directory
before PR 07.1.

## Guard

`TOCONLINE_SERIES_PREFIX` **must** be exact `TEST` (the founder-created series)
or start with `TEST-`. The runner exits 2 if the prefix is missing, `ELEVA`,
or any other live series. Do not issue documents into `ELEVA` /
`ELEVA-FEE-*` / `ELEVA-SAAS-*`.

## Run

```bash
pnpm exec tsx --env-file=.env.local packages/accounting/spikes/toconline.ts
```

Required env (see root `.env.example`):

| Key                                               | Notes                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `TOCONLINE_CLIENT_ID` / `TOCONLINE_CLIENT_SECRET` | Eleva **test** app only                                                        |
| `TOCONLINE_API_BASE_URL`                          | From TOConline Empresa → Configurações → Dados API. Alias: `TOCONLINE_API_URL` |
| `TOCONLINE_OAUTH_BASE_URL`                        | Same source. Alias: `TOCONLINE_OAUTH_URL`                                      |
| `TOCONLINE_OAUTH_REDIRECT`                        | Must match the app in Dados API. Alias: `TOCONLINE_URI_REDIRECT`               |
| `TOCONLINE_SERIES_PREFIX`                         | Founder series: `TEST` (also accepts `TEST-…`)                                 |

Official docs (https://api-docs.toconline.pt/autenticacao-detalhada) treat
`API_URL` and `OAUTH_URL` as **credentials issued per company**. Put those
values in env; never paste them into `packages/accounting/src`.

`TOCONLINE_CLIENT_SECRET` must be the Dados API secret. If it equals
`TOCONLINE_CLIENT_ID`, the runner stops at the authorization-code exchange
(check 01) after the client-credentials probe (check 01b); that pair returns
403 `access_denied`.

`TOCONLINE_OAUTH_REDIRECT` (or alias `TOCONLINE_URI_REDIRECT`) is required and
must match the Dados API app. There is no Postman callback fallback.

**Do not** communicate TEST FT/NC to AT (`Comunicar série`). Those series stay
active inside TOConline only. TOConline refuses sales documents until a series
is AT-communicated; the founder will communicate **ELEVA** at go-live, not TEST.
Official payment codes are `MO` / `TR` (not SAF-T `TB`).

Document AT (`send_document_at_webservice`) stays off for TEST. Optional
`TOCONLINE_AT_USERNAME` / `TOCONLINE_AT_PASSWORD` + `TOCONLINE_SPIKE_SEND_AT=1`
are for ELEVA later, never for TEST.

## What this runner does

Official Authorization Code (GET `/auth` without following the 302, then
`POST /token` with HTTP Basic — throwaway 07.0 exception matching the proven
simplified flow; 07.1 uses the same contract). Series lookup, customer/service
upsert, refresh-token probe, and a sample error payload. Invoice / PDF / NC
are skipped while TEST remains uncommunicated to AT (by design).
