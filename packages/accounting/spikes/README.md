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

Optional: `TOCONLINE_AT_USERNAME` / `TOCONLINE_AT_PASSWORD` for AT communication
(Portal das Finanças credentials required by the official payload).

## What this runner does

Official Authorization Code (GET `/auth` without following the 302, then
`POST /token` with HTTP Basic), series lookup, customer/service upsert, one
throwaway FT + PDF + AT + NC on the **TEST** series only, refresh-token probe,
and a sample error payload.
