import assert from "node:assert/strict"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  APPROVAL_GOOD_FOR_MS,
  EVIDENCE_DIR,
  OWNER,
  REPOSITORY,
  SIGNING_KEY_SCOPES,
  blameLine,
  checkApproval,
  claimApproval,
  commandText,
  gate,
  ghScopes,
  githubCommit,
  isAncestor,
  isShallow,
  isStep,
  logPathFor,
  parseLog,
  propose,
  readArguments,
  releaseApproval,
  secretOnCommandLine,
} from "./cutover-gate.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const SCRIPT = path.join(import.meta.dirname, "cutover-gate.mjs")
const NOW = new Date("2026-12-01T10:00:00.000Z")
const LOG = logPathFor(NOW)
const SHA = "a".repeat(40)

/** What GitHub says of a commit the owner made and signed, `minutes` ago. */
const signedByOwner = (minutes = 10) => ({
  authorLogin: OWNER,
  committerLogin: OWNER,
  verified: true,
  reason: "valid",
  committerDate: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
})

const proposal = (step, text = "pnpm x") =>
  `${step} | proposed | 2026-12-01T09:40:00Z | ${text}`
const approval = (step, by = OWNER, at = "2026-12-01T09:50:00Z") =>
  `${step} | approved | @${by} | ${at}`
/** A log with a command proposed for B.2 and then approved. */
const approved = (line = approval("B.2")) =>
  `# Cutover log\n\n${proposal("B.2")}\n${line}\n`

const check = (over = {}) =>
  checkApproval({
    step: "B.2",
    command: "pnpm x",
    logText: approved(),
    logPath: LOG,
    blame: async () => ({ sha: SHA, file: LOG }),
    ancestor: async () => true,
    commit: async () => signedByOwner(),
    now: NOW,
    ...over,
  })

test("a step is a letter with numbers and small letters after it", () => {
  // `B.9r` is the plan's name for the refund of step B.9.
  for (const step of ["B.2", "B.1.a", "C.4", "B.10", "C.1.2", "B.9r"]) {
    assert.equal(isStep(step), true, step)
  }
  for (const step of [
    "",
    "B",
    "b.2",
    "B.2 ",
    "B.2|x",
    "2.B",
    "B..2",
    "B.2R",
    "B.2rr",
    "B.2\n",
    "propose",
    null,
  ]) {
    assert.equal(isStep(step), false, String(step))
  }
})

test("the log is one file for each UTC day", () => {
  assert.equal(
    logPathFor(new Date("2026-12-01T23:59:59Z")),
    "docs/eleva-v3/operator-tasks/cutover-log-2026-12-01.md"
  )
  assert.equal(
    logPathFor(new Date("2026-12-02T00:00:00Z")),
    "docs/eleva-v3/operator-tasks/cutover-log-2026-12-02.md"
  )
})

test("only the gate's own lines of a log are read", () => {
  const entries = parseLog(
    [
      "# Cutover log 2026-12-01",
      "",
      "Notes: B.2 | approved | later, maybe",
      proposal("B.2", 'echo "a | b"'),
      approval("B.2"),
      "B.2 | started | 2026-12-01T09:51:00Z | pnpm x | approval abc",
      "B.2 | executed | 2026-12-01T09:52:00Z | pnpm x | evidence/B.2.log",
      "B.3 | failed | 2026-12-01T09:53:00Z | pnpm y | evidence/B.3.log | exit 1",
      "  B.4 | approved | @rodrigobarona | 2026-12-01T09:50:00Z",
      "B.5 | approved | @rodrigobarona",
    ].join("\n")
  )
  assert.deepEqual(
    entries.map((entry) => [entry.line, entry.step, entry.kind]),
    [
      [4, "B.2", "proposed"],
      [5, "B.2", "approved"],
      [6, "B.2", "started"],
      [7, "B.2", "executed"],
      [8, "B.3", "failed"],
    ]
  )
  // A proposed command that holds the separator is read back whole.
  assert.equal(entries[0].command, 'echo "a | b"')
})

test("the command the owner read, approved by a commit they made and signed a few minutes ago, may run", async () => {
  assert.deepEqual(await check(), { ok: true, line: 4, sha: SHA })
})

test("missing: no log, no approval, an approval for another step", async () => {
  assert.equal((await check({ logText: null })).reason, "no-log")
  assert.equal(
    (await check({ logText: "# Cutover log\n" })).reason,
    "no-approval"
  )
  assert.equal(
    (await check({ logText: `${proposal("B.3")}\n${approval("B.3")}\n` }))
      .reason,
    "no-approval"
  )
  // A step that only begins the same is another step.
  assert.equal(
    (await check({ logText: `${approval("B.2.a")}\n${approval("B.20")}\n` }))
      .reason,
    "no-approval"
  )
})

test("a line that is not quite an approval is not one", async () => {
  for (const line of [
    "B.2 | approved | @rodrigobarona",
    "B.2 | Approved | @rodrigobarona | 2026-12-01T09:50:00Z",
    "- B.2 | approved | @rodrigobarona | 2026-12-01T09:50:00Z",
    "B.2 |approved| @rodrigobarona | 2026-12-01T09:50:00Z",
  ]) {
    assert.equal(
      (await check({ logText: approved(line) })).reason,
      "no-approval"
    )
  }
  assert.equal(
    (await check({ logText: approved(approval("B.2", OWNER, "this morning")) }))
      .reason,
    "bad-time"
  )
  // A file saved with Windows line ends: the time no longer reads as one.
  const crlf = await check({ logText: approved().replaceAll("\n", "\r\n") })
  assert.equal(crlf.reason, "bad-time")
  assert.match(crlf.message, /Windows line ends/)
})

test("an approval says yes to one command: the one proposed above it, word for word", async () => {
  // No proposal: the owner said yes to nothing in particular.
  const bare = await check({ logText: `${approval("B.2")}\n` })
  assert.equal(bare.reason, "no-proposal")
  // A proposal written below the approval is not what was approved.
  assert.equal(
    (await check({ logText: `${approval("B.2")}\n${proposal("B.2")}\n` }))
      .reason,
    "no-proposal"
  )
  // Another step's proposal is not this step's.
  assert.equal(
    (await check({ logText: `${proposal("B.3")}\n${approval("B.2")}\n` }))
      .reason,
    "no-proposal"
  )
  // The right step, another command (another project, one more flag).
  for (const other of ["pnpm y", "pnpm x --apply", "pnpm  x", "PNPM x"]) {
    const wrong = await check({ command: other })
    assert.equal(wrong.reason, "not-the-approved-command", other)
    assert.match(wrong.message, /The owner approved \(line 3\): pnpm x/)
  }
  // Of two proposals above the approval, the later one is what was read last.
  const two = `${proposal("B.2", "pnpm old")}\n${proposal("B.2", "pnpm x")}\n${approval("B.2")}\n`
  assert.equal((await check({ logText: two })).ok, true)
  assert.equal(
    (await check({ logText: two, command: "pnpm old" })).reason,
    "not-the-approved-command"
  )
})

