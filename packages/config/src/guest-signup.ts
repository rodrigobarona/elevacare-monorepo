/**
 * The "create your Eleva account" link a member gets after booking without
 * an account (thank-you page and confirmation email).
 *
 * `claim=1` tells the sign-up page that this booking already started an
 * account for the address, so it finishes with a sign-in link sent to that
 * inbox instead of a password form. The link carries the email and name to
 * prefill the form, and nothing else: no phone number, no booking id.
 */
export function guestSignupPath(input: {
  email: string
  name?: string | null
}): string {
  const params = new URLSearchParams({ claim: "1", email: input.email })
  const name = input.name?.trim()
  if (name) params.set("name", name)
  return `/signup?${params.toString()}`
}
