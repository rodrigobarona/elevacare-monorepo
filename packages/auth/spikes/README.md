# Better Auth spike (PR 02.0)

Throwaway instance used to pin Better Auth `1.7.3` and prove the ADR-017
plugin set. Evidence lives in `docs/eleva-v3/spikes/02-better-auth.md`.
Delete this folder before PR 02.1 opens.

```bash
# .env.local (gitignored) needs SPIKE_DATABASE_URL on Neon branch
# spike-02-better-auth / database auth_spike
pnpm install --ignore-workspace
pnpm migrate
pnpm prove
```

Evidence: `docs/eleva-v3/spikes/02-better-auth.md` and `evidence.json`.