test("a proposal written or changed after the approval was committed is not what the owner saw", async () => {
  const lines = { 3: "p".repeat(40), 4: SHA }
  const blame = async (line) => ({ sha: lines[line], file: LOG })
  // Committed before the approval: fine.
  let asked = null
  const fine = await check({
    blame,
    ancestor: async (older, newer) => {
      asked = [older, newer]
      return true
    },
  })
  assert.equal(fine.ok, true)
  assert.deepEqual(asked, ["p".repeat(40), SHA])
  // Committed after it (the operator edited the line to match another command).
  assert.equal(
    (await check({ blame, ancestor: async () => false })).reason,
    "proposal-changed"
  )
  // Edited and not committed at all.
  assert.equal(
    (
      await check({
        blame: async (line) => (line === 3 ? null : { sha: SHA, file: LOG }),
      })
    ).reason,
    "proposal-changed"
  )
})

test("foreign: a line naming someone else, or written by someone else's commit", async () => {
  const named = await check({
    logText: approved(approval("B.2", "someone-else")),
  })
  assert.equal(named.reason, "not-owner")

  let asked = null
  const forged = await check({
    commit: async (sha) => {
      asked = sha
      return { ...signedByOwner(), authorLogin: "someone-else" }
    },
  })
  assert.equal(forged.reason, "foreign-author")
  assert.match(forged.message, /@someone-else/)
  assert.equal(asked, SHA)

  // A commit GitHub ties to no account (the email typed into it is not one).
  assert.equal(
    (
      await check({
        commit: async () => ({ ...signedByOwner(), authorLogin: null }),
      })
    ).reason,
    "foreign-author"
  )
})

test("a commit GitHub made in the owner's name is not the owner's approval", async () => {
  // Written on github.com, or made by a merge button: author the owner,
  // made and signed by GitHub. Anyone holding the owner's GitHub login
  // (an agent with their `gh`) can produce one.
  const webFlow = await check({
    commit: async () => ({ ...signedByOwner(), committerLogin: "web-flow" }),
  })
  assert.equal(webFlow.reason, "not-own-commit")
  assert.match(webFlow.message, /github\.com or by a merge/)

  // The owner's commit, rebased or amended by a colleague with a verified
  // key of their own: the date is new, the maker is not the owner.
  const rebased = await check({
    commit: async () => ({ ...signedByOwner(1), committerLogin: "colleague" }),
  })
  assert.equal(rebased.reason, "not-own-commit")
  assert.match(rebased.message, /made by @colleague/)
  assert.equal(
    (
      await check({
        commit: async () => ({ ...signedByOwner(), committerLogin: null }),
      })
    ).reason,
    "not-own-commit"
  )
})

test("a commit that is not signed with the owner's key is not an approval", async () => {
  const unsigned = await check({
    commit: async () => ({
      ...signedByOwner(),
      verified: false,
      reason: "unsigned",
    }),
  })
  assert.equal(unsigned.reason, "not-signed")
  assert.match(unsigned.message, /GitHub says: unsigned/)
  for (const reason of ["unknown_key", "bad_email", "expired_key", null]) {
    const other = await check({
      commit: async () => ({ ...signedByOwner(), reason }),
    })
    assert.equal(other.reason, "not-signed", String(reason))
  }
})

test("a login here that could add a signing key to the owner's account is refused", async () => {
  for (const scope of SIGNING_KEY_SCOPES) {
    const refused = await check({ scopes: async () => ["repo", scope] })
    assert.equal(refused.reason, "login-can-add-keys", scope)
    assert.match(refused.message, new RegExp(`--remove-scopes ${scope}`))
  }
  // What a `gh` login has by default, and reading keys, are fine.
  assert.equal(
    (
      await check({
        scopes: async () => [
          "gist",
          "read:org",
          "repo",
          "workflow",
          "read:gpg_key",
        ],
      })
    ).ok,
    true
  )
  assert.equal(
    (
      await check({
        scopes: async () => {
          throw new Error("no network")
        },
      })
    ).reason,
    "github-unreachable"
  )
})

test("stale: good for four hours from its commit, not from what the line says", async () => {
  const minutes = APPROVAL_GOOD_FOR_MS / 60_000
  assert.equal(
    (await check({ commit: async () => signedByOwner(minutes - 1) })).ok,
    true
  )
  assert.equal(
    (await check({ commit: async () => signedByOwner(minutes + 1) })).reason,
    "stale"
  )
  // A fresh time typed into the line does not make an old commit fresh.
  const dressedUp = await check({
    logText: approved(approval("B.2", OWNER, "2026-12-01T09:59:00Z")),
    commit: async () => signedByOwner(24 * 60),
  })
  assert.equal(dressedUp.reason, "stale")
})

test("a commit dated after now is not believed", async () => {
  assert.equal(
    (await check({ commit: async () => signedByOwner(-3) })).ok,
    true
  )
  assert.equal(
    (await check({ commit: async () => signedByOwner(-60) })).reason,
    "from-the-future"
  )
  assert.equal(
    (
      await check({
        commit: async () => ({ ...signedByOwner(), committerDate: null }),
      })
    ).reason,
    "bad-time"
  )
})

test("an approval not committed, not pushed, or committed in another day's file does not count", async () => {
  assert.equal(
    (
      await check({
        blame: async (line) => (line === 4 ? null : { sha: SHA, file: LOG }),
      })
    ).reason,
    "not-committed"
  )
  assert.equal(
    (await check({ commit: async () => null })).reason,
    "not-on-github"
  )
  const unreachable = await check({
    commit: async () => {
      throw new Error("no network")
    },
  })
  assert.equal(unreachable.reason, "github-unreachable")
  assert.match(unreachable.message, /no network/)
  // Yesterday's file, moved to today's name: its lines keep their commits.
  const yesterday = "docs/eleva-v3/operator-tasks/cutover-log-2026-11-30.md"
  const moved = await check({
    blame: async () => ({ sha: SHA, file: yesterday }),
  })
  assert.equal(moved.reason, "another-days-log")
  assert.match(moved.message, /cutover-log-2026-11-30\.md/)
})

test("a clone with part of the history is refused before git is asked who wrote the line", async () => {
  let blamed = false
  const shallow = await check({
    shallow: async () => true,
    blame: async () => {
      blamed = true
      return { sha: SHA, file: LOG }
    },
  })
  assert.equal(shallow.reason, "shallow-clone")
  assert.equal(blamed, false)
})

test("one approval, one run: used once it started, however it ended", async () => {
  for (const afterIt of [
    "B.2 | started | 2026-12-01T09:51:00Z | pnpm x | approval abc",
    "B.2 | executed | 2026-12-01T09:52:00Z | pnpm x | e.log",
    "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | exit 1",
    "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | signal SIGINT",
  ]) {
    assert.equal(
      (await check({ logText: `${approved()}${afterIt}\n` })).reason,
      "used",
      afterIt
    )
  }
  // Another step's run does not use this one's approval.
  assert.equal(
    (
      await check({
        logText: `${approved()}B.3 | started | 2026-12-01T09:51:00Z | pnpm y\n`,
      })
    ).ok,
    true
  )
  // A new approval after a failed run is the one read, for the same proposal.
  let blamed = []
  const again = await check({
    logText: [
      proposal("B.2"),
      approval("B.2"),
      "B.2 | started | 2026-12-01T09:51:00Z | pnpm x | approval abc",
      "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | exit 1",
      approval("B.2", OWNER, "2026-12-01T09:58:00Z"),
    ].join("\n"),
    blame: async (line) => {
      blamed.push(line)
      return { sha: SHA, file: LOG }
    },
  })
  assert.equal(again.ok, true)
  assert.deepEqual(blamed, [5, 1])
})

