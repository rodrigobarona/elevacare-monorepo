# Eleva v3 Feature Flags — Edge Config seeds

JSON documents mirrored into Vercel Edge Config via
`pnpm --filter=@eleva/flags flags:sync`. Values here are the
staging / production _starting points_ — ongoing overrides happen
through the Vercel dashboard or MCP and should be mirrored back here
in a follow-up PR.

| File                                   | Environment             | Policy                                                                |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| [`production.json`](./production.json) | Vercel `production` env | conservative defaults; AI + diary share + Tier 2 invoicing OFF        |
| [`staging.json`](./staging.json)       | Vercel `preview` env    | launch rehearsal on; most risky flags ON so staging QA exercises them |

Source of truth for flag names, owners, and kill-switch behaviour:
[`packages/flags/src/catalog.ts`](../../packages/flags/src/catalog.ts).

Rollout policy: [`docs/eleva-v3/feature-flag-rollout-plan.md`](../../docs/eleva-v3/feature-flag-rollout-plan.md).
