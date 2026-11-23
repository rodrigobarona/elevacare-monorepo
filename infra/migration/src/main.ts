import { createInterface } from "node:readline/promises"
import { runMigrationCommand } from "./cli"
import { createNeonEndpointResolver } from "./neon-api"

/**
 * The real process around `runMigrationCommand`: its arguments, the
 * environment the operator set for this run (no `.env` file is loaded
 * here), the terminal, and the exit status.
 */
process.exitCode = await runMigrationCommand(
  process.argv.slice(2),
  process.env,
  {
    createResolver: (options) => createNeonEndpointResolver(options),
    // Asked on standard error, so standard output stays the one summary
    // line. The reader is closed, or the process would never end.
    prompt: async (question) => {
      const terminal = createInterface({
        input: process.stdin,
        output: process.stderr,
      })
      try {
        return await terminal.question(question)
      } finally {
        terminal.close()
      }
    },
    isInteractive: () => process.stdin.isTTY === true,
    now: () => new Date(),
    out: (line) => void process.stdout.write(`${line}\n`),
    err: (line) => void process.stderr.write(`${line}\n`),
  }
)
