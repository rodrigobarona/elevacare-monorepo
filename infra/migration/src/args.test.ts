import { describe, expect, it } from "vitest"
import { MigrationArgsError, parseMigrationArgs } from "./args"

describe("parseMigrationArgs", () => {
  it("defaults to a dry run against a rehearsal branch", () => {
    expect(parseMigrationArgs([])).toEqual({
      mode: "dry-run",
      target: "branch",
      since: null,
      report: null,
    })
  })

  it("writes only when asked, and still to a branch", () => {
    expect(parseMigrationArgs(["--apply"])).toMatchObject({
      mode: "apply",
      target: "branch",
    })
  })

  it("reads a delta run and a report path", () => {
    const args = parseMigrationArgs([
      "--apply",
      "--target",
      "production",
      "--since",
      "2026-11-21T10:00:00Z",
      "--report",
      "reports/run.md",
    ])
    expect(args.target).toBe("production")
    expect(args.since?.toISOString()).toBe("2026-11-21T10:00:00.000Z")
    expect(args.report).toBe("reports/run.md")
  })

  it.each([
    [["--dry-run", "--apply"], "choose one"],
    [["--target", "staging"], '"branch" or "production"'],
    [["--target"], "needs a value"],
    [["--target", "--apply"], "needs a value"],
    [["--since", "yesterday"], "ISO-8601"],
    [["--since", "2026-11-21"], "ISO-8601"],
    [["--since", "2026-11-21T10:00:00"], "ISO-8601"],
    [["--since", "2026-13-45T10:00:00Z"], "ISO-8601"],
    [["--force"], "unknown argument"],
    [["production"], "unknown argument"],
  ])("refuses %j", (argv, message) => {
    expect(() => parseMigrationArgs(argv)).toThrow(MigrationArgsError)
    expect(() => parseMigrationArgs(argv)).toThrow(message)
  })

  it("never repeats what was typed when it could be a secret", () => {
    // A connection string pasted where a flag or a value belongs.
    const pasted = "postgresql://writer:hunter2@ep-x.neon.tech/eleva"
    for (const argv of [
      [pasted],
      ["--target", pasted],
      ["--since", pasted],
      ["--target", "x".repeat(200)],
    ]) {
      let message = ""
      try {
        parseMigrationArgs(argv)
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).not.toBe("")
      expect(message).not.toContain("hunter2")
      expect(message).not.toContain("postgresql")
      expect(message.length).toBeLessThan(160)
    }
    // A plain word is still shown, so a typo is easy to see.
    expect(() => parseMigrationArgs(["--target", "staging"])).toThrow(
      /not "staging"/
    )
  })
})
