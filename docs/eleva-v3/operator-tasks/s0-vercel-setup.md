# Sprint 0 — Vercel Setup Follow-Ups (Operator Checklist)

Status: Required before S0 exit gates pass.

These are manual, dashboard-only actions that the agent cannot perform via
CLI or MCP. They should be completed by the repository operator once the
S0 PR lands.

## 1. Project git connections

All 5 Vercel projects exist (via `vercel projects add`) and are recorded
in [.vercel/repo.json](../../../.vercel/repo.json). Each still needs to be
**connected to the GitHub repo** `rodrigobarona/elevacare-monorepo`:

| Project | Root Directory | basePath / Zone |
| --- | --- | --- |
| `elevacare-marketing` (existing) | `apps/web` | gateway (root of `eleva.care`) |
| `elevacare-app` | `apps/app` | root (no basePath) — rewrites from gateway |
| `elevacare-api` | `apps/api` | `api.eleva.care` subdomain |
| `elevacare-docs` | `apps/docs` | `/docs` under gateway |
| `elevacare-email` | `apps/email` | internal `email.eleva.care` |

For each new project, in the Vercel dashboard:

1. Open Project Settings → **Git**
2. Connect to GitHub → pick `rodrigobarona/elevacare-monorepo`
3. Set **Root Directory** to the matching `apps/<name>` directory
4. Framework preset should auto-detect as **Next.js**
5. Install command: `pnpm install`
6. Build command: leave default (Next.js) or `pnpm build`
7. Preview branch: every branch; Production branch: `main`

## 2. Marketplace integrations (staging + production)

Install these Vercel Marketplace integrations and link them to all 5
Vercel projects in both `preview` + `production` environments (Neon:
`eleva_v3_main` + `eleva_v3_audit` as two separate projects):

- **Neon Postgres** → projects `eleva_v3_main`, `eleva_v3_audit` (EU region)
- **Upstash Redis** (EU)
- **Upstash QStash** (EU)
- **Resend** (EU)
- **Sentry** (EU)
- **BetterStack** (EU) — uptime + logs

After each integration is installed, run `vercel env pull .env.local`
inside each app directory to confirm the expected env vars are populated.

## 3. DNS on `eleva.care`

Vercel DNS owns the zone (per ADR-012). Configure per
[environment-matrix.md](../environment-matrix.md):

- `A/AAAA @` → gateway (elevacare-marketing) production
- `CNAME api` → elevacare-api production (for `api.eleva.care`)
- `CNAME staging` → gateway staging
- `CNAME email` → elevacare-email production
- `CNAME status` → BetterStack status page
- `CNAME sessions` → Daily.co branded rooms (Sprint 5)
- wildcard `*.eleva.care` for per-PR `*.preview.eleva.care`
- SPF / DKIM / DMARC / BIMI (Sprint 4 deliverable; DNS zone must exist now)

## 4. Internal URL hygiene

For each of the 4 new projects:

- Add a `robots.txt` rule in the project's root route handler to
  `Disallow: /` when served on `*.vercel.app` (detect via request host).
- OR configure a 301 from `elevacare-<name>.vercel.app` to the canonical
  `eleva.care/...` URL. (ADR-014 requirement.)

The 301 approach is preferred and is tracked as a Sprint 7 hardening item.

## 5. Verification

Once the above is complete, the S0 exit-gate checks should pass:

- `eleva.care/patient` serves the `apps/app` placeholder via rewrite
- `eleva.care/docs` serves the `apps/docs` placeholder via rewrite
- `api.eleva.care/health` returns `{ status: 'ok' }`
- `vercel env pull` populates expected vars in each app
- Internal Vercel project URLs return `noindex` or 301 to canonical
