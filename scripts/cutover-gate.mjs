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
 * - is on GitHub, authored AND committed by the owner's account,
 * - is signed by the owner's own key, one registered on that account.
 *   A commit made on github.com, or by a merge button, is signed by
 *   GitHub and not by the owner, and anyone holding the owner's GitHub
 *   login can make one: it does not count. The name and email typed into
 *   a commit are never believed,
 * - was made less than four hours ago.
 *
 * An approval is good for one run. Before the command starts, the gate
 * writes `<step> | started | <time> | <command>` to the log, and when it
 * ends, `<step> | executed | <time> | <command> | <evidence>` (or
 * `failed`, with the exit code or the signal). A run that failed may have
 * changed something, so it too needs a new approval to be tried again.
 * The gate also keeps its own note that an approval was used, where
 * `git stash` and `git reset` do not reach.
 *
 * What the command printed is kept in `<evidence>`, a file beside the log
 * that git ignores: output can hold secrets. The operator copies what is
 * safe into the log. For the same reason the gate refuses a command that
 * looks like it carries a secret on its command line: the command goes
 * into the log. That check is a net for the common shapes, not a proof.
 *
 * The command runs from the repository root, without a shell, and what
 * it prints goes through a pipe (it is not a terminal).
 *
 * Refusals exit with 2 and say why. Otherwise the gate exits as the
 * command did.
 *
 * What this is for: an operator, a person or an agent, who means well
 * and may take a chat message for an approval, use an old one again, or
 * run the wrong step. It does not stop someone who edits this file.
 */
import { execFileSync, spawn } from "node:child_process"
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(import.meta.dirname, "..")

/** The one account whose approval counts. */
export const OWNER = "rodrigobarona"
/** Where the approval's commit is looked up. Never read from a remote. */
export const REPOSITORY = `${OWNER}/elevacare-monorepo`
/** How long an approval is good for, from its commit. */
export const APPROVAL_GOOD_FOR_MS = 4 * 60 * 60 * 1000
/** A commit dated this far ahead of the clock here is not believed. */
const CLOCK_SLACK_MS = 5 * 60 * 1000

const OPERATOR_TASKS = "docs/eleva-v3/operator-tasks"
/** Beside the log, ignored by git (`.gitignore`). */
export const EVIDENCE_DIR = `${OPERATOR_TASKS}/cutover-evidence`

/** `B.2`, `B.1.a`, `C.4`, `B.9r`: a letter, then numbers and small letters. */
const STEP = /^[A-Z](?:\.[0-9]+[a-z]?|\.[a-z])+$/
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
 * that commit (see `githubCommit`), null when it is not there, and it
 * throws when GitHub could not be asked. `shallow()` says whether this
 * clone has only part of the history.
 *
 * Of several approval lines for one step, the last is the one read: an
 * approval given after a failed run is written below it.
 */
