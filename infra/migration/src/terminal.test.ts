import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import { askOnTerminal } from "./terminal"

function terminal() {
  const input = new PassThrough()
  const output = new PassThrough()
  let shown = ""
  output.on("data", (chunk: Buffer) => {
    shown += chunk.toString()
  })
  return { input, output, shown: () => shown }
}

describe("askOnTerminal", () => {
  it("asks the question and gives back the line that was typed", async () => {
    const t = terminal()
    const answer = askOnTerminal(t, "Type the project id: ")
    t.input.write("aged-wildflower-123456\n")
    await expect(answer).resolves.toBe("aged-wildflower-123456")
    expect(t.shown()).toContain("Type the project id: ")
  })

  it("gives an empty answer when the input ends without one, and does not hang", async () => {
    // Ctrl-D at the prompt: the guard then refuses as for any wrong answer.
    const t = terminal()
    const answer = askOnTerminal(t, "Type the project id: ")
    t.input.end()
    await expect(answer).resolves.toBe("")
  })

  it("gives an empty answer on an input that was already closed", async () => {
    const t = terminal()
    t.input.end()
    t.input.resume()
    await new Promise((resolve) => t.input.once("end", resolve))
    await expect(askOnTerminal(t, "Type the project id: ")).resolves.toBe("")
  })

  it("stops listening once it has its answer", async () => {
    const t = terminal()
    const answer = askOnTerminal(t, "? ")
    t.input.write("yes\n")
    await answer
    // The reader was closed: nothing keeps the process waiting on input.
    expect(t.input.listenerCount("data")).toBe(0)
  })
})
