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
pnpm --filter @eleva/infra-migration --fail-if-no-match guard                      # a dry run against a rehearsal branch
pnpm --filter @eleva/infra-migration --fail-if-no-match guard --apply              # the same check for a run that would write
pnpm --filter @eleva/infra-migration --fail-if-no-match guard --target production  # needs today's date, a terminal and the typed project id
```

It runs the target guard with the flags a real run takes, prints what was
approved and stops. It opens no database connection and writes nothing; its
only network calls are the guard's two read-only questions to the Neon API.
It does not load a `.env` file: set the variables in the table at the end
of this page for the run. Those variables, and any `PG*` one, are all it
is handed: a `DATABASE_URL` left in the shell does not reach it. If you
paste a secret as an argument by mistake, pnpm itself repeats the command
line; the tool does not. Use it to check a rehearsal branch's variables
before the first command that connects exists. `--since` and `--report` are
accepted, as a real run accepts them, and do nothing here.

| Exit status | Meaning                                                                                                                                                                                           | What is printed                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0           | The guard approved this target                                                                                                                                                                    | One line on standard output that starts `approved:` and names the target kind, the mode, both hosts, the project id and the branch. Never a URL, a user or a password  |
| 2           | Refused before anything was tried: a usage error (`USAGE`) or one of the guard's refusals below                                                                                                   | One line on standard error: `refused <CODE>: <what to do>`                                                                                                             |
| 1           | Something unexpected: a bug. Never read it as approval                                                                                                                                            | One line on standard error: `failed: unexpected <kind of error>`, or `failed NOT_APPROVED: …` when code hands the connection module a target the guard did not approve |
| 3           | For the commands that will connect: approved, a connection was tried, and the database did not answer in time (`CONNECT_FAILED`, `CONNECT_TIMED_OUT`) or would not be read-only (`NOT_READ_ONLY`) | One line on standard error: `failed <CODE> (<side>): …`                                                                                                                |

A script that goes on after the guard checks for the `approved:` line as
well as for status 0: with a mistyped package name and no
`--fail-if-no-match`, pnpm runs nothing and exits 0.

## Connections

`openMigrationConnections()` (`src/connect.ts`) is the only place in the
package that opens a database connection. A test lists what every other
file may import (its neighbours inside `src`, the one part of Node the
terminal needs, and `zod`), in every folder and for every kind of code
file, and that only `neon-api.ts` reaches the network. A driver, or the
product's own database client, cannot come in through another file. The
scans read text, so they stop a mistake, not someone set on getting
around them.

- The approval's two connection strings do not appear when it is logged,
  inspected or written as JSON, only when code asks for them by name.
- It takes only the object the guard returned in this process. A copy, or
  an object built by hand with the same fields, is refused (`NOT_APPROVED`,
  status 1: a bug in the caller) before anything is opened. The approved
  object cannot be changed.
- It connects with the two connection strings the guard rebuilt and never
  reads the environment.
- The MVP session is read-only before it is handed out, and so is the v3
  session in a dry run. The driver must open the connection read-only (in
  its start-up options), and the server is then asked what the setting
  is. Only `--apply` gets a v3 session that can write. This guards against
  a mapper with a bug. It does not stop code that sets out to write: a
  session can turn the setting off. On the MVP side the real boundary is
  the read-only database role the operator creates. On the v3 side in a
  dry run there is no such role, so the setting is the only safeguard
  there, on a rehearsal branch and on production alike. That is why a dry
  run against production asks for the same confirmation as a write.
- The driver must give **one dedicated connection per session, never a
  pool** (a pool has the same shape and would undo the read-only setting,
  a snapshot and any transaction), must never reconnect by itself, and
  must take everything from the URL and nothing from the `PG*` variables
  of the environment (the guard also refuses a run that has one set).
  Nothing here can check the driver: the first one's own tests have to
  show it (14.3).
- A database that does not answer within 30 seconds, connection and
  read-only check together, is given up on (`CONNECT_TIMED_OUT`). If the second connection fails, the first is
  closed. `close()` closes both and can be called twice.
- A failure is a `MigrationConnectError` that names the side, the class of
  the error and the driver's code when it has one (`28P01`, `ENOTFOUND`):
  never a host, a URL, a password or the driver's own words.

No driver is installed yet. It comes in through the `open` argument, and
the first command that connects (14.3) adds the real one in `connect.ts`,
once it is known what the MVP's production database runs on (roadmap F-02).
When it is chosen: the guard adds `sslmode=require` to a URL that says
nothing about TLS, and some drivers read that as "encrypt, do not check the
certificate". Pin `verify-full` in the driver's own options then.

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
different databases, neither may be a Neon pooled host (a pooler of
another provider is not recognised by its name: see roadmap F-02), the
source must not be a database of the v3 project,
and the Neon API has to say clearly which branch the host belongs to: a
host of another project, a read replica, or an answer the guard cannot read
is refused. A dry run against production asks for the same confirmation as
a write, and a production run needs a person at the terminal.

A connection URL may carry `sslmode` (`require` or `verify-full`) and
`channel_binding` (`require` or `prefer`), each once, and nothing else:
`host`, `hostaddr`, `port`, `options` and any other parameter are refused,
because a driver would follow them to a different database than the one in
the URL, and a value that turns encryption off is refused too. A URL
that carries no `sslmode` gets `sslmode=require`, and the port is always
written out (`:5432`), so a driver takes neither from anywhere else. The guard returns `targetUrl` and `sourceUrl`, rebuilt
from the parts it checked. **A run connects with those two strings and
never reads the environment again.**

`--dry-run` is the default. `--apply` writes. `--since <ISO-8601 instant>`
selects a delta run. `--report <path>` chooses where the report goes.

## When the guard refuses

Nothing has been connected to when a refusal is shown.

| Code                                       | What it means                                                                                                                                                             | What to do                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `TARGET_URL_MISSING`, `SOURCE_URL_MISSING` | `TARGET_DATABASE_URL` or `MVP_DATABASE_URL` is not set                                                                                                                    | Set it                                                                                          |
| `TARGET_URL_INVALID`, `SOURCE_URL_INVALID` | The URL is not a plain Postgres URL: a user, a password, exactly one `@`, one host, the default port, one database, no fragment                                           | Fix the URL; percent-encode special characters in the password (`@` as `%40`)                   |
| `URL_PARAMETER_NOT_ALLOWED`                | The URL carries a parameter other than `sslmode` and `channel_binding`                                                                                                    | Remove it                                                                                       |
| `URL_PARAMETER_VALUE_NOT_ALLOWED`          | `sslmode` or `channel_binding` is repeated or set to a value that weakens TLS                                                                                             | Use `sslmode=require` (or `verify-full`) and `channel_binding=require` (or `prefer`), each once |
| `URL_PASSWORD_NAMES_ENDPOINT`              | The password starts with `endpoint=` or `project=`                                                                                                                        | Use the plain password                                                                          |
| `TARGET_NOT_NEON`                          | The target host does not end in `.neon.tech`                                                                                                                              | Point `TARGET_DATABASE_URL` at the v3 Neon project                                              |
| `SOURCE_IS_TARGET`                         | Source and target are the same database                                                                                                                                   | Set `MVP_DATABASE_URL` to the MVP database                                                      |
| `SOURCE_IN_TARGET_PROJECT`                 | `MVP_DATABASE_URL` points into the v3 project                                                                                                                             | Set it to the MVP database                                                                      |
| `TARGET_HOST_POOLED`, `SOURCE_HOST_POOLED` | The URL uses a Neon pooled host (its name has `-pooler`). A migration needs a session of its own                                                                          | Use the direct host of the same database; the message names it for the target                   |
| `PG_VARIABLES_SET`                         | A `PG*` variable (`PGPORT`, `PGOPTIONS`, `PGPASSWORD`, …) is set. A Postgres driver would use it beside the connection strings the guard checks. Only the names are shown | Unset them for this run                                                                         |
| `TLS_CHECK_DISABLED`                       | `NODE_TLS_REJECT_UNAUTHORIZED` is `0`, which turns certificate checking off for the question to Neon and for any driver                                                   | Unset it for this run                                                                           |
| `NEON_PROJECT_MISSING`                     | `NEON_PROJECT_ID` is not set                                                                                                                                              | Set it to the v3 production project                                                             |
| `NEON_PROJECT_INVALID`                     | `NEON_PROJECT_ID` is not shaped like a project id (lower-case words and digits joined by dashes). It is not repeated in the message                                       | Check that the variables were not swapped                                                       |
| `NEON_API_KEY_MISSING`                     | `NEON_API_KEY` is not set, so Neon cannot be asked (no network call was made)                                                                                             | Set it to a key that can read the v3 project                                                    |
| `NEON_API_KEY_INVALID`                     | `NEON_API_KEY` has a space, a line break or another character a key never has, or is a connection string                                                                  | Set it to the key alone                                                                         |
| `NEON_LOOKUP_FAILED`                       | The Neon API could not be asked, or its answer could not be read                                                                                                          | Check `NEON_API_KEY` and `NEON_PROJECT_ID`, then run again                                      |
| `ENDPOINT_NOT_IN_PROJECT`                  | The target host is not an endpoint of `NEON_PROJECT_ID`                                                                                                                   | Check both variables                                                                            |
| `ENDPOINT_NOT_WRITABLE`                    | The target host is a read replica                                                                                                                                         | Use the read-write endpoint of the same branch                                                  |
| `BRANCH_UNKNOWN`                           | Neon did not say which branch the host belongs to, or the branch's name is not plain text                                                                                 | Run again; if it repeats, check the endpoint and the branch's name in the Neon console          |
| `DEFAULT_BRANCH_IN_BRANCH_MODE`            | A rehearsal was pointed at the production branch                                                                                                                          | Create a rehearsal branch and use its host                                                      |
| `HOST_NOT_ALLOWED`                         | The rehearsal host is not in `MIGRATION_ALLOWED_TARGET_HOSTS`                                                                                                             | Add it                                                                                          |
| `NOT_DEFAULT_BRANCH`                       | `--target production` was pointed at a branch that is not the default one                                                                                                 | Use the production branch's host, or run a rehearsal without `--target production`              |
| `PRODUCTION_NOT_CONFIRMED`                 | `MIGRATION_CONFIRM_PRODUCTION` is not today's date in UTC                                                                                                                 | Set it to the date in the message, for this run only                                            |
| `PRODUCTION_NOT_INTERACTIVE`               | No person is at the terminal                                                                                                                                              | Run it from a terminal, not a pipe or a CI job                                                  |
| `PROJECT_ID_NOT_TYPED`                     | The project id typed does not match `NEON_PROJECT_ID`                                                                                                                     | Run again and type the id                                                                       |

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