export async function checkApproval({
  step,
  logText,
  blame,
  commit,
  shallow = () => false,
  now,
}) {
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

  // With part of the history, git names the newest commit it has as the
  // writer of every older line: an old or foreign line would pass.
  if (await shallow()) {
    return refuse(
      "shallow-clone",
      "This clone has only part of the history, so git cannot say which commit wrote a line. Run `git fetch --unshallow` first."
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
      `GitHub has no commit ${sha.slice(0, 12)}, which wrote line ${approval.line}. The approval has to be pushed (and the \`gh\` login here must be able to read ${REPOSITORY}).`
    )
  }
  const who = (login) =>
    login ? `@${login}` : "an account GitHub does not know"
  if (found.authorLogin !== OWNER) {
    return refuse(
      "foreign-author",
      `Line ${approval.line} was written by ${who(found.authorLogin)}, not by @${OWNER}.`
    )
  }
  // Who made the commit, as opposed to who is named as its author. A
  // commit made on github.com or by a merge button is made by GitHub
  // ("web-flow"); one that someone rebased or amended is made by them.
  if (found.committerLogin !== OWNER) {
    return refuse(
      "not-own-commit",
      found.committerLogin === "web-flow"
        ? `Commit ${sha.slice(0, 12)} was made on github.com or by a merge: GitHub signed it, not @${OWNER}. An approval is a commit the owner makes and signs with their own key, then pushes.`
        : `Commit ${sha.slice(0, 12)} names @${OWNER} as its author and was made by ${who(found.committerLogin)}.`
    )
  }
  if (found.verified !== true || found.reason !== "valid") {
    return refuse(
      "not-signed",
      `Commit ${sha.slice(0, 12)} is not signed with a key GitHub knows as @${OWNER}'s${found.reason ? ` (GitHub says: ${found.reason})` : ""}. An approval has to be a signed commit.`
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

/** Not a secret, whatever the name before it says. */
const PLAIN_VALUE = /^(?:true|false|yes|no|on|off|\d{1,7})$/i
const SECRET_NAME =
  /(?:secret|token|password|passwd|private[_-]?key|api[_-]?key|auth)/i

/**
 * The first argument that looks like it carries a secret, or null. A net
 * for the common shapes: a key with a known prefix, a header that
 * authorises, `NAME=value` or `--name value` where the name says so, an
 * address with a password in it. It cannot know every secret.
 */
export function secretOnCommandLine(command) {
  for (const [index, argument] of command.entries()) {
    if (
      /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{8,}/.test(argument) ||
      /\b(?:sk|rk)_test_[A-Za-z0-9]{8,}/.test(argument) ||
      /\b(?:whsec|re)_[A-Za-z0-9]{8,}/.test(argument) ||
      /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/.test(argument) ||
      /^(?:authorization|x-api-key|x-auth-token)\s*:\s*\S+/i.test(argument) ||
      /:\/\/[^/\s:@]+:[^/\s@]+@/.test(argument)
    ) {
      return argument
    }
    // NAME=value, --name=value
    const assigned = argument.match(/^-{0,2}([A-Za-z0-9_.-]+)=(.+)$/)
    if (
      assigned &&
      SECRET_NAME.test(assigned[1]) &&
      !PLAIN_VALUE.test(assigned[2])
    ) {
      return argument
    }
    // --name value
    const next = command[index + 1]
    if (
      /^--?[A-Za-z]/.test(argument) &&
      SECRET_NAME.test(argument) &&
      next !== undefined &&
      !next.startsWith("-") &&
      !PLAIN_VALUE.test(next)
    ) {
      return argument
    }
  }
  return null
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

/** How a run ended, as the end of its log line and as an exit code. */
function ending(result) {
  const { code, signal } =
    typeof result === "number" ? { code: result, signal: null } : result
  if (signal) {
    const exit = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 }[signal] ?? 128
    return { ok: false, tail: `signal ${signal}`, exit }
  }
  return { ok: code === 0, tail: `exit ${code}`, exit: code }
}

/**
 * The whole gate, with everything it touches handed in. `readLog`,
 * `appendLog` and `blame` take the moment the run began, which names the
 * day's log, so a run that crosses midnight does not change files.
 * - `readLog(day)`: the text of that day's log, or null when there is none
 * - `appendLog(day, line)`: adds one line to it
 * - `blame(day, line)`, `commit(sha)`, `shallow()`: see `checkApproval`
 * - `claim(step, sha, line)`: notes that this approval is being used;
 *   false when it was noted before
 * - `run(command, evidence)`: runs it, keeps what it printed at
 *   `evidence`, and gives back `{ code, signal }`
 * - `say(message)`: tells the operator
 *
 * Gives back the exit code for the process.
 */
export async function gate({ step, command, now, deps }) {
  const { readLog, appendLog, blame, commit, shallow, claim, run, say } = deps
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
  if (secretOnCommandLine(command)) {
    say(
      "The command looks like it carries a secret on its command line, and the command is written to the log. Give it through the environment of this shell."
    )
    return 2
  }

  const started = now()
  const verdict = await checkApproval({
    step,
    logText: readLog(started),
    blame: (line) => blame(started, line),
    commit,
    shallow,
    now: started,
  })
  if (!verdict.ok) {
    say(`Refused (${verdict.reason}): ${verdict.message}`)
    return 2
  }
  // The lines the gate writes to the log are not committed yet, and a
  // `git stash` takes them away. This note is kept where it does not.
  if (!claim(step, verdict.sha, verdict.line)) {
    say(
      `Refused (used): the approval on line ${verdict.line} was used by a run on this machine, though the log no longer says so. Running ${step} again needs a new approval line.`
    )
    return 2
  }

  const text = commandText(command)
  const stamp = started.toISOString().replace(/[-:]/g, "")
  const evidence = `${EVIDENCE_DIR}/${started.toISOString().slice(0, 10)}/${step}-${stamp}.log`
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

  let result
  try {
    result = await run(command, evidence)
  } catch (err) {
    say(
      `${step} could not be started: ${err instanceof Error ? err.message : err}`
    )
    result = 127
  }
  const end = ending(result)
  const ended = now()
  appendLog(
    started,
    end.ok
      ? `${step} | executed | ${ended.toISOString()} | ${text} | ${evidence}`
      : `${step} | failed | ${ended.toISOString()} | ${text} | ${evidence} | ${end.tail}`
  )
  say(
    end.ok
      ? `${step} ran. What it printed is in ${evidence} (not in git: copy what is safe into the log). Commit the log and push it now, before the next approval is asked for.`
      : `${step} failed (${end.tail}). What it printed is in ${evidence}. It may have changed something: look, commit the log and push it, then ask for a new approval.`
  )
  return end.exit
}

const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

/** Which commit wrote line `line` of `file`, or null when none did. */
export function blameLine(root, file, line) {
  let out
  try {
    out = git(root, [
      "blame",
      "--porcelain",
      "-L",
      `${line},${line}`,
      "--",
      file,
    ])
  } catch {
    // Not tracked, or no such line.
    return null
  }
  const sha = out.split(/\s/)[0] ?? ""
  // Forty zeros is git's name for "not committed yet".
  return /^[0-9a-f]{40}$/.test(sha) && !/^0+$/.test(sha) ? sha : null
}

/** Whether this clone has only part of the history. Unsure counts as yes. */
export function isShallow(root) {
  try {
    return (
      git(root, ["rev-parse", "--is-shallow-repository"]).trim() !== "false"
    )
  } catch {
    return true
  }
}

/**
 * What GitHub knows of a commit; null when it has no such commit.
 * `authorLogin` and `committerLogin` are the accounts GitHub ties the
 * commit to (not the names typed into it); `verified` and `reason` are
 * its judgement of the signature.
 */
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
    throw new Error(said.trim().split("\n")[0] || "gh did not answer", {
      cause: err,
    })
  }
  const data = JSON.parse(out)
  return {
    authorLogin: data?.author?.login ?? null,
    committerLogin: data?.committer?.login ?? null,
    verified: data?.commit?.verification?.verified === true,
    reason: data?.commit?.verification?.reason ?? null,
    committerDate: data?.commit?.committer?.date ?? null,
  }
}

/** Notes that an approval is being used. False when it was noted before. */
export function claimApproval(root, step, sha, line) {
  const file = path.join(root, EVIDENCE_DIR, "used", `${step}-${sha}-${line}`)
  mkdirSync(path.dirname(file), { recursive: true })
  try {
    // `wx`: fails when the note is there, so two runs started together
    // cannot both take the approval.
    writeFileSync(file, `${new Date().toISOString()}\n`, { flag: "wx" })
    return true
  } catch (err) {
    if (err?.code === "EEXIST") return false
    throw err
  }
}

const PASSED_ON = ["SIGINT", "SIGTERM", "SIGHUP"]

/**
 * Runs a command (no shell), shows what it prints and keeps it in
 * `evidence`. A signal sent to the gate is passed on, and the gate waits
 * for the command to end, so that the log gets its closing line.
 */
export function runAndKeep(root, command, evidence) {
  const file = path.join(root, evidence)
  mkdirSync(path.dirname(file), { recursive: true })
  const kept = createWriteStream(file, { flags: "a" })
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: root,
      stdio: ["inherit", "pipe", "pipe"],
    })
    const passOn = Object.fromEntries(
      PASSED_ON.map((signal) => [signal, () => child.kill(signal)])
    )
    for (const signal of PASSED_ON) process.on(signal, passOn[signal])
    const done = (finish) => {
      for (const signal of PASSED_ON) process.off(signal, passOn[signal])
      kept.end(finish)
    }
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk)
      kept.write(chunk)
    })
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk)
      kept.write(chunk)
    })
    child.on("error", (err) => done(() => reject(err)))
    child.on("close", (code, signal) => done(() => resolve({ code, signal })))
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
  const log = (day) => path.join(ROOT, logPathFor(day))
  return gate({
    step,
    command,
    now: () => new Date(),
    deps: {
      readLog: (day) =>
        existsSync(log(day)) ? readFileSync(log(day), "utf8") : null,
      appendLog: (day, line) => {
        const text = readFileSync(log(day), "utf8")
        appendFileSync(log(day), `${text.endsWith("\n") ? "" : "\n"}${line}\n`)
      },
      blame: (day, line) => blameLine(ROOT, logPathFor(day), line),
      commit: (sha) => githubCommit(sha),
      shallow: () => isShallow(ROOT),
      claim: (claimed, sha, line) => claimApproval(ROOT, claimed, sha, line),
      run: (toRun, evidence) => runAndKeep(ROOT, toRun, evidence),
      say: (message) => console.error(`[cutover:gate] ${message}`),
    },
  })
}

/**
 * Whether this file is what was run (and not imported by a test). By the
 * real path on both sides: through a symbolic link the two spellings
 * differ, and a gate that then did nothing and exited 0 would read as a
 * step that ran.
 */
function isRunDirectly() {
  if (!process.argv[1]) return false
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    )
  } catch {
    return false
  }
}

if (isRunDirectly()) {
  process.exitCode = await main(process.argv.slice(2))
}