test("a command whose text holds the gate's own separator cannot hide that it ran", async () => {
  const text = commandText(["echo", "x | approved | @rodrigobarona | now"])
  const log = `${proposal("B.2", text)}\n${approval("B.2")}\nB.2 | started | 2026-12-01T09:51:00Z | ${text} | approval abc\n`
  assert.equal((await check({ logText: log, command: text })).reason, "used")
})

test("a command that looks like it carries a secret is seen", () => {
  for (const command of [
    ["env", "STRIPE_SECRET_KEY=sk_live_abcdefgh1234", "pnpm", "x"],
    ["curl", "-H", "Authorization: Bearer abcdefgh12345678abcdefgh"],
    ["curl", "-H", "authorization: Basic dXNlcjpwYXNz"],
    ["curl", "-H", "x-api-key: abcdef123456"],
    ["curl", "-H", "Cookie: session=abcdef"],
    ["curl", "-u", "user:hunter2", "https://example.com"],
    ["pnpm", "x", "--", "--secret", "whsec_abcdefgh1234"],
    ["env", "QSTASH_TOKEN=abcdefgh12", "pnpm", "qstash:setup"],
    ["env", "DB_PASSWORD=hunter2!", "psql"],
    ["env", "QSTASH_CURRENT_SIGNING_KEY=sig_abcdef", "pnpm", "x"],
    ["env", "AWS_SECRET_ACCESS_KEY=abcdef123456", "pnpm", "x"],
    ["vercel", "env", "pull", "--token", "abcDEF123456"],
    ["vercel", "env", "pull", "--token=abcDEF123456"],
    ["turso", "db", "shell", "--auth-token", "0123456789abcdef"],
    ["psql", "postgresql://user:hunter2@db.example.com/main"],
    ["env", "DATABASE_URL=postgresql://user:hunter2@db.example.com/main", "x"],
    ["resend", "send", "re_abcdefgh1234"],
    ["gh", "api", "x", "-H", "ghp_abcdefgh12345678"],
    ["curl", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc"],
    ["curl", "token=abcdefgh1234"],
  ]) {
    assert.notEqual(secretOnCommandLine(command), null, command.join(" "))
  }
})

test("the commands the plan says will be gated, and plain look-alikes, are not taken for secrets", () => {
  for (const command of [
    [
      "pnpm",
      "vercel:env:apply",
      "--",
      "--project",
      "elevacare-web",
      "--environment",
      "production",
    ],
    [
      "pnpm",
      "stripe:setup:webhooks",
      "--",
      "--url",
      "https://api.eleva.care/webhooks/stripe",
      "--apply",
    ],
    ["pnpm", "stripe:setup:portal", "--", "--apply"],
    ["pnpm", "qstash:setup", "--", "--apply"],
    ["pnpm", "betterstack:setup", "--", "--apply"],
    ["pnpm", "daily:setup", "--", "--apply"],
    ["pnpm", "resend:setup", "--", "--apply"],
    ["pnpm", "twilio:setup", "--", "--apply"],
    [
      "env",
      "E2E_ALLOW_LIVE_PAYMENT=true",
      "pnpm",
      "exec",
      "playwright",
      "test",
      "e2e/production-smoke.spec.ts",
    ],
    ["env", "SKIP_TOKEN_REFRESH=1", "pnpm", "x"],
    ["env", "BETTER_AUTH_URL=https://api.eleva.care/auth", "pnpm", "x"],
    ["git", "log", "--author", "rodrigobarona"],
    [
      "pnpm",
      "x",
      "--",
      "--oauth-redirect",
      "https://api.eleva.care/accounting/callback",
    ],
    ["pnpm", "x", "--", "--body", "the API uses bearer authentication now"],
    ["pnpm", "x", "--", "--token-refresh", "--apply"],
    ["curl", "https://api.eleva.care/health"],
  ]) {
    assert.equal(secretOnCommandLine(command), null, command.join(" "))
  }
})

test("a command is written to the log as one line that can be read back", () => {
  assert.equal(
    commandText(["pnpm", "qstash:setup", "--", "--apply"]),
    "pnpm qstash:setup -- --apply"
  )
  assert.equal(
    commandText(["echo", "two words", "a|b"]),
    'echo "two words" "a|b"'
  )
})

test("the mode, the step and the command are read, with or without the first --", () => {
  assert.deepEqual(readArguments(["B.2", "--", "pnpm", "x", "--", "--apply"]), {
    mode: "run",
    step: "B.2",
    command: ["pnpm", "x", "--", "--apply"],
  })
  assert.deepEqual(readArguments(["B.2", "pnpm", "x", "--", "--apply"]), {
    mode: "run",
    step: "B.2",
    command: ["pnpm", "x", "--", "--apply"],
  })
  assert.deepEqual(readArguments(["propose", "B.2", "--", "pnpm", "x"]), {
    mode: "propose",
    step: "B.2",
    command: ["pnpm", "x"],
  })
  assert.deepEqual(readArguments(["B.2"]), {
    mode: "run",
    step: "B.2",
    command: [],
  })
  assert.deepEqual(readArguments([]), {
    mode: "run",
    step: undefined,
    command: [],
  })
})

/** A gate with a log in memory, and what it did. */
function world({ log = approved(), result = 0, over = {}, clock } = {}) {
  const state = {
    log,
    ran: [],
    said: [],
    times: 0,
    claimed: new Set(),
    days: [],
  }
  const deps = {
    readLog: () => state.log,
    writeLog: (_day, text) => {
      state.log = text
    },
    appendLog: (day, line) => {
      state.days.push(logPathFor(day))
      state.log = `${state.log ?? ""}${line}\n`
    },
    blame: async () => ({ sha: SHA, file: LOG }),
    ancestor: async () => true,
    commit: async () => signedByOwner(),
    scopes: async () => ["repo"],
    shallow: async () => false,
    claim: (step, sha) => {
      const key = `${step}-${sha}`
      if (state.claimed.has(key)) return false
      state.claimed.add(key)
      return true
    },
    release: (step, sha) => state.claimed.delete(`${step}-${sha}`),
    run: async (command, evidence) => {
      // The started line is there before the command runs.
      state.ran.push({ command, evidence, logThen: state.log })
      return result
    },
    say: (message) => state.said.push(message),
    ...over,
  }
  const now = clock ?? (() => new Date(NOW.getTime() + state.times++ * 90_000))
  return {
    state,
    run: (step, command) => gate({ step, command, now, deps }),
    propose: (step, command) => propose({ step, command, now, deps }),
  }
}

test("with a good approval the command runs once, and the log says so before and after", async () => {
  const { state, run } = world({
    log: `${proposal("B.2", "pnpm qstash:setup -- --apply")}\n${approval("B.2")}\n`,
  })
  const exit = await run("B.2", ["pnpm", "qstash:setup", "--", "--apply"])
  assert.equal(exit, 0)
  assert.equal(state.ran.length, 1)
  assert.deepEqual(state.ran[0].command, [
    "pnpm",
    "qstash:setup",
    "--",
    "--apply",
  ])
  const evidence = `${EVIDENCE_DIR}/2026-12-01/B.2-20261201T100000.000Z.log`
  assert.equal(state.ran[0].evidence, evidence)
  // Before: with the commit that approved it, which a squash would not show.
  assert.ok(
    state.ran[0].logThen.endsWith(
      `\nB.2 | started | 2026-12-01T10:00:00.000Z | pnpm qstash:setup -- --apply | approval ${SHA}\n`
    ),
    state.ran[0].logThen
  )
  assert.ok(
    state.log.endsWith(
      `\nB.2 | executed | 2026-12-01T10:01:30.000Z | pnpm qstash:setup -- --apply | ${evidence}\n`
    ),
    state.log
  )
  // The same approval does not run it a second time.
  assert.equal(await run("B.2", ["pnpm", "qstash:setup", "--", "--apply"]), 2)
  assert.equal(state.ran.length, 1)
  assert.match(state.said.at(-1), /Refused \(used\)/)
})

test("the approved step with another command does not run", async () => {
  const { state, run } = world({
    log: `${proposal("B.1.a", "pnpm vercel:env:apply -- --project elevacare-web")}\n${approval("B.1.a")}\n`,
  })
  const exit = await run("B.1.a", [
    "pnpm",
    "vercel:env:apply",
    "--",
    "--project",
    "elevacare-api",
  ])
  assert.equal(exit, 2)
  assert.equal(state.ran.length, 0)
  assert.match(state.said.at(-1), /not-the-approved-command/)
  assert.equal(state.claimed.size, 0, "and the approval is not spent")
  assert.equal(
    await run("B.1.a", [
      "pnpm",
      "vercel:env:apply",
      "--",
      "--project",
      "elevacare-web",
    ]),
    0
  )
})

test("an approval stays used when the gate's lines are taken out of the log, wherever the line now is", async () => {
  // `git stash` or `git checkout` of the log: the lines the gate wrote
  // were not committed yet, and they go.
  const { state, run } = world()
  const before = state.log
  assert.equal(await run("B.2", ["pnpm", "x"]), 0)
  // The log as it was, with a line added above the approval.
  state.log = `one more line\n${before}`
  assert.equal(await run("B.2", ["pnpm", "x"]), 2)
  assert.equal(state.ran.length, 1)
  assert.match(state.said.at(-1), /Refused \(used\).*no longer says so/)
})

test("a run that crosses midnight closes in the log it started in", async () => {
  const times = [
    new Date("2026-12-01T23:59:30.000Z"),
    new Date("2026-12-02T00:00:40.000Z"),
  ]
  let at = 0
  const late = logPathFor(times[0])
  const { state, run } = world({
    clock: () => times[Math.min(at++, 1)],
    over: {
      blame: async () => ({ sha: SHA, file: late }),
      commit: async () => ({
        ...signedByOwner(),
        committerDate: "2026-12-01T23:50:00.000Z",
      }),
    },
  })
  assert.equal(await run("B.2", ["pnpm", "x"]), 0)
  assert.deepEqual(state.days, [late, late])
  assert.match(state.log, /\| executed \| 2026-12-02T00:00:40\.000Z \|/)
})

test("a command that fails is recorded as failed, the gate exits as it did, and the approval is used", async () => {
  const { state, run } = world({ result: { code: 3, signal: null } })
  assert.equal(await run("B.2", ["pnpm", "x"]), 3)
  assert.match(
    state.log,
    /\nB\.2 \| failed \| .* \| pnpm x \| .*\.log \| exit 3\n$/
  )
  assert.equal(await run("B.2", ["pnpm", "x"]), 2)
  assert.equal(state.ran.length, 1)
})

test("a command ended by a signal is recorded as failed, never as executed", async () => {
  for (const [signal, exit] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
    ["SIGKILL", 128],
  ]) {
    const { state, run } = world({ result: { code: null, signal } })
    assert.equal(await run("B.2", ["pnpm", "x"]), exit, signal)
    assert.ok(state.log.endsWith(` | signal ${signal}\n`), state.log)
    assert.doesNotMatch(state.log, /executed/)
  }
})

