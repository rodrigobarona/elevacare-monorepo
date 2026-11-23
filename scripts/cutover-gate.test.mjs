import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, test } from "node:test"
import {
  APPROVAL_GOOD_FOR_MS,
  EVIDENCE_DIR,
  OWNER,
  blameLine,
  checkApproval,
  commandText,
  gate,
  githubCommit,
  isStep,
  logPathFor,
  parseLog,
  readArguments,
  secretOnCommandLine,
} from "./cutover-gate.mjs"

const SCRIPT = path.join(import.meta.dirname, "cutover-gate.mjs")
const NOW = new Date("2026-12-01T10:00:00.000Z")
const SHA = "a".repeat(40)

/** What GitHub says of a commit the owner signed, `minutes` ago. */
const signedByOwner = (minutes = 10) => ({
  authorLogin: OWNER,
  verified: true,
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
  for (const step of ["B.2", "B.1.a", "C.4", "B.10", "C.1.2"]) {
    assert.equal(isStep(step), true, step)
  }
  for (const step of ["", "B", "b.2", "B.2 ", "B.2|x", "2.B", "B..2", null]) {
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

test("an approval the owner signed and pushed a few minutes ago is good", async () => {
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
})

test("foreign: a line naming someone else, or written by someone else's commit", async () => {
  // The line says another person approved.
  const named = await check({ logText: `${approval("B.2", "someone-else")}\n` })
  assert.equal(named.reason, "not-owner")

  // The line names the owner, and another account committed it.
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

test("a commit that is not signed with the owner's key is not an approval", async () => {
  const unsigned = await check({
    commit: async () => ({ ...signedByOwner(), verified: false }),
  })
  assert.equal(unsigned.reason, "not-signed")
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

test("one approval, one run: used once it started, however it ended", async () => {
  for (const after of [
    "B.2 | started | 2026-12-01T09:51:00Z | pnpm x",
    "B.2 | executed | 2026-12-01T09:52:00Z | pnpm x | e.log",
    "B.2 | failed | 2026-12-01T09:52:00Z | pnpm x | e.log | exit 1",
  ]) {
    const used = await check({ logText: `${approval("B.2")}\n${after}\n` })
    assert.equal(used.reason, "used", after)
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

test("a secret on the command line is seen", () => {
  for (const command of [
    ["env", "STRIPE_SECRET_KEY=sk_live_abcdefgh1234", "pnpm", "x"],
    ["curl", "-H", "Authorization: Bearer abcdefgh12345678"],
    ["pnpm", "x", "--", "--secret", "whsec_abcdefgh1234"],
    ["env", "QSTASH_TOKEN=abc", "pnpm", "qstash:setup"],
    ["env", "DB_PASSWORD=hunter2", "psql"],
  ]) {
    assert.notEqual(secretOnCommandLine(command), null, command.join(" "))
  }
  for (const command of [
    [
      "pnpm",
      "stripe:setup:webhooks",
      "--",
      "--url",
      "https://api.eleva.care/webhooks/stripe",
      "--apply",
    ],
    [
      "env",
      "E2E_ALLOW_LIVE_PAYMENT=true",
      "pnpm",
      "exec",
      "playwright",
      "test",
    ],
    ["pnpm", "vercel:env:apply", "--", "--project", "elevacare-web"],
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
function world({ log = `${approval("B.2")}\n`, exit = 0, over = {} } = {}) {
  const state = { log, ran: [], said: [], times: 0 }
  const deps = {
    readLog: () => state.log,
    appendLog: (_day, line) => {
      state.log = `${state.log}${line}\n`
    },
    blame: async () => SHA,
    commit: async () => signedByOwner(),
    run: async (command, evidence) => {
      // The started line is there before the command runs.
      state.ran.push({ command, evidence, logThen: state.log })
      return exit
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
  const evidence = `${EVIDENCE_DIR}/2026-12-01/B.2-20261201T100000Z.log`
  assert.equal(state.ran[0].evidence, evidence)
  assert.match(
    state.ran[0].logThen,
    /\nB\.2 \| started \| 2026-12-01T10:00:00\.000Z \| pnpm qstash:setup -- --apply\n$/
  )
  assert.match(
    state.log,
    new RegExp(
      `\\nB\\.2 \\| executed \\| 2026-12-01T10:01:30\\.000Z \\| pnpm qstash:setup -- --apply \\| ${evidence.replaceAll(".", "\\.")}\\n$`
    )
  )

  // The same approval does not run it a second time.
  assert.equal(await run("B.2", ["pnpm", "qstash:setup", "--", "--apply"]), 2)
  assert.equal(state.ran.length, 1)
  assert.match(state.said.at(-1), /Refused \(used\)/)
})

test("a command that fails is recorded as failed, the gate exits as it did, and the approval is used", async () => {
  const { state, run } = world({ exit: 3 })
  assert.equal(await run("B.2", ["pnpm", "x"]), 3)
  assert.match(
    state.log,
    /\nB\.2 \| failed \| .* \| pnpm x \| .*\.log \| exit 3\n$/
  )
  assert.equal(await run("B.2", ["pnpm", "x"]), 2)
  assert.equal(state.ran.length, 1)
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
    [{}, "B.3", ["pnpm", "x"], /no-approval/],
    [{}, "b2", ["pnpm", "x"], /not a step/],
    [{}, "B.2", [], /No command/],
    [{}, "B.2", ["echo", "a\nb"], /line break/],
    [{}, "B.2", ["env", "API_TOKEN=abc", "pnpm", "x"], /secret/],
  ]
  for (const [setup, step, command, why] of cases) {
    const { state, run } = world(setup)
    const before = state.log
    assert.equal(await run(step, command), 2, String(why))
    assert.equal(state.ran.length, 0, String(why))
    assert.equal(state.log, before, String(why))
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

// --- with a real repository: which commit wrote a line -------------------

const made = []
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

function repository() {
  const dir = mkdtempSync(path.join(tmpdir(), "cutover-gate-"))
  made.push(dir)
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    }).trim()
  git("init", "-q")
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
  // An approval edited after it was committed is not the committed one.
  write(`# Log\n${approval("B.9")}\nB.2 | started | t | pnpm x\n`)
  assert.equal(blameLine(dir, file, 2), null)
  // No such line, no such file.
  assert.equal(blameLine(dir, file, 40), null)
  assert.equal(blameLine(dir, "other.md", 1), null)
})

test("what GitHub says of a commit is read from its three fields, and a missing commit is not an error", () => {
  const answer = {
    author: { login: OWNER },
    commit: {
      verification: { verified: true },
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
      verified: true,
      committerDate: "2026-12-01T09:50:00Z",
    }
  )
  assert.deepEqual(asked, [
    "api",
    `repos/rodrigobarona/elevacare-monorepo/commits/${SHA}`,
  ])
  // A commit with no account behind it, not verified.
  assert.deepEqual(
    githubCommit(SHA, {
      exec: () => JSON.stringify({ author: null, commit: {} }),
    }),
    { authorLogin: null, verified: false, committerDate: null }
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
})

test("run as a command with no approval for today: refused, exit 2, nothing run", () => {
  const run = spawnSync(
    process.execPath,
    [SCRIPT, "B.2", "--", process.execPath, "-e", "process.exit(0)"],
    { encoding: "utf8" }
  )
  assert.equal(run.status, 2, run.stderr)
  assert.match(run.stderr, /Refused \(no-(log|approval)\)/)

  const usage = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" })
  assert.equal(usage.status, 2)
  assert.match(
    usage.stderr,
    /Usage: pnpm cutover:gate <step> -- <command\.\.\.>/
  )
})
