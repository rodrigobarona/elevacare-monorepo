#!/usr/bin/env node
/**
 * The cutover gate (Phase 15.2, ADR-019): one approval per production
 * change, kept by the repository and not by a chat.
 *
 *   pnpm cutover:gate <step> -- <command...>
 *
 * It runs `<command>` only when today's cutover log
 * (`docs/eleva-v3/operator-tasks/cutover-log-YYYY-MM-DD.md`, one file per
 * UTC day) holds this line for `<step>`:
 *
 *   <step> | approved | @rodrigobarona | <ISO-8601 UTC>
 *
 * and the commit that wrote that very line (found with `git blame`, so a
 * later commit to the file changes nothing):
 * - is on GitHub, by the owner's account,
 * - is signed with a key GitHub knows as theirs (the name and email typed
 *   into a commit are never believed),
 * - was made less than four hours ago.
 *
 * An approval is good for one run. Before the command starts, the gate
 * writes `<step> | started | <time> | <command>` to the log, and when it
 * ends, `<step> | executed | <time> | <command> | <evidence>` (or
 * `failed`, with the exit code). A run that failed may have changed
 * something, so it too needs a new approval to be tried again.
 *
 * What the command printed is kept in `<evidence>`, a file beside the log
 * that git ignores: output can hold secrets. The operator copies what is
 * safe into the log. For the same reason the gate refuses a command with
 * a secret written on its command line: the command goes into the log.
 *
 * Refusals exit with 2 and say why. Otherwise the gate exits as the
 * command did.
 */
import { execFileSync, spawn } from "node:child_process"
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const ROOT = path.resolve(import.meta.dirname, "..")

/** The one account whose approval counts. */
export const OWNER = "rodrigobarona"
/** Where the approval's commit is looked up. */
export const REPOSITORY = "rodrigobarona/elevacare-monorepo"
/** How long an approval is good for, from its commit. */
export const APPROVAL_GOOD_FOR_MS = 4 * 60 * 60 * 1000
/** A commit dated this far ahead of the clock here is not believed. */
const CLOCK_SLACK_MS = 5 * 60 * 1000

const OPERATOR_TASKS = "docs/eleva-v3/operator-tasks"
/** Beside the log, ignored by git (`.gitignore`). */
export const EVIDENCE_DIR = `${OPERATOR_TASKS}/cutover-evidence`

/** `B.1.a`, `B.2`, `C.4`: a letter, then numbers and small letters. */
const STEP = /^[A-Z](?:\.[0-9]+|\.[a-z])+$/
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

export function isStep(step) {
  return typeof step === "string" && STEP.test(step)
}

/** The log of one UTC day, as a path from the repository root. */
export function logPathFor(now) {
  return `${OPERATOR_TASKS}/cutover-log-${now.toISOString().slice(0, 10)}.md`
}

/**
 * The lines of a log that are the gate's own, in order. Anything else in
 * the file (a heading, a note, pasted evidence) is not read.
 */
export function parseLog(text) {
  return text.split("\n").flatMap((raw, index) => {
    const parts = raw.split(" | ")
    const [step, kind] = parts
    if (!isStep(step)) return []
    if (kind === "approved" && parts.length === 4) {
      return [{ line: index + 1, step, kind, by: parts[2], at: parts[3] }]
    }
    if (["started", "executed", "failed"].includes(kind) && parts.length >= 4) {
      return [{ line: index + 1, step, kind, at: parts[2] }]
    }
    return []
  })
}

const refuse = (reason, message) => ({ ok: false, reason, message })

/**
 * Whether `step` may run now.
 *
 * `blame(line)` says which commit wrote that line of the log, or null for
 * a line that is not committed. `commit(sha)` says what GitHub knows of
 * that commit: `{ authorLogin, verified, committerDate }`, null when it
 * is not there, and it throws when GitHub could not be asked.
 */