test("a command that cannot be started is recorded, and the gate says nothing ran", async () => {
  const { state, run } = world({
    over: {
      run: async () => {
        throw new Error("spawn pnpm ENOENT")
      },
    },
  })
  assert.equal(await run("B.2", ["pnpm", "x"]), 127)
  assert.match(state.log, /\nB\.2 \| failed \| .* \| exit 127\n$/)
  assert.ok(state.said.some((said) => /so nothing ran/.test(said)))
  assert.doesNotMatch(state.said.at(-1), /may have changed something/)
})

test("refused: nothing runs, nothing is written to the log, and no approval is spent", async () => {
  const cases = [
    [{ log: "# empty\n" }, "B.2", ["pnpm", "x"], /no-approval/],
    [{ log: `${approval("B.2")}\n` }, "B.2", ["pnpm", "x"], /no-proposal/],
    [{}, "B.2", ["pnpm", "y"], /not-the-approved-command/],
    [
      { over: { commit: async () => signedByOwner(600) } },
      "B.2",
      ["pnpm", "x"],
      /stale/,
    ],
    [
      {
        over: {
          commit: async () => ({ ...signedByOwner(), authorLogin: "x" }),
        },
      },
      "B.2",
      ["pnpm", "x"],
      /foreign-author/,
    ],
    [
      {
        over: {
          commit: async () => ({
            ...signedByOwner(),
            committerLogin: "web-flow",
          }),
        },
      },
      "B.2",
      ["pnpm", "x"],
      /not-own-commit/,
    ],
    [
      { over: { scopes: async () => ["admin:ssh_signing_key"] } },
      "B.2",
      ["pnpm", "x"],
      /login-can-add-keys/,
    ],
    [{ over: { shallow: async () => true } }, "B.2", ["pnpm", "x"], /shallow/],
    [
      { over: { ancestor: async () => false } },
      "B.2",
      ["pnpm", "x"],
      /proposal-changed/,
    ],
    [{}, "B.3", ["pnpm", "x"], /no-approval/],
    [{}, "b2", ["pnpm", "x"], /not a step/],
    [{}, "B.2", [], /No command/],
    [{}, "B.2", ["echo", "a\nb"], /line break/],
    [{}, "B.2", ["env", "API_TOKEN=abcdefgh", "pnpm", "x"], /secret/],
  ]
  for (const [setup, step, command, why] of cases) {
    const { state, run } = world(setup)
    const before = state.log
    assert.equal(await run(step, command), 2, String(why))
    assert.equal(state.ran.length, 0, String(why))
    assert.equal(state.log, before, String(why))
    assert.equal(state.claimed.size, 0, String(why))
    assert.match(state.said.at(-1), why)
  }
})

test("a log that cannot be written stops the run before it starts, and the approval is still good", async () => {
  let writable = false
  const { state, run } = world()
  const append = (day, line) => {
    if (!writable) throw new Error("read-only file system")
    state.log = `${state.log}${line}\n`
  }
  const blocked = world({ over: { appendLog: append } })
  assert.equal(await blocked.run("B.2", ["pnpm", "x"]), 2)
  assert.equal(blocked.state.ran.length, 0)
  assert.match(
    blocked.state.said.at(-1),
    /nothing runs without a record\. The approval is still good/
  )
  assert.equal(blocked.state.claimed.size, 0)
  // And it is: once the log can be written, the same approval runs.
  writable = true
  blocked.state.said.length = 0
  assert.equal(await run("B.2", ["pnpm", "x"]), 0)
})

