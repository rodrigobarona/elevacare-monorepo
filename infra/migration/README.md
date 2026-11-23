# `@eleva/infra-migration`

Tools for moving the MVP's data into Eleva v3 (Phase 14, ADR-019). The
package is temporary: it is removed after cutover (Phase 16.16). Nothing in
`apps/**` or `packages/**` may import it (`pnpm check:no-migration-imports`).

**What exists today:** the argument parser (`src/args.ts`), the target
guard (`src/guard.ts`), one command that runs the guard and stops
(`src/cli.ts`, `src/main.ts`), and the one module that will open
connections (`src/connect.ts`), all covered by tests that use fakes. There
is no database driver installed, no mapper, no report and no script that
writes anything: nothing here has ever connected to a database.

## The guard command

```bash
pnpm --filter @eleva/infra-migration guard                      # a dry run against a rehearsal branch
pnpm --filter @eleva/infra-migration guard --apply              # the same check for a run that would write
pnpm --filter @eleva/infra-migration guard --target production  # needs today's date, a terminal and the typed project id
```

It runs the target guard with the flags a real run takes, prints what was
approved and stops. It opens no database connection and writes nothing; its
only network calls are the guard's two read-only questions to the Neon API.
It does not load a `.env` file: set the variables in the table at the end
of this page for the run. Use it to check a rehearsal branch's variables
before the first command that connects exists.

| Exit status | Meaning                                                                   | What is printed                                                                                                        |
| ----------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0           | The guard approved this target                                            | On standard output: the target kind, the mode, the host, the project id, the branch. Never a URL, a user or a password |
| 2           | Refused: a usage error (`USAGE`) or one of the guard's refusals below     | One line on standard error: `refused <CODE>: <what to do>`                                                             |
| 1           | Something unexpected (a bug). Never read it as approval                   | One line on standard error with the kind of error only                                                                 |
| 3           | Reserved for the commands that connect: approved, and a connection failed | See "Connections"                                                                                                      |

## Connections

`openMigrationConnections()` (`src/connect.ts`) is the only place in the
package that opens a database connection, and a test keeps every other
file from importing a driver.

- It takes only the object the guard returned in this process. A copy, or
  an object built by hand with the same fields, is refused (`NOT_APPROVED`)
  before anything is opened. The approved object cannot be changed.
- It connects with the two connection strings the guard rebuilt and never
  reads the environment.
- The MVP session is read-only before it is handed out, and so is the v3
  session in a dry run: the setting is made for the session and read back
  from the server. Only `--apply` gets a v3 session that can write. This is
  a second safeguard. The first is the read-only database role the operator
  creates for the MVP.
- A pooled host (its name has `-pooler`) is refused (`POOLED_HOST`): a
  session setting does not hold there. Use the direct host.
- If the second connection fails, the first is closed. `close()` closes
  both and can be called twice.
- A failure is a `MigrationConnectError` (exit status 3) that names the
  side and the kind of error, never a host, a URL or a password.

No driver is installed yet. It comes in through the `open` argument, and
the first command that connects (14.3) adds the real one in `connect.ts`,
once it is known what the MVP's production database runs on (roadmap F-02).

## The target guard

`assertMigrationTarget()` (`src/guard.ts`) runs before any connection is
opened and decides whether a run may touch the database behind
`TARGET_DATABASE_URL`. A refusal is a `MigrationGuardError` with a code (the
table below); a command built on the guard exits 2 on one.

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

A connection URL may carry `sslmode` (`require` or `verify-full`) and
`channel_binding` (`require` or `prefer`), each once, and nothing else:
`host`, `hostaddr`, `port`, `options` and any other parameter are refused,
because a driver would follow them to a different database than the one in
the URL, and a value that turns encryption off is refused too. A URL
that carries no `sslmode` gets `sslmode=require`. The guard returns `targetUrl` and `sourceUrl`, rebuilt
from the parts it checked. **A run connects with those two strings and
never reads the environment again.**

`--dry-run` is the default. `--apply` writes. `--since <ISO-8601 instant>`
selects a delta run. `--report <path>` chooses where the report goes.

## When the guard refuses

Nothing has been connected to when a refusal is shown.

| Code                                       | What it means                                                                 | What to do                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `TARGET_URL_MISSING`, `SOURCE_URL_MISSING` | `TARGET_DATABASE_URL` or `MVP_DATABASE_URL` is not set                        | Set it                                                                                          |
| `TARGET_URL_INVALID`, `SOURCE_URL_INVALID` | The URL is not a plain Postgres URL: one host, the default port, no fragment  | Fix the URL; percent-encode special characters in the password                                  |
| `URL_PARAMETER_NOT_ALLOWED`                | The URL carries a parameter other than `sslmode` and `channel_binding`        | Remove it                                                                                       |
| `URL_PARAMETER_VALUE_NOT_ALLOWED`          | `sslmode` or `channel_binding` is repeated or set to a value that weakens TLS | Use `sslmode=require` (or `verify-full`) and `channel_binding=require` (or `prefer`), each once |
| `URL_PASSWORD_NAMES_ENDPOINT`              | The password starts with `endpoint=` or `project=`                            | Use the plain password                                                                          |
| `TARGET_NOT_NEON`                          | The target host does not end in `.neon.tech`                                  | Point `TARGET_DATABASE_URL` at the v3 Neon project                                              |
| `SOURCE_IS_TARGET`                         | Source and target are the same database                                       | Set `MVP_DATABASE_URL` to the MVP database                                                      |
| `SOURCE_IN_TARGET_PROJECT`                 | `MVP_DATABASE_URL` points into the v3 project                                 | Set it to the MVP database                                                                      |
| `NEON_PROJECT_MISSING`                     | `NEON_PROJECT_ID` is not set                                                  | Set it to the v3 production project                                                             |
| `NEON_API_KEY_MISSING`                     | `NEON_API_KEY` is not set, so Neon cannot be asked (no network call was made) | Set it to a key that can read the v3 project                                                    |
| `NEON_LOOKUP_FAILED`                       | The Neon API could not be asked, or its answer could not be read              | Check `NEON_API_KEY` and `NEON_PROJECT_ID`, then run again                                      |
| `ENDPOINT_NOT_IN_PROJECT`                  | The target host is not an endpoint of `NEON_PROJECT_ID`                       | Check both variables                                                                            |
| `ENDPOINT_NOT_WRITABLE`                    | The target host is a read replica                                             | Use the read-write endpoint of the same branch                                                  |
| `BRANCH_UNKNOWN`                           | Neon did not say which branch the host belongs to                             | Run again; if it repeats, check the endpoint in the Neon console                                |
| `DEFAULT_BRANCH_IN_BRANCH_MODE`            | A rehearsal was pointed at the production branch                              | Create a rehearsal branch and use its host                                                      |
| `HOST_NOT_ALLOWED`                         | The rehearsal host is not in `MIGRATION_ALLOWED_TARGET_HOSTS`                 | Add it                                                                                          |
| `NOT_DEFAULT_BRANCH`                       | `--target production` was pointed at a branch that is not the default one     | Use the production branch's host, or run a rehearsal without `--target production`              |
| `PRODUCTION_NOT_CONFIRMED`                 | `MIGRATION_CONFIRM_PRODUCTION` is not today's date in UTC                     | Set it to the date in the message, for this run only                                            |
| `PRODUCTION_NOT_INTERACTIVE`               | No person is at the terminal                                                  | Run it from a terminal, not a pipe or a CI job                                                  |
| `PROJECT_ID_NOT_TYPED`                     | The project id typed does not match `NEON_PROJECT_ID`                         | Run again and type the id                                                                       |

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
