import { createInterface } from "node:readline/promises"

/**
 * Asks one question on a terminal and gives back what was typed. When the
 * input ends without an answer (Ctrl-D, a closed pipe, an input that was
 * closed before the question), the answer is empty: the guard then refuses
 * as it does for any wrong answer, with its own message and exit status,
 * and the process does not wait on a question nobody can answer. The
 * reader is always closed.
 */
export async function askOnTerminal(
  streams: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream },
  question: string
): Promise<string> {
  const input = streams.input as NodeJS.ReadableStream & {
    readableEnded?: boolean
    destroyed?: boolean
  }
  // A reader on an input that has already ended never answers and never
  // closes: there is nobody to ask.
  if (input.readableEnded || input.destroyed) return ""

  const terminal = createInterface(streams)
  let noAnswer: (() => void) | undefined
  try {
    return await Promise.race([
      terminal.question(question),
      new Promise<string>((resolve) => {
        noAnswer = () => resolve("")
        terminal.once("close", noAnswer)
        input.once("end", noAnswer)
        input.once("close", noAnswer)
      }),
    ])
  } catch {
    return ""
  } finally {
    if (noAnswer) {
      input.removeListener("end", noAnswer)
      input.removeListener("close", noAnswer)
    }
    terminal.close()
  }
}