test("propose writes the command to the day's log, starts the file when there is none, and runs nothing", () => {
  const fresh = world({ log: null })
  assert.equal(
    fresh.propose("B.2", ["pnpm", "qstash:setup", "--", "--apply"]),
    0
  )
  assert.equal(
    fresh.state.log,
    "# Cutover log 2026-12-01\n\nB.2 | proposed | 2026-12-01T10:00:00.000Z | pnpm qstash:setup -- --apply\n"
  )
  assert.equal(fresh.state.ran.length, 0)
  const said = fresh.state.said.at(-1)
  assert.match(said, /B\.2 \| approved \| @rodrigobarona \| /)
  assert.match(
    said,
    /git commit -S -am "docs\(p15\): approve cutover step B\.2"/
  )
  assert.match(said, /pnpm cutover:gate B\.2 -- pnpm qstash:setup -- --apply/)
  // What it wrote is read back as the proposal the gate will compare with.
  const [entry] = parseLog(fresh.state.log)
  assert.equal(
    entry.command,
    commandText(["pnpm", "qstash:setup", "--", "--apply"])
  )

  const existing = world({ log: "# Cutover log 2026-12-01\n\nnotes\n" })
  assert.equal(existing.propose("B.3", ["echo", "two words"]), 0)
  assert.ok(
    existing.state.log.startsWith("# Cutover log 2026-12-01\n\nnotes\n")
  )
  assert.ok(
    existing.state.log.endsWith(
      '\nB.3 | proposed | 2026-12-01T10:00:00.000Z | echo "two words"\n'
    )
  )

  // The same refusals as a run: a secret is not written to the log.
  for (const [step, command, why] of [
    ["B.2", ["env", "API_TOKEN=abcdefgh", "pnpm", "x"], /secret/],
    ["b2", ["pnpm", "x"], /not a step/],
    ["B.2", [], /No command/],
  ]) {
    const refused = world({ log: null })
    assert.equal(refused.propose(step, command), 2)
    assert.equal(refused.state.log, null)
    assert.match(refused.state.said.at(-1), why)
  }
})

// --- what GitHub answers ---------------------------------------------------

test("what GitHub says of a commit is read from five fields, and a missing commit is not an error", () => {
  const answer = {
    author: { login: OWNER },
    committer: { login: OWNER },
    commit: {
      verification: { verified: true, reason: "valid" },
      committer: { date: "2026-12-01T09:50:00Z" },
    },
  }
  let asked = null
  assert.deepEqual(
    githubCommit(SHA, {
      exec: (_file, args) => {
        asked = args
        return JSON.stringify(answer)
      },
    }),
    {
      authorLogin: OWNER,
      committerLogin: OWNER,
      verified: true,
      reason: "valid",
      committerDate: "2026-12-01T09:50:00Z",
    }
  )
  assert.deepEqual(asked, ["api", `repos/${REPOSITORY}/commits/${SHA}`])
  assert.equal(REPOSITORY, "rodrigobarona/elevacare-monorepo")
  // The maker is read from its own field: never taken from the author.
  assert.equal(
    githubCommit(SHA, {
      exec: () => JSON.stringify({ ...answer, committer: null }),
    }).committerLogin,
    null
  )
  assert.equal(
    githubCommit(SHA, {
      exec: () =>
        JSON.stringify({ ...answer, committer: { login: "web-flow" } }),
    }).committerLogin,
    "web-flow"
  )
  assert.deepEqual(
    githubCommit(SHA, {
      exec: () => JSON.stringify({ author: null, commit: {} }),
    }),
    {
      authorLogin: null,
      committerLogin: null,
      verified: false,
      reason: null,
      committerDate: null,
    }
  )
  const fails = (stderr) => () => {
    throw Object.assign(new Error("gh failed"), { stderr })
  }
  assert.equal(
    githubCommit(SHA, {
      exec: fails("gh: No commit found for SHA (HTTP 422)"),
    }),
    null
  )
  assert.equal(
    githubCommit(SHA, { exec: fails("gh: Not Found (HTTP 404)") }),
    null
  )
  assert.throws(
    () =>
      githubCommit(SHA, { exec: fails("error connecting to api.github.com") }),
    /error connecting/
  )
  assert.throws(
    () => githubCommit(SHA, { exec: () => "<html>not json</html>" }),
    SyntaxError
  )
})

test("what the gh login may do is read from the answer's heading", () => {
  let asked = null
  const answer = (headers) =>
    `HTTP/2.0 200 OK\r\n${headers}\r\n\r\n{"login":"x"}`
  assert.deepEqual(
    ghScopes({
      exec: (_file, args) => {
        asked = args
        return answer(
          "Content-Type: application/json\r\nX-Oauth-Scopes: gist, read:org, repo, admin:ssh_signing_key"
        )
      },
    }),
    ["gist", "read:org", "repo", "admin:ssh_signing_key"]
  )
  assert.deepEqual(asked, ["api", "-i", "user"])
  assert.deepEqual(ghScopes({ exec: () => answer("x-oauth-scopes: repo") }), [
    "repo",
  ])
  // A token that carries no list (a fine-grained one): nothing to read.
  assert.deepEqual(
    ghScopes({ exec: () => answer("Content-Type: application/json") }),
    []
  )
  assert.deepEqual(ghScopes({ exec: () => answer("X-Oauth-Scopes: ") }), [])
  assert.throws(
    () =>
      ghScopes({
        exec: () => {
          throw Object.assign(new Error("gh"), {
            stderr: "gh: Bad credentials (HTTP 401)",
          })
        },
      }),
    /Bad credentials/
  )
})

// --- with real repositories -------------------------------------------------

const made = []
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
}

function repository() {
  // The real path: git reports paths without the links of the temp folder.
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "cutover-gate-")))
  made.push(dir)
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, ...GIT_ENV },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  git("init", "-q", "-b", "main")
  return { dir, git }
}

