import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
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
  blameLine,
  checkApproval,
  claimApproval,
  commandText,
  gate,
  githubCommit,
  isShallow,
  isStep,
  logPathFor,
  parseLog,
  readArguments,
  secretOnCommandLine,
} from "./cutover-gate.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const SCRIPT = path.join(import.meta.dirname, "cutover-gate.mjs")
const NOW = new Date("2026-12-01T10:00:00.000Z")
const SHA = "a".repeat(40)

/** What GitHub says of a commit the owner made and signed, `minutes` ago. */
const signedByOwner = (minutes = 10) => ({
  authorLogin: OWNER,
  committerLogin: OWNER,
  verified: true,
  reason: "valid",
  committerDate: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
})

const approval = (step, by = OWNER, at = "2026-12-01T09:50:00Z") =>
  `${step} | approved | @${by} | ${at}`

const check = (over = {}) =>
  checkApproval({
    step: "B.2",
    logText: `# Cutover log\n\n${approval("B.2")}\n`,
    blame: async () => SHA,
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
      approval("B.2"),
      "B.2 | started | 2026-12-01T09:51:00Z | pnpm x",
      "B.2 | executed | 2026-12-01T09:52:00Z | pnpm x | evidence/B.2.log",
      "B.3 | failed | 2026-12-01T09:53:00Z | pnpm y | evidence/B.3.log | exit 1",
      "  B.4 | approved | @rodrigobarona | 2026-12-01T09:50:00Z",
      "B.5 | approved | @rodrigobarona",
    ].join("\n")
  )
  assert.deepEqual(
    entries.map((entry) => [entry.line, entry.step, entry.kind]),
    [
      [4, "B.2", "approved"],
      [5, "B.2", "started"],
      [6, "B.2", "executed"],
      [7, "B.3", "failed"],
    ]
  )
})

test("an approval the owner made, signed and pushed a few minutes ago is good", async () => {
  assert.deepEqual(await check(), { ok: true, line: 3, sha: SHA })
})

test("missing: no log, no line, a line for another step", async () => {
  assert.equal((await check({ logText: null })).reason, "no-log")
  assert.equal(
    (await check({ logText: "# Cutover log\n" })).reason,
    "no-approval"
  )
  assert.equal(
    (await check({ logText: `${approval("B.3")}\n` })).reason,
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
    assert.equal((await check({ logText: `${line}\n` })).reason, "no-approval")
  }
  assert.equal(
    (await check({ logText: `${approval("B.2", OWNER, "this morning")}\n` }))
      .reason,
    "bad-time"
  )
  // A file saved with Windows line ends: the time no longer reads as one.
  assert.equal(
    (await check({ logText: `${approval("B.2")}\r\n` })).reason,
    "bad-time"
  )
})

test("foreign: a line naming someone else, or written by someone else's commit", async () => {
  // The line says another person approved.
  const named = await check({ logText: `${approval("B.2", "someone-else")}\n` })
  assert.equal(named.reason, "not-owner")

  // The line names the owner, and another account wrote it.
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

  // The owner's commit, rebased or amended by a colleague with a
  // verified key of their own: the date is new, the maker is not the owner.
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
  // "Verified" for any reason but a valid signature of their own.
  for (const reason of ["unknown_key", "bad_email", "expired_key", null]) {
    const other = await check({
      commit: async () => ({ ...signedByOwner(), reason }),
    })
    assert.equal(other.reason, "not-signed", String(reason))
  }
})

test("stale: good for four hours from its commit, not from what the line says", async () => {
  const minutes = APPROVAL_GOOD_FOR_MS / 60_000
  assert.equal(
    (await check({ commit: async () => signedByOwner(minutes - 1) })).ok,
    true
  )
  const stale = await check({ commit: async () => signedByOwner(minutes + 1) })
  assert.equal(stale.reason, "stale")

  // A fresh time typed into the line does not make an old commit fresh.
  const dressedUp = await check({
    logText: `${approval("B.2", OWNER, "2026-12-01T09:59:00Z")}\n`,
    commit: async () => signedByOwner(24 * 60),
  })
  assert.equal(dressedUp.reason, "stale")

  // Yesterday's approval, copied into today's file by a new commit, is
  // judged by that new commit: who made it and when.
  const copied = await check({
    commit: async () => ({ ...signedByOwner(1), authorLogin: "someone-else" }),
  })
  assert.equal(copied.reason, "foreign-author")
})

