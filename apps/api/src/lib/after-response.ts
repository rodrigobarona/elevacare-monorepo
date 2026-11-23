import { after } from "next/server"
import { logError } from "@eleva/observability"

let saidNoRequest = false

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
  } catch (err) {
    // On a deployed server every call is inside a request. If this is
    // reached there, emails and the rest are waiting for the hour, and
    // nothing else would show it: said once.
    if (process.env.VERCEL_ENV && !saidNoRequest) {
      saidNoRequest = true
      logError(
        "[after-response] no request to wait for: the task is not run",
        err
      )
    }
    return false
  }
}