test("git says which commit wrote a line: the one that wrote it, under the name it was committed in", () => {
  const { dir, git } = repository()
  const file = "log.md"
  const write = (text, name = file) => writeFileSync(path.join(dir, name), text)

  write(`# Log\n${approval("B.2")}\n`)
  git("add", file)
  git("commit", "-q", "-m", "approve B.2")
  const first = git("rev-parse", "HEAD")
  write(`# Log\n${approval("B.2")}\nB.2 | started | t | pnpm x\n`)
  git("commit", "-q", "-am", "the gate's own line")
  const second = git("rev-parse", "HEAD")

  assert.deepEqual(blameLine(dir, file, 2), { sha: first, file })
  assert.deepEqual(blameLine(dir, file, 3), { sha: second, file })
  assert.equal(isAncestor(dir, first, second), true)
  assert.equal(isAncestor(dir, first, first), true)
  assert.equal(isAncestor(dir, second, first), false)
  assert.equal(isAncestor(dir, "f".repeat(40), first), false)

  // A line in the file and in no commit: nobody wrote it yet.
  write(
    `# Log\n${approval("B.2")}\nB.2 | started | t | pnpm x\n${approval("B.3")}\n`
  )
  assert.equal(blameLine(dir, file, 4), null)
  // Lines added above it, not committed: it is still the same commit's.
  write(`# Log\nnote\nnote\n${approval("B.2")}\nB.2 | started | t | pnpm x\n`)
  assert.deepEqual(blameLine(dir, file, 4), { sha: first, file })
  // An approval edited after it was committed is not the committed one.
  write(`# Log\n${approval("B.9")}\nB.2 | started | t | pnpm x\n`)
  assert.equal(blameLine(dir, file, 2), null)
  assert.equal(blameLine(dir, file, 40), null)
  assert.equal(blameLine(dir, "other.md", 1), null)
  git("checkout", "-q", "--", file)

  // The owner's line copied into another file by someone else's commit
  // is that commit's line: git is not asked to look for where it came from.
  // (Git only looks for a copy in text of some length: this line is as
  // long as an approval with a time to the millisecond.)
  const line = approval("B.1.a", OWNER, "2026-12-01T09:50:00.000Z")
  write(`# Other\n${line}\n`, "source.md")
  git("add", "source.md")
  git("commit", "-q", "-m", "the owner's line, in another file")
  const source = git("rev-parse", "HEAD")
  write(`# Copy\n${line}\n`, "copy.md")
  git("add", "copy.md")
  git("commit", "-q", "-m", "copied by someone else")
  const copier = git("rev-parse", "HEAD")
  assert.deepEqual(blameLine(dir, "copy.md", 2), {
    sha: copier,
    file: "copy.md",
  })
  // And git could have been asked: with its copy search on, it names
  // the other file's commit. That is what the gate must not do.
  assert.match(
    git("blame", "--porcelain", "-C", "-C", "-C", "-L", "2,2", "--", "copy.md"),
    new RegExp(`^${source} `)
  )

  // The file moved to another name: the line keeps its commit, and the
  // name says where it was committed, which is how the gate tells.
  renameSync(path.join(dir, file), path.join(dir, "today.md"))
  git("add", "-A")
  git("commit", "-q", "-m", "moved")
  assert.deepEqual(blameLine(dir, "today.md", 2), { sha: first, file })
})

test("a clone with part of the history is known as one, and there git names the wrong commit", () => {
  const { dir, git } = repository()
  const file = "log.md"
  writeFileSync(path.join(dir, file), `${approval("B.4", "someone-else")}\n`)
  git("add", file)
  git("commit", "-q", "-m", "someone else's line")
  const theirs = git("rev-parse", "HEAD")
  writeFileSync(
    path.join(dir, file),
    `${approval("B.4", "someone-else")}\n${approval("B.3")}\n`
  )
  git("commit", "-q", "-am", "the owner's line")
  const owners = git("rev-parse", "HEAD")
  assert.equal(isShallow(dir), false)
  assert.equal(blameLine(dir, file, 1).sha, theirs)

  const shallow = mkdtempSync(path.join(tmpdir(), "cutover-gate-shallow-"))
  made.push(shallow)
  execFileSync(
    "git",
    ["clone", "-q", "--depth", "1", `file://${dir}`, shallow],
    {
      env: { ...process.env, ...GIT_ENV },
      stdio: "ignore",
    }
  )
  assert.equal(isShallow(shallow), true)
  // Why it is refused: the other person's line now reads as the owner's.
  assert.equal(blameLine(shallow, file, 1).sha, owners)
  assert.equal(isShallow(tmpdir()), true)
})

test("an approval is noted as used once, inside .git: out of reach of stash, reset and clean, and seen by every worktree", () => {
  const { dir, git } = repository()
  writeFileSync(path.join(dir, "a.txt"), "a\n")
  git("add", "-A")
  git("commit", "-q", "-m", "first")
  assert.equal(claimApproval(dir, "B.2", SHA), true)
  assert.equal(claimApproval(dir, "B.2", SHA), false)
  // Another step, another commit: each its own.
  assert.equal(claimApproval(dir, "B.3", SHA), true)
  assert.equal(claimApproval(dir, "B.2", "b".repeat(40)), true)
  // Git does not see it, and nothing git does to the files removes it.
  assert.equal(git("status", "--porcelain", "--ignored"), "")
  git("stash", "-u")
  git("reset", "-q", "--hard")
  git("clean", "-qfdx")
  assert.equal(claimApproval(dir, "B.2", SHA), false)
  // A second worktree of the same clone knows too.
  const other = path.join(
    realpathSync(mkdtempSync(path.join(tmpdir(), "cutover-gate-wt-"))),
    "wt"
  )
  made.push(path.dirname(other))
  git("worktree", "add", "-q", other)
  assert.equal(claimApproval(other, "B.2", SHA), false)
  // Taken back (a run that never started), it can be used.
  releaseApproval(other, "B.2", SHA)
  assert.equal(claimApproval(dir, "B.2", SHA), true)
})

test("this repository ignores the evidence folder and does not reformat a cutover log", () => {
  const ignored = spawnSync(
    "git",
    ["check-ignore", "-q", `${EVIDENCE_DIR}/2026-12-01/B.2.log`],
    { cwd: ROOT }
  )
  assert.equal(ignored.status, 0, "the evidence folder is not ignored by git")
  // The commit hook formats Markdown, which can rewrite a command in a
  // line of the log (`*`, `_`): the log must say what ran.
  assert.match(
    readFileSync(path.join(ROOT, ".prettierignore"), "utf8"),
    /^docs\/eleva-v3\/operator-tasks\/cutover-log-\*\.md$/m
  )
})

// --- the command itself, in a scratch repository with a stand-in for gh ----

/**
 * A repository holding a copy of the gate and today's log: `steps` are
 * proposed in one commit and approved in the next, then something else
 * is committed. A `gh` on the PATH answers with `answer` and `scopes`,
 * and notes what it was asked.
 */
function scratch({
  steps,
  answer,
  scopes = "gist, read:org, repo",
  trailingNewline = true,
}) {
  const { dir, git } = repository()
  mkdirSync(path.join(dir, "scripts"))
  copyFileSync(SCRIPT, path.join(dir, "scripts", "cutover-gate.mjs"))
  writeFileSync(path.join(dir, ".gitignore"), `${EVIDENCE_DIR}/\nbin/\n`)
  const log = logPathFor(new Date())
  const file = path.join(dir, log)
  mkdirSync(path.dirname(file), { recursive: true })
  const head = "# Cutover log\n\nNotes first.\n"
  writeFileSync(file, head)
  git("add", "-A")
  git("commit", "-q", "-m", "set up")
  const time = new Date().toISOString()
  const proposals = steps.map(
    ([step, command]) =>
      `${step} | proposed | ${time} | ${commandText(command)}`
  )
  writeFileSync(file, `${head}${proposals.join("\n")}\n`)
  git("commit", "-q", "-am", "propose")
  const approvals = steps.map(([step]) => approval(step, OWNER, time))
  writeFileSync(
    file,
    `${head}${proposals.join("\n")}\n${approvals.join("\n")}${trailingNewline ? "\n" : ""}`
  )
  git("commit", "-q", "-am", "approve")
  const approvedBy = git("rev-parse", "HEAD")
  // A later commit, by whoever: it must not matter.
  writeFileSync(path.join(dir, "later.txt"), "later\n")
  git("add", "later.txt")
  git("commit", "-q", "-m", "something else")

  const bin = path.join(dir, "bin")
  mkdirSync(bin)
  const asked = path.join(bin, "asked.txt")
  writeFileSync(
    path.join(bin, "gh"),
    `#!${process.execPath}\n` +
      `const args = process.argv.slice(2)\n` +
      `require("node:fs").appendFileSync(${JSON.stringify(asked)}, args.join(" ") + "\\n")\n` +
      `process.stdout.write(args.includes("-i") ? ${JSON.stringify(`HTTP/2.0 200 OK\r\nX-Oauth-Scopes: ${scopes}\r\n\r\n{}`)} : ${JSON.stringify(JSON.stringify(answer))})\n`
  )
  chmodSync(path.join(bin, "gh"), 0o755)

  const env = {
    ...process.env,
    ...GIT_ENV,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
  }
  const args = (step, command) => [
    path.join(dir, "scripts", "cutover-gate.mjs"),
    step,
    "--",
    ...command,
  ]
  return {
    dir,
    git,
    env,
    args,
    approvedBy,
    logFile: log,
    log: () => readFileSync(file, "utf8"),
    asked: () => (existsSync(asked) ? readFileSync(asked, "utf8") : ""),
    gateRun: (step, command, options = {}) =>
      spawnSync(process.execPath, args(step, command), {
        encoding: "utf8",
        env,
        ...options,
      }),
  }
}

