# `@eleva/infra-migration`

Tools for moving the MVP's data into Eleva v3 (Phase 14, ADR-019). The
package is temporary: it is removed after cutover (Phase 16.16). Nothing in
`apps/**` or `packages/**` may import it (`pnpm check:no-migration-imports`).

**What exists today:** the command line and the target guard. No mapper, no
database connection and no script that writes anything exists yet.

## The target guard

`assertMigrationTarget()` (`src/guard.ts`) runs before any connection is
opened and decides whether a run may touch the database behind
`TARGET_DATABASE_URL`. A refusal exits 2.

| Run                         | The target must be                                                                                                       | Also needed                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `--target branch` (default) | a read-write endpoint of the v3 production Neon project (`NEON_PROJECT_ID`), on a branch that is **not** the default one | the host listed in `MIGRATION_ALLOWED_TARGET_HOSTS`                                                                             |
| `--target production`       | the read-write endpoint of the **default** branch of that project                                                        | `MIGRATION_CONFIRM_PRODUCTION` set to today's date in UTC (`YYYY-MM-DD`), and the operator types the Neon project id when asked |

In both cases the source (`MVP_DATABASE_URL`) and the target must be
different databases, the source must not be a database of the v3 project,
and the Neon API has to say clearly which branch the host belongs to: a
host of another project, a read replica, or an answer the guard cannot read
is refused. A dry run against production asks for the same confirmation as
a write, and a production run needs a person at the terminal.

A connection URL may carry `sslmode` and `channel_binding` and nothing
else: `host`, `hostaddr`, `port`, `options` and any other parameter are
refused, because a driver would follow them to a different database than
the one in the URL. The guard returns `targetUrl` and `sourceUrl`, rebuilt
from the parts it checked. **A run connects with those two strings and
never reads the environment again.**

`--dry-run` is the default. `--apply` writes. `--since <ISO-8601 instant>`
selects a delta run. `--report <path>` chooses where the report goes.

## Environment

| Variable                         | Purpose                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `MVP_DATABASE_URL`               | The MVP database, with a read-only role                                       |
| `TARGET_DATABASE_URL`            | The v3 database the run writes to                                             |
| `NEON_PROJECT_ID`                | The v3 **production** Neon project (rehearsal branches are created in it)     |
| `NEON_API_KEY`                   | Reads endpoints and branches of that project                                  |
| `MIGRATION_ALLOWED_TARGET_HOSTS` | Comma-separated rehearsal hosts a branch run may use                          |
| `MIGRATION_CONFIRM_PRODUCTION`   | Today's date in UTC, set by the operator for a production run and only for it |

## Tests

```bash
pnpm --filter @eleva/infra-migration test
```
