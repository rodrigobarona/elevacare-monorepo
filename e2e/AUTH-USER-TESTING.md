# Auth user testing (member / staff)

Automated gate: `pnpm e2e:auth` must stay green. That suite is the merge blocker for
identity changes (`e2e/auth-api.spec.ts`, `e2e/auth.spec.ts`, `e2e/admin.spec.ts`).

Manual checks below are for a human on `pnpm dev` after sign-out. Do not commit
passwords. Staff credentials live only in the operator’s password manager.

## Levels

| Level                   | Who                                                                                          | Expected home                               | Admin `:3007`                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| Member (personal Space) | New sign-up or an existing personal account                                                  | `apps/app` `/space-…`                       | Redirects to that Space. No `audit:view_all`.       |
| Staff                   | User with `auth.user.role = platform_admin` **and** membership in an org with `type = staff` | Admin console                               | Stays on `:3007`.                                   |
| Expert / Team / Academy | Not in this slice                                                                            | Product home from `(org.type, member.role)` | Same as member: bounced unless staff org is active. |

Admin layout gate today is `session.capabilities.includes("audit:view_all")`, which only
the staff capability bundle grants. A `platform_admin` user whose **active** org is
personal still looks like a member.

## Automated (`pnpm e2e:auth`)

Requires `pnpm dev` (API `:3002`, account `:3006`, admin `:3007`) and
`E2E_SKIP_WEBSERVER=1`.

Must pass:

1. CSRF: `Origin: https://evil.example` → 403
2. Sign-up → unverified sign-in blocked (403) → verify-email → session
3. Personal Space provisioned
4. Expert org create + switch (`get-session?disableCookieCache=true`)
5. Password reset (API `/auth/reset-password/{token}` redirects to
   account `/reset-password?token=`)
6. Sign-out
7. Magic link 302
8. Wrong password / unknown user → 401
9. JWKS 200
10. Account UI login page renders
11. Admin unauthenticated visitor leaves `:3007` for login

Verify/reset/magic URLs: the API process needs `E2E_AUTH_CAPTURE=1`. Playwright
then reads Redis `e2e:auth-url:{kind}:{sha256(email)}`, or `GET /auth/verify-email`.
Inbox is not required. Resend rejects `@example.com`; non-production logs the
error and still returns 200 so this suite stays green. Production still throws
on a Resend failure. Direct Neon `email_verified` writes require
`E2E_ALLOW_DB_WRITES=1` and are not used when Redis capture works.

## Manual — member (new)

1. Sign out. Open `http://localhost:3006/signup`.
2. Create a unique `@example.com` or inbox you control.
3. Confirm email (Resend if `RESEND_API_KEY` + verified From, else Redis URL).
4. Sign in. Land on `{firstName}'s Space` under `:3001` / gateway `/{slug}`.
5. Visit `http://localhost:3007` → bounce back to that Space.
6. Request password reset and magic link; both complete.

## Manual — existing personal account

Keep the operator’s existing personal Gmail as a member Space. Visiting `:3007`
while signed in must return to `http://localhost:3001/space-…`. Do not promote
that user to staff.

## Manual — staff

1. Sign out of the personal account (or use a clean browser profile).
2. Sign in at `http://localhost:3006/login` with the staff email from the
   operator’s password manager.
3. Open `http://localhost:3007`. Expect “Signed in as …” and the operator console.
4. Confirm the personal account still cannot stay on admin.

## Email preview

`apps/email` is React Email CLI on `:3009` (`email dev --dir packages/email/src/templates`).
After `pnpm dev` restart, open verify-email / reset-password / magic-link / booking
templates. Auth send uses `RESEND_FROM_EMAIL` or `RESEND_EMAIL_BOOKINGS_FROM`.

## Out of this slice

Phase 03.1 / 03.2 already merged (envelope encryption, calendar token boundary, leftover
identity tables). Calendar connect on staging, Team seat Stripe clocks, and the full
admin console remain later phases (4B / 11 / 12). This file only covers identity
levels that exist today.