const ownersAnswer = () => ({
  author: { login: OWNER },
  committer: { login: OWNER },
  commit: {
    verification: { verified: true, reason: "valid" },
    committer: { date: new Date(Date.now() - 60_000).toISOString() },
  },
})
const NODE = process.execPath

test("the command, end to end: asks GitHub about the commit that wrote the line, runs the approved command without a shell from the root, and records it", () => {
  const command = [
    NODE,
    "-e",
    "console.log('ran with', process.argv[1], 'in', process.cwd()); console.error('and warned'); process.stdin.on('data', (d) => console.log('typed', String(d).trim()))",
    "$(touch pwned); touch pwned",
  ]
  const repo = scratch({ steps: [["B.2", command]], answer: ownersAnswer() })
  const run = repo.gateRun("B.2", command, { input: "yes\n" })
  assert.equal(run.status, 0, run.stderr)
  // What may the login do, then the commit that wrote the line (not the newest).
  assert.equal(
    repo.asked(),
    `api -i user\napi repos/${REPOSITORY}/commits/${repo.approvedBy}\n`
  )
  assert.notEqual(repo.approvedBy, repo.git("rev-parse", "HEAD"))
  // No shell: the argument arrived as written and made no file. From the
  // repository root. What was typed reached it.
  assert.match(run.stdout, /ran with \$\(touch pwned\); touch pwned in /)
  assert.ok(run.stdout.includes(`in ${repo.dir}\n`), run.stdout)
  assert.match(run.stdout, /typed yes/)
  assert.equal(existsSync(path.join(repo.dir, "pwned")), false)

  const lines = repo.log().trimEnd().split("\n").slice(-3)
  assert.match(lines[0], /^B\.2 \| approved \| @rodrigobarona \| /)
  assert.ok(lines[1].startsWith("B.2 | started | "), lines[1])
  assert.ok(lines[1].endsWith(` | approval ${repo.approvedBy}`), lines[1])
  assert.match(
    lines[2],
    /^B\.2 \| executed \| \S+ \| .* \| docs\/eleva-v3\/operator-tasks\/cutover-evidence\/\d{4}-\d{2}-\d{2}\/B\.2-\S+\.log$/
  )
  // What it printed is kept, both streams, for this user only, out of git.
  const evidence = path.join(repo.dir, lines[2].split(" | ").at(-1))
  const kept = readFileSync(evidence, "utf8")
  assert.match(kept, /ran with/)
  assert.match(kept, /and warned/)
  assert.equal(statSync(evidence).mode & 0o077, 0)
  assert.equal(repo.git("status", "--porcelain"), `M ${repo.logFile}`)

  // Used: not again; not after the gate's lines are stashed, the ignored
  // files cleaned away, and a line added above the approval.
  assert.equal(repo.gateRun("B.2", command).status, 2)
  repo.git("stash")
  repo.git("clean", "-qfdx", "-e", "bin")
  writeFileSync(
    path.join(repo.dir, repo.logFile),
    `one more line\n${repo.log()}`
  )
  const again = repo.gateRun("B.2", command)
  assert.equal(again.status, 2, again.stderr)
  assert.match(again.stderr, /Refused \(used\)/)
  assert.doesNotMatch(repo.log(), /started/)
})

test("the command: a log that does not end with a line break gets its lines on lines of their own", () => {
  const command = [NODE, "-e", "0"]
  const repo = scratch({
    steps: [["B.2", command]],
    answer: ownersAnswer(),
    trailingNewline: false,
  })
  assert.equal(repo.gateRun("B.2", command).status, 0)
  const lines = repo.log().split("\n")
  assert.match(lines.at(-4), /^B\.2 \| approved \| /)
  assert.match(lines.at(-3), /^B\.2 \| started \| /)
  assert.match(lines.at(-2), /^B\.2 \| executed \| /)
  assert.equal(lines.at(-1), "")
})