export async function checkApproval({ step, logText, blame, commit, now }) {
  if (logText === null) {
    return refuse(
      "no-log",
      `There is no cutover log for today (${logPathFor(now)}). The owner adds the approval line to it.`
    )
  }
  const entries = parseLog(logText).filter((entry) => entry.step === step)
  const approvals = entries.filter((entry) => entry.kind === "approved")
  const approval = approvals.at(-1)
  if (!approval) {
    return refuse(
      "no-approval",
      `Today's log has no approval for ${step}. It needs the line: ${step} | approved | @${OWNER} | <time>`
    )
  }
  if (approval.by !== `@${OWNER}`) {
    return refuse(
      "not-owner",
      `Line ${approval.line} is an approval by ${approval.by}. Only @${OWNER} approves a cutover step.`
    )
  }
  if (!TIME.test(approval.at) || Number.isNaN(Date.parse(approval.at))) {
    return refuse(
      "bad-time",
      `Line ${approval.line} does not end with a time such as 2026-12-01T09:30:00Z.`
    )
  }
  // One approval, one run: anything the gate wrote for this step after
  // the approval means it was used, however that run ended.
  const used = entries.find(
    (entry) => entry.kind !== "approved" && entry.line > approval.line
  )
  if (used) {
    return refuse(
      "used",
      `The approval on line ${approval.line} was used (line ${used.line}: ${used.kind}). Running ${step} again needs a new approval line.`
    )
  }

  const sha = await blame(approval.line)
  if (!sha) {
    return refuse(
      "not-committed",
      `Line ${approval.line} is in the file and not in a commit. An approval counts once the owner has committed and pushed it.`
    )
  }
  let found
  try {
    found = await commit(sha)
  } catch (err) {
    return refuse(
      "github-unreachable",
      `GitHub could not be asked about commit ${sha.slice(0, 12)} (${err instanceof Error ? err.message : err}). Nothing runs on an approval that cannot be checked.`
    )
  }
  if (!found) {
    return refuse(
      "not-on-github",
      `Commit ${sha.slice(0, 12)}, which wrote line ${approval.line}, is not on GitHub. The approval has to be pushed.`
    )
  }
  if (found.authorLogin !== OWNER) {
    return refuse(
      "foreign-author",
      `Line ${approval.line} was committed by ${found.authorLogin ? `@${found.authorLogin}` : "an account GitHub does not know"}, not by @${OWNER}.`
    )
  }
  if (found.verified !== true) {
    return refuse(
      "not-signed",
      `Commit ${sha.slice(0, 12)} is not signed with a key GitHub knows as @${OWNER}'s. An approval has to be a verified commit.`
    )
  }
  const committed = Date.parse(found.committerDate ?? "")
  if (Number.isNaN(committed)) {
    return refuse(
      "bad-time",
      `Commit ${sha.slice(0, 12)} has no date that can be read.`
    )
  }
  const age = now.getTime() - committed
  if (age < -CLOCK_SLACK_MS) {
    return refuse(
      "from-the-future",
      `Commit ${sha.slice(0, 12)} is dated ${found.committerDate}, which is after now. Check the clock here.`
    )
  }
  if (age > APPROVAL_GOOD_FOR_MS) {
    const hours = Math.floor(age / (60 * 60 * 1000))
    return refuse(
      "stale",
      `The approval on line ${approval.line} was committed ${hours} hours ago. One is good for four hours: ask the owner for a new line.`
    )
  }
  return { ok: true, line: approval.line, sha }
}

/** Shapes that are secrets, and names that hold one, on a command line. */
const SECRET_SHAPES = [
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/,
  /\bwhsec_[A-Za-z0-9]{8,}/,
  /\bBearer\s+\S{8,}/i,
  /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z0-9_]*=\S+/,
]

/** The first argument that carries a secret, or null. */
export function secretOnCommandLine(command) {
  return (
    command.find((argument) =>
      SECRET_SHAPES.some((shape) => shape.test(argument))
    ) ?? null
  )
}

/** A command as one line of text: quoted where it has to be. */
export function commandText(command) {
  return command
    .map((argument) =>
      /^[A-Za-z0-9_./:=@%+,-]+$/.test(argument)
        ? argument
        : JSON.stringify(argument)
    )
    .join(" ")
}

/**
 * The whole gate, with everything it touches handed in:
 * - `readLog(day)`: the text of that day's log, or null when there is none
 * - `appendLog(day, line)`: adds one line to it
 * - `blame(day, line)`, `commit(sha)`: see `checkApproval`; `readLog`,
 *   `appendLog` and `blame` take the moment the run began, which names
 *   the day's log
 * - `run(command, evidence)`: runs it, keeps what it printed at
 *   `evidence`, and gives back its exit code
 * - `say(message)`: tells the operator
 *
 * Gives back the exit code for the process.
 */
