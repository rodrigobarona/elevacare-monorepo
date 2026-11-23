#!/usr/bin/env node
/**
 * The cutover gate (Phase 15.2, ADR-019): one approval per production
 * change, kept by the repository and not by a chat.
 *
 *   pnpm cutover:gate propose <step> -- <command...>
 *   pnpm cutover:gate <step> -- <command...>
 *
 * Today's cutover log is
 * `docs/eleva-v3/operator-tasks/cutover-log-YYYY-MM-DD.md` (one file per
 * UTC day). A step goes through it in three lines:
 *
 *   <step> | proposed | <time> | <command>        the operator (propose)
 *   <step> | approved | @rodrigobarona | <time>   the owner, below it
 *   <step> | started | <time> | <command> | ...   the gate, when it runs
 *
 * The gate runs `<command>` only when:
 * - it is, word for word, the command proposed above the approval, and
 *   that proposal was committed before the approval and not touched
 *   since: the owner approves what they read in the file, not what a
 *   chat said;
 * - the commit that wrote the approval line (found with `git blame`, so
 *   a later commit to the file changes nothing):
 *   - is on GitHub, authored AND committed by the owner's account,
 *   - is signed by a key registered on that account. A commit made on
 *     github.com, or by a merge button, is signed by GitHub and not by
 *     the owner, and anyone holding the owner's GitHub login can make
 *     one: it does not count. The name and email typed into a commit
 *     are never believed,
 *   - was made less than four hours ago;
 * - the `gh` login here cannot add a signing key to the owner's account
 *   (or it could sign as the owner).
 *
 * An approval is good for one run. Before the command starts, the gate
 * writes the `started` line, and when it ends,
 * `<step> | executed | <time> | <command> | <evidence>` (or `failed`,
 * with the exit code or the signal). A run that failed may have changed
 * something, so it too needs a new approval to be tried again. The gate
 * also keeps a note that an approval was used inside `.git`, where
 * `git stash`, `git reset` and `git clean` do not reach and every
 * worktree of the clone sees it.
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
 * and may take a chat message for an approval, use an old one again, run
 * another command than the one approved, or write the approval
 * themselves with the owner's GitHub login. It does not stop someone who
 * edits this file, and it is as strong as the owner's signing key is out
 * of the operator's reach.
 */
import { execFileSync, spawn } from "node:child_process"
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
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
/** With one of these a `gh` login can add a signing key to the account. */
export const SIGNING_KEY_SCOPES = [
  "admin:ssh_signing_key",
  "write:ssh_signing_key",
  "admin:gpg_key",
  "write:gpg_key",
]

const OPERATOR_TASKS = "docs/eleva-v3/operator-tasks"
/** Beside the log, ignored by git (`.gitignore`). */
export const EVIDENCE_DIR = `${OPERATOR_TASKS}/cutover-evidence`
/** Inside the clone's `.git`: the approvals that were used. */
const USED_DIR = "cutover-gate-used"

/** `B.2`, `B.1.a`, `C.4`, `B.9r`: a letter, then numbers and small letters. */
const STEP = /^[A-Z](?:\.[0-9]+[a-z]?|\.[a-z])+$/
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const RUN_KINDS = ["started", "executed", "failed"]

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
    const line = index + 1
    if (kind === "approved" && parts.length === 4) {
      return [{ line, step, kind, by: parts[2], at: parts[3] }]
    }
    if (kind === "proposed" && parts.length >= 4) {
      // The command may hold the separator itself: it is the rest.
      const command = parts.slice(3).join(" | ")
      return [{ line, step, kind, at: parts[2], command }]
    }
    if (RUN_KINDS.includes(kind) && parts.length >= 4) {
      return [{ line, step, kind, at: parts[2] }]
    }
    return []
  })
}

const refuse = (reason, message) => ({ ok: false, reason, message })

/**
 * Whether `step` may run `command` (as `commandText` writes it) now.
 *
 * - `blame(line)`: which commit wrote that line of today's log, as
 *   `{ sha, file }`; null for a line that is not committed
 * - `ancestor(older, newer)`: whether `older` is `newer` or came before it
 * - `commit(sha)`: what GitHub knows of that commit (see `githubCommit`),
 *   null when it is not there; throws when GitHub could not be asked
 * - `scopes()`: what the `gh` login here may do; throws likewise
 * - `shallow()`: whether this clone has only part of the history
 *
 * Of several approval lines for one step, the last is the one read: an
 * approval given after a failed run is written below it.
 */
