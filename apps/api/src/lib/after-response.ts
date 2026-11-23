import { after } from "next/server"

/**
 * Does `task` once the request has been answered.
 *
 * Next's `after()` throws where there is no request: a unit test that
 * calls a handler directly, a script. There the task is not run and this
 * says so by returning false. That is safe for what it is used for:
 * every task given to it is an extra with a net underneath (the hourly
 * tick), never the work itself.
 */
export function afterResponse(task: () => unknown): boolean {
  try {
    after(task)
    return true
  } catch {
    return false
  }
}