export async function gate({ step, command, now, deps }) {
  const { readLog, appendLog, blame, commit, run, say } = deps
  if (!isStep(step)) {
    say(
      `"${step ?? ""}" is not a step such as B.2 or B.1.a. Usage: pnpm cutover:gate <step> -- <command...>`
    )
    return 2
  }
  if (!Array.isArray(command) || command.length === 0) {
    say(
      `No command to run for ${step}. Usage: pnpm cutover:gate <step> -- <command...>`
    )
    return 2
  }
  if (command.some((argument) => /[\r\n]/.test(argument))) {
    say("A command with a line break in it cannot be written to the log.")
    return 2
  }
  const secret = secretOnCommandLine(command)
  if (secret) {
    say(
      "The command carries a secret on its command line, and the command is written to the log. Give it through the environment of this shell."
    )
    return 2
  }

  const started = now()
  const verdict = await checkApproval({
    step,
    logText: readLog(started),
    // The log of the day the run began, to its end: a run that crosses
    // midnight does not change files.
    blame: (line) => blame(started, line),
    commit,
    now: started,
  })
  if (!verdict.ok) {
    say(`Refused (${verdict.reason}): ${verdict.message}`)
    return 2
  }

  const text = commandText(command)
  const stamp = started.toISOString().replace(/[-:]/g, "").slice(0, 15)
  const evidence = `${EVIDENCE_DIR}/${started.toISOString().slice(0, 10)}/${step}-${stamp}Z.log`
  // Written before the command starts: a command that changed something
  // and then lost its connection is still on record.
  try {
    appendLog(started, `${step} | started | ${started.toISOString()} | ${text}`)
  } catch (err) {
    say(
      `Refused: the log could not be written (${err instanceof Error ? err.message : err}), and nothing runs without a record.`
    )
    return 2
  }
  say(
    `Approved on line ${verdict.line} (commit ${verdict.sha.slice(0, 12)}). Running ${step}: ${text}`
  )

  let exit
  try {
    exit = await run(command, evidence)
  } catch (err) {
    say(
      `${step} could not be started: ${err instanceof Error ? err.message : err}`
    )
    exit = 127
  }
  const ended = now()
  appendLog(
    started,
    exit === 0
      ? `${step} | executed | ${ended.toISOString()} | ${text} | ${evidence}`
      : `${step} | failed | ${ended.toISOString()} | ${text} | ${evidence} | exit ${exit}`
  )
  say(
    exit === 0
      ? `${step} ran. What it printed is in ${evidence} (not in git: copy what is safe into the log, then commit the log).`
      : `${step} failed with exit ${exit}. What it printed is in ${evidence}. It may have changed something: look before asking for a new approval.`
  )
  return exit
}

/** Which commit wrote line `line` of `file`, or null when none did. */
export function blameLine(root, file, line) {
  let out
  try {
    out = execFileSync(
      "git",
      ["blame", "--porcelain", "-L", `${line},${line}`, "--", file],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    )
  } catch {
    // Not tracked, or no such line.
    return null
  }
  const sha = out.split(/\s/)[0] ?? ""
  // Forty zeros is git's name for "not committed yet".
  return /^[0-9a-f]{40}$/.test(sha) && !/^0+$/.test(sha) ? sha : null
}

/** What GitHub knows of a commit; null when it has no such commit. */
export function githubCommit(sha, { exec = execFileSync } = {}) {
  let out
  try {
    out = exec("gh", ["api", `repos/${REPOSITORY}/commits/${sha}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (err) {
    const said = `${err?.stderr ?? ""}${err?.stdout ?? ""}`
    if (/HTTP 404|HTTP 422|No commit found/i.test(said)) return null
    throw new Error(said.trim().split("\n")[0] || "gh did not answer")
  }
  const data = JSON.parse(out)
  return {
    authorLogin: data?.author?.login ?? null,
    verified: data?.commit?.verification?.verified === true,
    committerDate: data?.commit?.committer?.date ?? null,
  }
}

/** Runs a command, shows what it prints and keeps it in `evidence`. */
function runAndKeep(root, command, evidence) {
  const file = path.join(root, evidence)
  mkdirSync(path.dirname(file), { recursive: true })
  const kept = createWriteStream(file, { flags: "a" })
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: root,
      stdio: ["inherit", "pipe", "pipe"],
    })
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk)
      kept.write(chunk)
    })
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk)
      kept.write(chunk)
    })
    child.on("error", (err) => kept.end(() => reject(err)))
    child.on("close", (code, signal) =>
      kept.end(() => resolve(code ?? (signal ? 128 : 1)))
    )
  })
}

/**
 * `<step> -- <command...>`. The first `--` only: the command may have
 * its own (`pnpm stripe:setup:webhooks -- --apply`). Some runners take
 * that first `--` away before the script sees it, so it may be absent.
 */
export function readArguments(argv) {
  const [step, ...rest] = argv
  return { step, command: rest[0] === "--" ? rest.slice(1) : rest }
}

function main(argv) {
  const { step, command } = readArguments(argv)
  const file = (when) => logPathFor(when)
  return gate({
    step,
    command,
    now: () => new Date(),
    deps: {
      readLog: (when) => {
        const full = path.join(ROOT, file(when))
        return existsSync(full) ? readFileSync(full, "utf8") : null
      },
      appendLog: (when, line) => {
        const full = path.join(ROOT, file(when))
        const text = readFileSync(full, "utf8")
        appendFileSync(full, `${text.endsWith("\n") ? "" : "\n"}${line}\n`)
      },
      blame: (when, line) => blameLine(ROOT, file(when), line),
      commit: (sha) => githubCommit(sha),
      run: (toRun, evidence) => runAndKeep(ROOT, toRun, evidence),
      say: (message) => console.error(`[cutover:gate] ${message}`),
    },
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(process.argv.slice(2))
}
