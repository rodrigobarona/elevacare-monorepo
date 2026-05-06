import type { CalendarProvider } from "./types"

/**
 * Thrown when a calendar OAuth token is expired, revoked, or missing.
 * Callers should surface a "reconnect calendar" prompt.
 */
export class CalendarTokenError extends Error {
  readonly code: string
  constructor(code: string) {
    super(`Calendar token error: ${code}`)
    this.name = "CalendarTokenError"
    this.code = code
  }
}

/**
 * Base class for typed calendar adapter errors. Carries provider,
 * operation name, and optional HTTP status for structured handling
 * in workflow catch blocks and UI error mapping.
 */
export class CalendarAdapterError extends Error {
  readonly provider: CalendarProvider
  readonly operation: string
  readonly statusCode?: number

  constructor(opts: {
    provider: CalendarProvider
    operation: string
    message: string
    statusCode?: number
    cause?: unknown
  }) {
    super(opts.message, { cause: opts.cause })
    this.name = "CalendarAdapterError"
    this.provider = opts.provider
    this.operation = opts.operation
    this.statusCode = opts.statusCode
  }
}

/**
 * The requested calendar resource (event, calendar) does not exist.
 * Safe to ignore on delete operations (event already removed).
 */
export class CalendarNotFoundError extends CalendarAdapterError {
  constructor(
    provider: CalendarProvider,
    operation: string,
    resourceId: string
  ) {
    super({
      provider,
      operation,
      message: `${operation}: resource ${resourceId} not found`,
      statusCode: 404,
    })
    this.name = "CalendarNotFoundError"
  }
}

/**
 * The event already exists (idempotent create detected a duplicate).
 */
export class CalendarConflictError extends CalendarAdapterError {
  constructor(
    provider: CalendarProvider,
    operation: string,
    idempotencyId: string
  ) {
    super({
      provider,
      operation,
      message: `${operation}: conflict on ${idempotencyId}`,
      statusCode: 409,
    })
    this.name = "CalendarConflictError"
  }
}

/**
 * Client-side validation failure (bad input, missing fields, invariants).
 */
export class CalendarValidationError extends CalendarAdapterError {
  constructor(provider: CalendarProvider, operation: string, detail: string) {
    super({ provider, operation, message: `${operation}: ${detail}` })
    this.name = "CalendarValidationError"
  }
}