test("the command: a run ended by a signal is on record as failed, and a signal sent to the gate reaches the command", async () => {
  const dies = [NODE, "-e", "process.kill(process.pid, 'SIGKILL')"]
  const killed = scratch({ steps: [["B.2", dies]], answer: ownersAnswer() })
  const run = killed.gateRun("B.2", dies)
  assert.equal(run.status, 128, run.stderr)
  assert.match(killed.log(), /\nB\.2 \| failed \| .* \| signal SIGKILL\n$/)
  assert.doesNotMatch(killed.log(), /executed/)

  // The command waits, and says so when it is told to stop.
  const waits = [
    NODE,
    "-e",
    "process.on('SIGTERM', () => { require('node:fs').writeFileSync('told-to-stop', ''); process.exit(7) }); console.log('waiting'); setInterval(() => {}, 1000)",
  ]
  const repo = scratch({ steps: [["B.3", waits]], answer: ownersAnswer() })
  const child = spawn(NODE, repo.args("B.3", waits), {
    env: repo.env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  await new Promise((resolve) =>
    child.stdout.on(
      "data",
      (chunk) => String(chunk).includes("waiting") && resolve()
    )
  )
  child.kill("SIGTERM")
  // If the signal is not passed on, the command waits for ever: stop
  // both after a while, so that this fails and does not hang.
  const giveUp = setTimeout(() => {
    spawnSync("pkill", ["-f", path.join(repo.dir, "scripts")])
    spawnSync("pkill", ["-f", "told-to-stop"])
    child.kill("SIGKILL")
  }, 8_000)
  const exit = await new Promise((resolve) => child.on("close", resolve))
  clearTimeout(giveUp)
  assert.equal(existsSync(path.join(repo.dir, "told-to-stop")), true)
  assert.equal(exit, 7)
  assert.match(repo.log(), /\nB\.3 \| failed \| .* \| exit 7\n$/)
})

test("the command: refused for a commit GitHub made, another step, another command, a login that can add keys, and a clone with part of the history", () => {
  const command = [NODE, "-e", "require('node:fs').writeFileSync('ran', '')"]
  const refusedWith = (repo, step, toRun, reason) => {
    const run = repo.gateRun(step, toRun)
    assert.equal(run.status, 2, `${reason}: ${run.stderr}`)
    assert.match(run.stderr, new RegExp(`Refused \\(${reason}\\)`))
    assert.equal(existsSync(path.join(repo.dir, "ran")), false, reason)
    assert.doesNotMatch(repo.log(), /started/, reason)
  }
  const webFlow = scratch({
    steps: [["B.2", command]],
    answer: { ...ownersAnswer(), committer: { login: "web-flow" } },
  })
  refusedWith(webFlow, "B.2", command, "not-own-commit")
  refusedWith(webFlow, "B.3", command, "no-approval")

  const good = scratch({ steps: [["B.2", command]], answer: ownersAnswer() })
  refusedWith(
    good,
    "B.2",
    [NODE, "-e", "require('node:fs').writeFileSync('ran', 'other')"],
    "not-the-approved-command"
  )

  const keys = scratch({
    steps: [["B.2", command]],
    answer: ownersAnswer(),
    scopes: "repo, admin:ssh_signing_key",
  })
  refusedWith(keys, "B.2", command, "login-can-add-keys")

  const shallow = mkdtempSync(path.join(tmpdir(), "cutover-gate-shallow-"))
  made.push(shallow)
  execFileSync(
    "git",
    ["clone", "-q", "--depth", "1", `file://${good.dir}`, shallow],
    {
      env: { ...process.env, ...GIT_ENV },
      stdio: "ignore",
    }
  )
  const refused = spawnSync(
    NODE,
    [
      path.join(shallow, "scripts", "cutover-gate.mjs"),
      "B.2",
      "--",
      ...command,
    ],
    {
      encoding: "utf8",
      env: good.env,
    }
  )
  assert.equal(refused.status, 2)
  assert.match(refused.stderr, /Refused \(shallow-clone\)/)
  // After all those refusals the approval is still good.
  assert.equal(good.gateRun("B.2", command).status, 0)
  assert.equal(existsSync(path.join(good.dir, "ran")), true)
})

test("the command: an approval carried into today's log by moving another file, and a proposal changed after the approval, are refused", () => {
  const command = [NODE, "-e", "require('node:fs').writeFileSync('ran', '')"]
  const moved = scratch({ steps: [["B.2", command]], answer: ownersAnswer() })
  // Another day's log, with a command proposed and approved in it, is
  // moved onto today's name by a later commit: its lines keep the
  // commits that wrote them, under the name they were written in.
  const today = path.join(moved.dir, moved.logFile)
  const old = moved.logFile.replace(
    /cutover-log-.*\.md$/,
    "cutover-log-2020-01-01.md"
  )
  const time = new Date().toISOString()
  writeFileSync(
    path.join(moved.dir, old),
    `# Cutover log\n\nB.5 | proposed | ${time} | ${commandText(command)}\n`
  )
  moved.git("add", "-A")
  moved.git("commit", "-q", "-m", "proposed on another day")
  writeFileSync(
    path.join(moved.dir, old),
    `# Cutover log\n\nB.5 | proposed | ${time} | ${commandText(command)}\n${approval("B.5", OWNER, time)}\n`
  )
  moved.git("commit", "-q", "-am", "approved on another day")
  // Today has no log yet (it is just past midnight)...
  moved.git("rm", "-q", moved.logFile)
  moved.git("commit", "-q", "-m", "a new day")
  assert.equal(existsSync(today), false)
  // ...and the other day's is moved onto its name.
  moved.git("mv", old, moved.logFile)
  moved.git("commit", "-q", "-m", "carried into today")
  const carried = moved.gateRun("B.5", command)
  assert.equal(carried.status, 2, carried.stderr)
  assert.match(carried.stderr, /Refused \(another-days-log\)/)
  assert.match(carried.stderr, /cutover-log-2020-01-01\.md/)
  assert.equal(existsSync(path.join(moved.dir, "ran")), false)

  // The operator rewrites the proposal after the owner approved, commits
  // it, and runs the new command under the old approval.
  const other = [NODE, "-e", "require('node:fs').writeFileSync('ran', 'other')"]
  const changed = scratch({ steps: [["B.2", command]], answer: ownersAnswer() })
  const file = path.join(changed.dir, changed.logFile)
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace(commandText(command), commandText(other))
  )
  changed.git("commit", "-q", "-am", "a different command, after the approval")
  const run = changed.gateRun("B.2", other)
  assert.equal(run.status, 2, run.stderr)
  assert.match(run.stderr, /Refused \(proposal-changed\)/)
  assert.equal(existsSync(path.join(changed.dir, "ran")), false)
})

test("the command: propose starts the day's log and writes the line; nothing runs and GitHub is not asked", () => {
  const { dir, git } = repository()
  mkdirSync(path.join(dir, "scripts"))
  copyFileSync(SCRIPT, path.join(dir, "scripts", "cutover-gate.mjs"))
  git("add", "-A")
  git("commit", "-q", "-m", "set up")
  const command = [NODE, "-e", "require('node:fs').writeFileSync('ran', '')"]
  const run = spawnSync(
    NODE,
    [
      path.join(dir, "scripts", "cutover-gate.mjs"),
      "propose",
      "B.2",
      "--",
      ...command,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, ...GIT_ENV, PATH: "/nonexistent" },
    }
  )
  assert.equal(run.status, 0, run.stderr)
  const day = new Date().toISOString().slice(0, 10)
  const text = readFileSync(path.join(dir, logPathFor(new Date())), "utf8")
  assert.ok(text.startsWith(`# Cutover log ${day}\n\nB.2 | proposed | `), text)
  assert.ok(text.endsWith(` | ${commandText(command)}\n`), text)
  assert.equal(existsSync(path.join(dir, "ran")), false)
  assert.match(run.stderr, /The owner pulls, adds this line below it/)
})

test("the command, in this repository with no approval for today: refused, exit 2, nothing left behind, also through a link", () => {
  const run = spawnSync(
    NODE,
    [SCRIPT, "B.2", "--", NODE, "-e", "process.exit(0)"],
    { encoding: "utf8" }
  )
  assert.equal(run.status, 2, run.stderr)
  assert.match(run.stderr, /Refused \(no-(log|approval)\)/)

  // Reached through a symbolic link it is still the gate: it must never
  // do nothing and exit 0, which would read as a step that ran.
  const linked = path.join(
    mkdtempSync(path.join(tmpdir(), "cutover-gate-link-")),
    "repo"
  )
  made.push(path.dirname(linked))
  symlinkSync(ROOT, linked)
  const throughLink = spawnSync(
    NODE,
    [path.join(linked, "scripts", "cutover-gate.mjs"), "B.2", "--", "true"],
    {
      encoding: "utf8",
    }
  )
  assert.equal(throughLink.status, 2, throughLink.stderr)
  assert.match(throughLink.stderr, /Refused \(no-(log|approval)\)/)

  const usage = spawnSync(NODE, [SCRIPT], { encoding: "utf8" })
  assert.equal(usage.status, 2)
  assert.match(
    usage.stderr,
    /Usage: pnpm cutover:gate \[propose\] <step> -- <command\.\.\.>/
  )
  assert.equal(existsSync(path.join(ROOT, EVIDENCE_DIR)), false)
})