test("a commit dated after now is not believed", async () => {
  assert.equal(
    (await check({ commit: async () => signedByOwner(-3) })).ok,
    true,
    "a few minutes of clock difference are allowed"
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

test("an approval typed into the file and not committed, or not pushed, does not count", async () => {
  assert.equal(
    (await check({ blame: async () => null })).reason,
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
})

test("a clone with part of the history is refused before git is asked who wrote the line", async () => {
  let blamed = false
  const shallow = await check({
    shallow: async () => true,
    blame: async () => {
      blamed = true
      return SHA
    },
  })
  assert.equal(shallow.reason, "shallow-clone")
  assert.equal(blamed, false)
})

test("one approval, one run: used once it started, however it ended", async () => {
  for (const afterIt of [
    "B.2 | started | 2026-12-01T09:51:00Z | pnpm x",
    "B.2 | executed | 2026-12-01T09:52:00Z | pnpm x | e.log",
    "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | exit 1",
    "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | signal SIGINT",
  ]) {
    const used = await check({ logText: `${approval("B.2")}\n${afterIt}\n` })
    assert.equal(used.reason, "used", afterIt)
  }
  // Another step's run does not use this one's approval.
  assert.equal(
    (
      await check({
        logText: `${approval("B.2")}\nB.3 | started | 2026-12-01T09:51:00Z | pnpm y\n`,
      })
    ).ok,
    true
  )
  // A new line after the run is a new approval, and it is the one blamed.
  let blamed = null
  const again = await check({
    logText: [
      approval("B.2"),
      "B.2 | started | 2026-12-01T09:51:00Z | pnpm x",
      "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | exit 1",
      approval("B.2", OWNER, "2026-12-01T09:58:00Z"),
    ].join("\n"),
    blame: async (line) => {
      blamed = line
      return SHA
    },
  })
  assert.equal(again.ok, true)
  assert.equal(blamed, 4)
})

test("a command whose text holds the gate's own separator cannot hide that it ran", async () => {
  // The gate writes the command into the `started` line. Whatever the
  // command says, that line still reads as "B.2 was started".
  const text = commandText(["echo", "x | approved | @rodrigobarona | now"])
  const log = `${approval("B.2")}\nB.2 | started | 2026-12-01T09:51:00Z | ${text}\n`
  assert.equal((await check({ logText: log })).reason, "used")
})

test("a command that looks like it carries a secret is seen", () => {
  for (const command of [
    ["env", "STRIPE_SECRET_KEY=sk_live_abcdefgh1234", "pnpm", "x"],
    ["curl", "-H", "Authorization: Bearer abcdefgh12345678abcdefgh"],
    ["curl", "-H", "authorization: Basic dXNlcjpwYXNz"],
    ["curl", "-H", "x-api-key: abcdef123456"],
    ["pnpm", "x", "--", "--secret", "whsec_abcdefgh1234"],
    ["env", "QSTASH_TOKEN=abcdefgh12", "pnpm", "qstash:setup"],
    ["env", "DB_PASSWORD=hunter2!", "psql"],
    ["vercel", "env", "pull", "--token", "abcDEF123456"],
    ["vercel", "env", "pull", "--token=abcDEF123456"],
    ["turso", "db", "shell", "--auth-token", "0123456789abcdef"],
    ["psql", "postgresql://user:hunter2@db.example.com/main"],
    ["env", "DATABASE_URL=postgresql://user:hunter2@db.example.com/main", "x"],
    ["resend", "send", "re_abcdefgh1234"],
    ["curl", "token=abcdefgh1234"],
  ]) {
    assert.notEqual(secretOnCommandLine(command), null, command.join(" "))
  }
})

test("the commands the plan says will be gated are not taken for secrets", () => {
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
    // A name that says "token" with a plain switch for a value.
    ["env", "SKIP_TOKEN_REFRESH=1", "pnpm", "x"],
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

test("the step and the command are read, with or without the first --", () => {
  assert.deepEqual(readArguments(["B.2", "--", "pnpm", "x", "--", "--apply"]), {
    step: "B.2",
    command: ["pnpm", "x", "--", "--apply"],
  })
  assert.deepEqual(readArguments(["B.2", "pnpm", "x", "--", "--apply"]), {
    step: "B.2",
    command: ["pnpm", "x", "--", "--apply"],
  })
  assert.deepEqual(readArguments(["B.2"]), { step: "B.2", command: [] })
  assert.deepEqual(readArguments([]), { step: undefined, command: [] })
})

/** A gate with a log in memory, and what it did. */
function world({ log = `${approval("B.2")}\n`, result = 0, over = {} } = {}) {
  const state = { log, ran: [], said: [], times: 0, claimed: new Set() }
  const deps = {
    readLog: () => state.log,
    appendLog: (_day, line) => {
      state.log = `${state.log}${line}\n`
    },
    blame: async () => SHA,
    commit: async () => signedByOwner(),
    shallow: async () => false,
    claim: (step, sha, line) => {
      const key = `${step}-${sha}-${line}`
      if (state.claimed.has(key)) return false
      state.claimed.add(key)
      return true
    },
    run: async (command, evidence) => {
      // The started line is there before the command runs.
      state.ran.push({ command, evidence, logThen: state.log })
      return result
    },
    say: (message) => state.said.push(message),
    ...over,
  }
  const now = () => new Date(NOW.getTime() + state.times++ * 90_000)
  return {
    state,
    run: (step, command) => gate({ step, command, now, deps }),
  }
}

test("with a good approval the command runs once, and the log says so before and after", async () => {
  const { state, run } = world()
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
  assert.match(
    state.ran[0].logThen,
    /\nB\.2 \| started \| 2026-12-01T10:00:00\.000Z \| pnpm qstash:setup -- --apply\n$/
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

test("an approval stays used when the gate's lines are taken out of the log", async () => {
  // `git stash` or `git checkout` of the log: the lines the gate wrote
  // were not committed yet, and they go.
  const { state, run } = world()
  const before = state.log
  assert.equal(await run("B.2", ["pnpm", "x"]), 0)
  state.log = before
  assert.equal(await run("B.2", ["pnpm", "x"]), 2)
  assert.equal(state.ran.length, 1)
  assert.match(state.said.at(-1), /Refused \(used\).*no longer says so/)
  assert.equal(state.log, before, "and nothing is written for the refusal")
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

test("a command that cannot be started is recorded too", async () => {
  const { state, run } = world({
    over: {
      run: async () => {
        throw new Error("spawn pnpmm ENOENT")
      },
    },
  })
  assert.equal(await run("B.2", ["pnpmm", "x"]), 127)
  assert.match(state.log, /\nB\.2 \| failed \| .* \| exit 127\n$/)
})

test("refused: nothing runs and nothing is written to the log", async () => {
  const cases = [
    [{ log: "# empty\n" }, "B.2", ["pnpm", "x"], /no-approval/],
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
    [{ over: { shallow: async () => true } }, "B.2", ["pnpm", "x"], /shallow/],
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

test("a log that cannot be written stops the run before it starts", async () => {
  const { state, run } = world({
    over: {
      appendLog: () => {
        throw new Error("read-only file system")
      },
    },
  })
  assert.equal(await run("B.2", ["pnpm", "x"]), 2)
  assert.equal(state.ran.length, 0)
  assert.match(state.said.at(-1), /nothing runs without a record/)
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

  // A commit made on github.com: the maker is GitHub's own account.
  assert.equal(
    githubCommit(SHA, {
      exec: () =>
        JSON.stringify({ ...answer, committer: { login: "web-flow" } }),
    }).committerLogin,
    "web-flow"
  )
  // A commit with no account behind it, not verified.
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
  const dir = mkdtempSync(path.join(tmpdir(), "cutover-gate-"))
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

test("git says which commit wrote a line: the one that wrote it, not the file's last", () => {
  const { dir, git } = repository()
  const file = "log.md"
  const write = (text) => writeFileSync(path.join(dir, file), text)

  write(`# Log\n${approval("B.2")}\n`)
  git("add", file)
  git("commit", "-q", "-m", "approve B.2")
  const first = git("rev-parse", "HEAD")

  write(`# Log\n${approval("B.2")}\nB.2 | started | t | pnpm x\n`)
  git("commit", "-q", "-am", "the gate's own line")
  const second = git("rev-parse", "HEAD")
  assert.notEqual(first, second)

  assert.equal(blameLine(dir, file, 2), first)
  assert.equal(blameLine(dir, file, 3), second)

  // A line in the file and in no commit: nobody wrote it yet.
  write(
    `# Log\n${approval("B.2")}\nB.2 | started | t | pnpm x\n${approval("B.3")}\n`
  )
  assert.equal(blameLine(dir, file, 4), null)
  // Lines added above it, not committed: it is still the same commit's.
  write(`# Log\nnote\nnote\n${approval("B.2")}\nB.2 | started | t | pnpm x\n`)
  assert.equal(blameLine(dir, file, 4), first)
  // An approval edited after it was committed is not the committed one.
  write(`# Log\n${approval("B.9")}\nB.2 | started | t | pnpm x\n`)
  assert.equal(blameLine(dir, file, 2), null)
  // No such line, no such file.
  assert.equal(blameLine(dir, file, 40), null)
  assert.equal(blameLine(dir, "other.md", 1), null)
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
  assert.equal(blameLine(dir, file, 1), theirs)

  const shallow = mkdtempSync(path.join(tmpdir(), "cutover-gate-shallow-"))
  made.push(shallow)
  execFileSync(
    "git",
    ["clone", "-q", "--depth", "1", `file://${dir}`, shallow],
    { env: { ...process.env, ...GIT_ENV }, stdio: "ignore" }
  )
  assert.equal(isShallow(shallow), true)
  // Why it is refused: the other person's line now reads as the owner's.
  assert.equal(blameLine(shallow, file, 1), owners)
  // Not a repository at all: treated as "cannot tell", which is a refusal.
  assert.equal(isShallow(tmpdir()), true)
})

test("an approval can be noted as used once, and the note is not in git's reach", () => {
  const { dir, git } = repository()
  writeFileSync(path.join(dir, ".gitignore"), `${EVIDENCE_DIR}/\n`)
  git("add", ".gitignore")
  git("commit", "-q", "-m", "ignore")
  assert.equal(claimApproval(dir, "B.2", SHA, 3), true)
  assert.equal(claimApproval(dir, "B.2", SHA, 3), false)
  // Another step, another commit, another line: each its own.
  assert.equal(claimApproval(dir, "B.3", SHA, 3), true)
  assert.equal(claimApproval(dir, "B.2", "b".repeat(40), 3), true)
  assert.equal(claimApproval(dir, "B.2", SHA, 7), true)
  // Ignored, so stash, reset and clean (without -x) leave it.
  assert.equal(git("status", "--porcelain"), "")
  git("stash", "-u")
  git("reset", "-q", "--hard")
  git("clean", "-qfd")
  assert.equal(claimApproval(dir, "B.2", SHA, 3), false)
})

test("this repository ignores the evidence folder and does not reformat a cutover log", () => {
  const ignored = spawnSync(
    "git",
    ["check-ignore", "-q", `${EVIDENCE_DIR}/2026-12-01/B.2.log`],
    { cwd: ROOT }
  )
  assert.equal(ignored.status, 0, "the evidence folder is not ignored by git")
  assert.equal(
    spawnSync(
      "git",
      ["check-ignore", "-q", `${EVIDENCE_DIR}/used/B.2-${SHA}-3`],
      { cwd: ROOT }
    ).status,
    0
  )
  // The commit hook formats Markdown, which can rewrite a command in a
  // `started` line (`*`, `_`): the log must say what ran.
  assert.match(
    readFileSync(path.join(ROOT, ".prettierignore"), "utf8"),
    /^docs\/eleva-v3\/operator-tasks\/cutover-log-\*\.md$/m
  )
})

// --- the command itself, in a scratch repository with a stand-in for gh ----

/**
 * A repository holding a copy of the gate, today's log with `lines`
 * committed, and a `gh` on the PATH that answers with `answer` and notes
 * what it was asked.
 */
function scratch({ lines, answer, trailingNewline = true }) {
  const { dir, git } = repository()
  mkdirSync(path.join(dir, "scripts"))
  copyFileSync(SCRIPT, path.join(dir, "scripts", "cutover-gate.mjs"))
  writeFileSync(path.join(dir, ".gitignore"), `${EVIDENCE_DIR}/\nbin/\n`)
  const log = logPathFor(new Date())
  mkdirSync(path.dirname(path.join(dir, log)), { recursive: true })
  writeFileSync(path.join(dir, log), "# Cutover log\n\nNotes first.\n")
  git("add", "-A")
  git("commit", "-q", "-m", "set up")
  writeFileSync(
    path.join(dir, log),
    `# Cutover log\n\nNotes first.\n${lines.join("\n")}${trailingNewline ? "\n" : ""}`
  )
  git("commit", "-q", "-am", "approve")
  const approved = git("rev-parse", "HEAD")
  // A later commit to the same file, by whoever: it must not matter.
  writeFileSync(path.join(dir, "later.txt"), "later\n")
  git("add", "later.txt")
  git("commit", "-q", "-m", "something else")

  const bin = path.join(dir, "bin")
  mkdirSync(bin)
  const asked = path.join(bin, "asked.txt")
  writeFileSync(
    path.join(bin, "gh"),
    `#!${process.execPath}\n` +
      `require("node:fs").appendFileSync(${JSON.stringify(asked)}, process.argv.slice(2).join(" ") + "\\n")\n` +
      `process.stdout.write(${JSON.stringify(JSON.stringify(answer))})\n`
  )
  chmodSync(path.join(bin, "gh"), 0o755)

  const gateRun = (step, command, options = {}) =>
    spawnSync(
      process.execPath,
      [path.join(dir, "scripts", "cutover-gate.mjs"), step, "--", ...command],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ...GIT_ENV,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        },
        ...options,
      }
    )
  return {
    dir,
    git,
    approved,
    log: () => readFileSync(path.join(dir, log), "utf8"),
    asked: () => (existsSync(asked) ? readFileSync(asked, "utf8") : ""),
    gateRun,
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
const today = (step) => approval(step, OWNER, new Date().toISOString())

test("the command, end to end: it asks GitHub about the commit that wrote the line, runs without a shell, and records it", () => {
  const repo = scratch({ lines: [today("B.2")], answer: ownersAnswer() })
  const run = repo.gateRun("B.2", [
    process.execPath,
    "-e",
    "console.log('ran with', process.argv[1]); console.error('and warned')",
    "$(touch pwned); touch pwned",
  ])
  assert.equal(run.status, 0, run.stderr)
  // The commit that wrote the line, not the newest one.
  assert.equal(
    repo.asked(),
    `api repos/${REPOSITORY}/commits/${repo.approved}\n`
  )
  assert.notEqual(repo.approved, repo.git("rev-parse", "HEAD"))
  // No shell: the argument arrived as written and made no file.
  assert.match(run.stdout, /ran with \$\(touch pwned\); touch pwned/)
  assert.equal(existsSync(path.join(repo.dir, "pwned")), false)

  const lines = repo.log().trimEnd().split("\n").slice(-3)
  assert.match(lines[0], /^B\.2 \| approved \| @rodrigobarona \| /)
  assert.match(lines[1], /^B\.2 \| started \| \S+ \| \S+ -e /)
  assert.match(
    lines[2],
    /^B\.2 \| executed \| \S+ \| .* \| docs\/eleva-v3\/operator-tasks\/cutover-evidence\/\d{4}-\d{2}-\d{2}\/B\.2-\S+\.log$/
  )
  // What it printed is kept, both streams, and git does not see it.
  const evidence = lines[2].split(" | ").at(-1)
  const kept = readFileSync(path.join(repo.dir, evidence), "utf8")
  assert.match(kept, /ran with/)
  assert.match(kept, /and warned/)
  assert.equal(repo.git("status", "--porcelain"), `M ${logPathFor(new Date())}`)

  // Used: not again, and not after the gate's lines are stashed away.
  assert.equal(repo.gateRun("B.2", [process.execPath, "-e", "0"]).status, 2)
  repo.git("stash")
  const afterStash = repo.gateRun("B.2", [
    process.execPath,
    "-e",
    "require('node:fs').writeFileSync('ran-twice', '')",
  ])
  assert.equal(afterStash.status, 2, afterStash.stderr)
  assert.match(afterStash.stderr, /Refused \(used\)/)
  assert.equal(existsSync(path.join(repo.dir, "ran-twice")), false)
})

test("the command: a log that does not end with a line break gets its lines on lines of their own", () => {
  const repo = scratch({
    lines: [today("B.2")],
    answer: ownersAnswer(),
    trailingNewline: false,
  })
  assert.equal(repo.gateRun("B.2", [process.execPath, "-e", "0"]).status, 0)
  const lines = repo.log().split("\n")
  assert.match(lines.at(-4), /^B\.2 \| approved \| /)
  assert.match(lines.at(-3), /^B\.2 \| started \| /)
  assert.match(lines.at(-2), /^B\.2 \| executed \| /)
  assert.equal(lines.at(-1), "")
})

test("the command: a run ended by a signal is on record as failed", () => {
  const repo = scratch({ lines: [today("B.2")], answer: ownersAnswer() })
  const run = repo.gateRun("B.2", [
    process.execPath,
    "-e",
    "process.kill(process.pid, 'SIGKILL')",
  ])
  assert.equal(run.status, 128, run.stderr)
  assert.match(repo.log(), /\nB\.2 \| failed \| .* \| signal SIGKILL\n$/)
  assert.doesNotMatch(repo.log(), /executed/)
})

test("the command: refused for a commit GitHub made, for a clone with part of the history, and for another step", () => {
  const webFlow = scratch({
    lines: [today("B.2")],
    answer: { ...ownersAnswer(), committer: { login: "web-flow" } },
  })
  const byGitHub = webFlow.gateRun("B.2", [
    process.execPath,
    "-e",
    "require('node:fs').writeFileSync('ran', '')",
  ])
  assert.equal(byGitHub.status, 2)
  assert.match(byGitHub.stderr, /Refused \(not-own-commit\)/)
  assert.equal(existsSync(path.join(webFlow.dir, "ran")), false)
  assert.doesNotMatch(webFlow.log(), /started/)

  const other = webFlow.gateRun("B.3", [process.execPath, "-e", "0"])
  assert.equal(other.status, 2)
  assert.match(other.stderr, /Refused \(no-approval\)/)

  // A clone with one commit of history: refused before GitHub is asked.
  const full = scratch({ lines: [today("B.2")], answer: ownersAnswer() })
  const shallow = mkdtempSync(path.join(tmpdir(), "cutover-gate-shallow-"))
  made.push(shallow)
  execFileSync(
    "git",
    ["clone", "-q", "--depth", "1", `file://${full.dir}`, shallow],
    { env: { ...process.env, ...GIT_ENV }, stdio: "ignore" }
  )
  const refused = spawnSync(
    process.execPath,
    [
      path.join(shallow, "scripts", "cutover-gate.mjs"),
      "B.2",
      "--",
      process.execPath,
      "-e",
      "0",
    ],
    { encoding: "utf8", env: { ...process.env, ...GIT_ENV } }
  )
  assert.equal(refused.status, 2)
  assert.match(refused.stderr, /Refused \(shallow-clone\)/)
})

test("the command, in this repository with no approval for today: refused, exit 2, nothing run", () => {
  const run = spawnSync(
    process.execPath,
    [SCRIPT, "B.2", "--", process.execPath, "-e", "process.exit(0)"],
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
    process.execPath,
    [path.join(linked, "scripts", "cutover-gate.mjs"), "B.2", "--", "true"],
    { encoding: "utf8" }
  )
  assert.equal(throughLink.status, 2, throughLink.stderr)
  assert.match(throughLink.stderr, /Refused \(no-(log|approval)\)/)

  const usage = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" })
  assert.equal(usage.status, 2)
  assert.match(
    usage.stderr,
    /Usage: pnpm cutover:gate <step> -- <command\.\.\.>/
  )
  // Nothing of the gate's is left behind in the repository by a refusal.
  assert.deepEqual(
    existsSync(path.join(ROOT, EVIDENCE_DIR))
      ? readdirSync(path.join(ROOT, EVIDENCE_DIR))
      : [],
    []
  )
})
