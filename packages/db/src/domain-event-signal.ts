/**
 * "An event was just written to the outbox."
 *
 * The outbox is published by a job, and that job runs once an hour (see
 * `@eleva/config/background-jobs`): polling it more often would keep the
 * database awake around the clock for nothing. A person does not wait an
 * hour for a confirmation email, so whatever writes an event says so
 * here, and the app that is running decides what to do about it. The API
 * publishes once it has answered the request
 * (`apps/api/src/lib/publish-domain-events.ts`).
 *
 * Call it in the same function as the write, so that it runs in the
 * request that caused it. A test holds that every writer does.
 *
 * Nobody listening is fine (a script, a test, an app that does not
 * publish): the hourly run picks the event up.
 */
type Listener = () => void

// On `globalThis`, as the database client is: a server may load this
// module more than once, and the listener must be the same for all.
const KEY = Symbol.for("eleva.db.domainEventWritten")
type Holder = { [KEY]?: Listener | null }

/** The app says what happens when an event is written. `null` stops it. */
export function onDomainEventWritten(listener: Listener | null): void {
  ;(globalThis as Holder)[KEY] = listener
}

/** Said by whatever writes an event. Never fails the write it is part of. */
export function domainEventWritten(): void {
  try {
    ;(globalThis as Holder)[KEY]?.()
  } catch {
    // The event is in the outbox either way: the hourly run publishes it.
  }
}
