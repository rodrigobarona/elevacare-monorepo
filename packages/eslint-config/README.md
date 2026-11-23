# `@eleva/eslint-config`

Shared eslint configuration for the workspace.

| Config                | For                         | What it adds                                                                                                                  |
| --------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `./base`              | every package               | The recommended rules, and the bans that hold everywhere (the auth library and icons through our packages)                    |
| `./next-js`           | Next.js apps                | `./base` plus the Next.js and React rules                                                                                     |
| `./react-internal`    | React packages              | `./base` plus the React rules                                                                                                 |
| `./boundaries`        | apps                        | Vendor SDKs only through the package that owns them; health data is not unwrapped in an app                                   |
| `./frontend-db-reads` | every app except `apps/api` | From `@eleva/db`: the read helpers on its list (`FRONTEND_DB_READS`) and types, and nothing else. Use it after `./boundaries` |

## Warnings, and what fails a build

`./base` uses `eslint-plugin-only-warn`: every finding is a warning, so
`pnpm lint` exits 0 whatever it finds. The boundary rules must not be
warnings, so CI runs them alone with `pnpm check:boundaries`
(`scripts/check-boundaries.mjs`), which fails on any finding.

That check does not obey `eslint-disable` comments. It also lints a few
lines in each app that must be refused, and compares how the boundary rules
are set for every file of an app. This catches a config that leaves a rule
out, sets it twice, or switches it off for one folder: in a flat config a
later setting of a rule replaces the earlier one, it is not added to it.

Packages have their own lint configs and are not covered by the boundary
config or by those checks.
A config that needs its own `no-restricted-imports` or `no-restricted-syntax`
entries has to carry the earlier entries with it, as `./frontend-db-reads`
does for `REVEAL_RESTRICTION`.