export async function checkApproval({
  step,
  command,
  logText,
  logPath,
  blame,
  ancestor,
  commit,
  scopes = () => [],
  shallow = () => false,
  now,
}) {
  if (logText === null) {
    return refuse(
      "no-log",
      `There is no cutover log for today (${logPathFor(now)}). Start with: pnpm cutover:gate propose ${step} -- <command...>`
    )
  }
  const entries = parseLog(logText).filter((entry) => entry.step === step)
  const approval = entries.filter((entry) => entry.kind === "approved").at(-1)
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
      `Line ${approval.line} does not end with a time such as 2026-12-01T09:30:00Z (and nothing after it: a file saved with Windows line ends reads wrong here).`
    )
  }
  // One approval, one run: anything the gate wrote for this step after
  // the approval means it was used, however that run ended.
  const used = entries.find(
    (entry) => RUN_KINDS.includes(entry.kind) && entry.line > approval.line
  )
  if (used) {
    return refuse(
      "used",
      `The approval on line ${approval.line} was used (line ${used.line}: ${used.kind}). Running ${step} again needs a new approval line.`
    )
  }
  // The owner approves a command they read in the file.
  const proposal = entries
    .filter((entry) => entry.kind === "proposed" && entry.line < approval.line)
    .at(-1)
  if (!proposal) {
    return refuse(
      "no-proposal",
      `The approval on line ${approval.line} has no proposed command above it, so it says "yes" to nothing in particular. Propose first: pnpm cutover:gate propose ${step} -- <command...>`
    )
  }
  if (proposal.command !== command) {
    return refuse(
      "not-the-approved-command",
      `The owner approved (line ${proposal.line}): ${proposal.command}\nThis is another command: ${command}\nPropose this one and ask again, or run the one that was approved.`
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
  const wrote = await blame(approval.line)
  if (!wrote) {
    return refuse(
      "not-committed",
      `Line ${approval.line} is in the file and not in a commit. An approval counts once the owner has committed and pushed it.`
    )
  }
  // A file moved to today's name keeps its old lines and their commits.
  if (wrote.file !== logPath) {
    return refuse(
      "another-days-log",
      `Line ${approval.line} was committed in ${wrote.file}, not in today's log. An approval is given in the log of the day it is used.`
    )
  }
  const proposed = await blame(proposal.line)
  if (
    !proposed ||
    proposed.file !== logPath ||
    !(await ancestor(proposed.sha, wrote.sha))
  ) {
    return refuse(
      "proposal-changed",
      `The proposed command on line ${proposal.line} was written or changed after the approval on line ${approval.line} was committed. The owner has not seen it: ask for a new approval.`
    )
  }
  const { sha } = wrote

  let found
  let allowed
  try {
    allowed = await scopes()
    found = await commit(sha)
  } catch (err) {
    return refuse(
      "github-unreachable",
      `GitHub could not be asked about commit ${sha.slice(0, 12)} (${err instanceof Error ? err.message : err}). Nothing runs on an approval that cannot be checked.`
    )
  }
  // A login that can add a signing key to the owner's account can sign
  // as the owner: then a signature proves nothing here.
  const canAddKeys = allowed.filter((scope) =>
    SIGNING_KEY_SCOPES.includes(scope)
  )
  if (canAddKeys.length > 0) {
    return refuse(
      "login-can-add-keys",
      `The gh login on this machine may add a signing key to the account (${canAddKeys.join(", ")}), so it could sign as @${OWNER}. Sign in again without that: gh auth refresh --remove-scopes ${canAddKeys.join(",")}`
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
      `Line ${approval.line} was written by ${who(found.authorLogin)}, not by @${OWNER}. (GitHub goes by the email in the commit: it has to be one verified on the owner's account.)`
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
/** Names that hold a secret. Not "auth" alone: `--author`, `BETTER_AUTH_URL`. */
const SECRET_NAME =
  /(?:secret|token|password|passwd|private[_-]?key|signing[_-]?key|api[_-]?key|access[_-]?key)/i

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
      /\b(?:whsec|re|ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{8,}/.test(argument) ||
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./.test(argument) ||
      /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/.test(argument) ||
      /^(?:authorization|cookie|x-api-key|x-auth-token)\s*:\s*\S+/i.test(
        argument
      ) ||
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
    const next = command[index + 1]
    // curl's `-u user:password`
    if (/^(?:-u|--user)$/.test(argument) && /:.+/.test(next ?? "")) {
      return argument
    }
    // --name value
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

/** What is wrong with a step and a command before the log is read, or null. */
function unusable(step, command) {
  if (!isStep(step)) {
    return `"${step ?? ""}" is not a step such as B.2 or B.1.a. Usage: pnpm cutover:gate [propose] <step> -- <command...>`
  }
  if (!Array.isArray(command) || command.length === 0) {
    return `No command for ${step}. Usage: pnpm cutover:gate [propose] <step> -- <command...>`
  }
  if (command.some((argument) => /[\r\n]/.test(argument))) {
    return "A command with a line break in it cannot be written to the log."
  }
  if (secretOnCommandLine(command)) {
    return "The command looks like it carries a secret on its command line, and the command is written to the log. Give it through the environment of this shell."
  }
  return null
}

/**
 * Writes the command an operator wants approved to today's log (making
 * the file when the day has none). Nothing runs. Gives back an exit code.
 */
export function propose({ step, command, now, deps }) {
  const { readLog, writeLog, appendLog, say } = deps
  const problem = unusable(step, command)
  if (problem) {
    say(problem)
    return 2
  }
  const at = now()
  const file = logPathFor(at)
  if (readLog(at) === null) {
    writeLog(at, `# Cutover log ${at.toISOString().slice(0, 10)}\n\n`)
  }
  const text = commandText(command)
  appendLog(at, `${step} | proposed | ${at.toISOString()} | ${text}`)
  say(
    [
      `Proposed ${step}: ${text}`,
      `Now commit and push the log, and stop:`,
      `  git add ${file} && git commit -m "docs(p15): propose cutover step ${step}" && git push`,
      `The owner pulls, adds this line below it, commits it signed and pushes:`,
      `  ${step} | approved | @${OWNER} | ${at.toISOString().slice(0, 19)}Z   (the time they approve)`,
      `  git commit -S -am "docs(p15): approve cutover step ${step}" && git push`,
      `Then pull and run: pnpm cutover:gate ${step} -- ${text}`,
    ].join("\n")
  )
  return 0
}

/**
 * The whole gate, with everything it touches handed in. `readLog`,
 * `appendLog` and `blame` take the moment the run began, which names the
 * day's log, so a run that crosses midnight does not change files.
 * - `readLog(day)`: the text of that day's log, or null when there is none
 * - `appendLog(day, line)`: adds one line to it
 * - `blame(day, line)`, `ancestor`, `commit`, `scopes`, `shallow`: see
 *   `checkApproval`
 * - `claim(step, sha)`: notes that this approval is being used; false
 *   when it was noted before. `release(step, sha)` takes the note back
 * - `run(command, evidence)`: runs it, keeps what it printed at
 *   `evidence`, and gives back `{ code, signal }`
 * - `say(message)`: tells the operator
 *
 * Gives back the exit code for the process.
 */
export async function gate({ step, command, now, deps }) {
  const { readLog, appendLog, blame, claim, release, run, say } = deps
  const problem = unusable(step, command)
  if (problem) {
    say(problem)
    return 2
  }

  const started = now()
  const text = commandText(command)
  const verdict = await checkApproval({
    step,
    command: text,
    logText: readLog(started),
    logPath: logPathFor(started),
    blame: (line) => blame(started, line),
    ancestor: deps.ancestor,
    commit: deps.commit,
    scopes: deps.scopes,
    shallow: deps.shallow,
    now: started,
  })
  if (!verdict.ok) {
    say(`Refused (${verdict.reason}): ${verdict.message}`)
    return 2
  }
  // The lines the gate writes to the log are not committed yet, and a
  // `git stash` takes them away. This note is kept where it does not.
  if (!claim(step, verdict.sha)) {
    say(
      `Refused (used): the approval on line ${verdict.line} was used by a run in this clone, though the log no longer says so. Running ${step} again needs a new approval line.`
    )
    return 2
  }

  const stamp = started.toISOString().replace(/[-:]/g, "")
  const evidence = `${EVIDENCE_DIR}/${started.toISOString().slice(0, 10)}/${step}-${stamp}.log`
  // Written before the command starts: a command that changed something
  // and then lost its connection is still on record. With the approving
  // commit, which a later squash of the branch would not show.
  try {
    appendLog(
      started,
      `${step} | started | ${started.toISOString()} | ${text} | approval ${verdict.sha}`
    )
  } catch (err) {
    // Nothing ran: the approval is not spent.
    release(step, verdict.sha)
    say(
      `Refused: the log could not be written (${err instanceof Error ? err.message : err}), and nothing runs without a record. The approval is still good.`
    )
    return 2
  }
  say(
    `Approved on line ${verdict.line} (commit ${verdict.sha.slice(0, 12)}). Running ${step}: ${text}`
  )

  let result
  let neverStarted = false
  try {
    result = await run(command, evidence)
  } catch (err) {
    neverStarted = true
    say(
      `${step} could not be started, so nothing ran: ${err instanceof Error ? err.message : err}`
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
      ? `${step} ran. What it printed is in ${evidence} (not in git: copy what is safe into the log). Commit the log and push it now, before the next step is proposed.`
      : neverStarted
        ? `${step} is on record as failed (${end.tail}). The approval is spent all the same: commit the log, push it, and propose the command again.`
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

/**
 * Which commit wrote line `line` of `file`, and under which file name it
 * was committed; null when no commit did. Without the options that look
 * for moved or copied lines, and without any list of commits to skip.
 */
export function blameLine(root, file, line) {
  let out
  try {
    out = git(root, [
      "-c",
      "blame.ignoreRevsFile=",
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
  const named = out.match(/^filename (.+)$/m)?.[1]
  // Forty zeros is git's name for "not committed yet".
  if (!/^[0-9a-f]{40}$/.test(sha) || /^0+$/.test(sha) || !named) return null
  return { sha, file: named }
}

/** Whether `older` is `newer` or one of the commits before it. */
export function isAncestor(root, older, newer) {
  try {
    git(root, ["merge-base", "--is-ancestor", older, newer])
    return true
  } catch {
    return false
  }
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

const gh = (exec, args) =>
  exec("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

/**
 * What GitHub knows of a commit; null when it has no such commit.
 * `authorLogin` and `committerLogin` are the accounts GitHub ties the
 * commit to (by the emails in it, not the names typed); `verified` and
 * `reason` are its judgement of the signature.
 */
export function githubCommit(sha, { exec = execFileSync } = {}) {
  let out
  try {
    out = gh(exec, ["api", `repos/${REPOSITORY}/commits/${sha}`])
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

/**
 * What the `gh` login here may do, as GitHub lists it for the token. A
 * token of the kind that carries no such list gives an empty one.
 */
export function ghScopes({ exec = execFileSync } = {}) {
  let out
  try {
    out = gh(exec, ["api", "-i", "user"])
  } catch (err) {
    const said = `${err?.stderr ?? ""}${err?.stdout ?? ""}`
    throw new Error(said.trim().split("\n")[0] || "gh did not answer", {
      cause: err,
    })
  }
  const listed = out.match(/^x-oauth-scopes:[ \t]*(.*)$/im)?.[1] ?? ""
  return listed
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
}

/** Where the notes of used approvals are: inside `.git`, for every worktree. */
function usedNote(root, step, sha) {
  const common = git(root, ["rev-parse", "--git-common-dir"]).trim()
  return path.resolve(root, common, USED_DIR, `${step}-${sha}`)
}

/** Notes that an approval is being used. False when it was noted before. */
export function claimApproval(root, step, sha) {
  const file = usedNote(root, step, sha)
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

/** Takes the note back: for a run that never started. */
export function releaseApproval(root, step, sha) {
  rmSync(usedNote(root, step, sha), { force: true })
}

const PASSED_ON = ["SIGINT", "SIGTERM", "SIGHUP"]

/**
 * Runs a command from `root` (no shell), shows what it prints and keeps
 * it in `evidence`, readable by this user only. What is typed here
 * reaches the command. A signal sent to the gate is passed on, and the
 * gate waits for the command to end, so that the log gets its closing
 * line.
 */
export function runAndKeep(root, command, evidence) {
  const file = path.join(root, evidence)
  mkdirSync(path.dirname(file), { recursive: true })
  const kept = createWriteStream(file, { flags: "a", mode: 0o600 })
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
 * `[propose] <step> -- <command...>`. The first `--` only: the command
 * may have its own (`pnpm stripe:setup:webhooks -- --apply`). Some
 * runners take that first `--` away before the script sees it, so it may
 * be absent.
 */
export function readArguments(argv) {
  const proposing = argv[0] === "propose"
  const [step, ...rest] = proposing ? argv.slice(1) : argv
  return {
    mode: proposing ? "propose" : "run",
    step,
    command: rest[0] === "--" ? rest.slice(1) : rest,
  }
}

function main(argv) {
  const { mode, step, command } = readArguments(argv)
  const log = (day) => path.join(ROOT, logPathFor(day))
  const files = {
    readLog: (day) =>
      existsSync(log(day)) ? readFileSync(log(day), "utf8") : null,
    writeLog: (day, text) => {
      mkdirSync(path.dirname(log(day)), { recursive: true })
      writeFileSync(log(day), text, { flag: "wx" })
    },
    appendLog: (day, line) => {
      const text = readFileSync(log(day), "utf8")
      appendFileSync(log(day), `${text.endsWith("\n") ? "" : "\n"}${line}\n`)
    },
    say: (message) => console.error(`[cutover:gate] ${message}`),
  }
  const now = () => new Date()
  if (mode === "propose") {
    return propose({ step, command, now, deps: files })
  }
  return gate({
    step,
    command,
    now,
    deps: {
      ...files,
      blame: (day, line) => blameLine(ROOT, logPathFor(day), line),
      ancestor: (older, newer) => isAncestor(ROOT, older, newer),
      commit: (sha) => githubCommit(sha),
      scopes: () => ghScopes(),
      shallow: () => isShallow(ROOT),
      claim: (claimed, sha) => claimApproval(ROOT, claimed, sha),
      release: (claimed, sha) => releaseApproval(ROOT, claimed, sha),
      run: (toRun, evidence) => runAndKeep(ROOT, toRun, evidence),
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
