import { runMigrationCommand } from "./cli"
import { createNeonEndpointResolver } from "./neon-api"
import { askOnTerminal } from "./terminal"

/**
 * The real process around `runMigrationCommand`: its arguments, the
 * environment the operator set for this run (no `.env` file is loaded
 * here), the terminal, and the exit status. The only file in the package
 * that reads the process's environment or arguments, and the only one
 * that builds the real question to Neon.
 */
const status = await runMigrationCommand(process.argv.slice(2), process.env, {
  createResolver: (options) => createNeonEndpointResolver(options),
  // Asked on standard error, so standard output stays the summary line.
  prompt: (question) =>
    askOnTerminal({ input: process.stdin, output: process.stderr }, question),
  isInteractive: () => process.stdin.isTTY === true,
  now: () => new Date(),
  out: (line) => void process.stdout.write(`${line}\n`),
  err: (line) => void process.stderr.write(`${line}\n`),
})
// Only a status the table knows is passed on; anything else is a bug and
// ends as one. Nothing but an approval can end as 0.
process.exitCode = status === 0 || status === 2 || status === 3 ? status : 1
