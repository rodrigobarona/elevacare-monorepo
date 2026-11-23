/**
 * How often one address may ask each sign-in endpoint for something.
 *
 * Better Auth counts every request under `/auth`, by the caller's IP and
 * the exact path, in Redis. Left alone it uses its own numbers, and those
 * of each plugin, which change with a release. These are Eleva's, written
 * down, with the reason for each.
 *
 * How to read a rule: `max` requests in `window` seconds, for one IP on
 * one path. The count starts at the first request and ends `window`
 * seconds later (a fixed window), so the wait a person is told is the
 * window at most.
 *
 * What shaped the numbers:
 * - A clinic is one office address, and a mobile network puts many members
 *   behind one. A limit has to slow a script, not stop ten colleagues at
 *   nine in the morning. Each path has its own count, so someone held on
 *   the password path can still use a sign-in link, Google or a passkey.
 * - Nobody waits more than a minute for anything they do themselves.
 * - A link opened from an email gets room: refused there, a person lands
 *   on a bare page of the API with nowhere to go.
 *
 * What this does not do: it knows the address a request comes from, not
 * the account it is about. Someone with many addresses can keep trying one
 * account, and one address can send several emails a minute to one inbox.
 * A limit for each account and each inbox is not built (decision log,
 * 2026-11-23, 13.5).
 *
 * Paths are written without the `/auth` prefix. The first rule that
 * matches wins, so a path comes before the pattern that also covers it.
 * `*` stands for one part of a path. A test fails when a path here is not
 * an endpoint of the installed Better Auth, or when an endpoint for
 * signing in, signing up or the second factor has no rule.
 */

const MINUTE = 60

export interface AuthRateLimitRule {
  /** Seconds. */
  window: number
  /** Requests allowed in the window, for one IP on one path. */
  max: number
}

/** Everything without a rule of its own: session reads, sign-out, keys. */
export const AUTH_RATE_LIMIT_DEFAULT: AuthRateLimitRule = {
  window: 10,
  max: 100,
}

export const AUTH_RATE_LIMIT_RULES = {
  // A password is tried. Ten a minute lets a whole office sign in, and a
  // person mistype; a script guessing passwords gets ten a minute.
  "/sign-in/email": { window: MINUTE, max: 10 },
  // An email is sent to whatever address is typed: five a minute. The
  // form already spaces its own "send again" thirty seconds apart.
  "/sign-in/magic-link": { window: MINUTE, max: 5 },
  // Nothing is guessed here: it answers with Google's or Microsoft's own
  // address. A tighter limit once locked people out of Google sign-in.
  "/sign-in/social": { window: MINUTE, max: 20 },
  // Any way of signing in added later starts from the password's number.
  "/sign-in/*": { window: MINUTE, max: 10 },

  // A password is hashed and an email sent for each.
  "/sign-up/email": { window: MINUTE, max: 5 },
  "/sign-up/*": { window: MINUTE, max: 5 },

  // Links opened from an email. Thirty a minute, so that the sixth
  // colleague of the morning is not left on a bare page.
  "/magic-link/verify": { window: MINUTE, max: 30 },
  "/verify-email": { window: MINUTE, max: 30 },

  // Each sends an email to someone's inbox.
  "/request-password-reset": { window: MINUTE, max: 3 },
  "/send-verification-email": { window: MINUTE, max: 3 },
  "/change-email": { window: MINUTE, max: 3 },

  // A new password is set, or the current one is asked for again.
  "/reset-password": { window: MINUTE, max: 5 },
  "/verify-password": { window: MINUTE, max: 5 },
  "/change-password": { window: MINUTE, max: 5 },

  // The second step. A code by email is an email: three a minute. The
  // rest, ten a minute for each path; the plugin itself allows five tries
  // for one code and locks the account for fifteen minutes after ten
  // wrong ones, which is the guard that counts.
  "/two-factor/send-otp": { window: MINUTE, max: 3 },
  "/two-factor/*": { window: MINUTE, max: 10 },

  // A passkey cannot be guessed; written down so that it is ours.
  "/passkey/verify-authentication": { window: MINUTE, max: 20 },
} as const satisfies Record<string, AuthRateLimitRule>

/**
 * The longest a person is asked to wait by these rules, in seconds. What
 * the sign-in screens fall back to when an answer does not say.
 */
export const AUTH_RATE_LIMIT_LONGEST_WAIT = Math.max(
  ...Object.values(AUTH_RATE_LIMIT_RULES).map((rule) => rule.window)
)
