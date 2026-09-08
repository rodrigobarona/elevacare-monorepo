# @eleva/auth

Authentication, session management, and authorization for the Eleva v3
monorepo. Built on [Better Auth](https://www.better-auth.com) (ADR-017)
with the server construct in `src/server/auth.ts`.

## Session architecture

Identity lives on `auth.user` / `auth.organization` / `auth.member`.
Frontends read sessions through `@eleva/auth/server` (`getSession()`)
or `@eleva/auth/client`. The Better Auth server is constructed only in
`packages/auth/src/server/auth.ts`.

| Concern              | Handled by                                                 |
| -------------------- | ---------------------------------------------------------- |
| Session cookie       | Better Auth (`better-auth.session_token`)                  |
| Organizations / RBAC | Better Auth organization plugin + ADR-021                  |
| Calendar OAuth       | `auth.api.getAccessToken({ body: { accountId, userId } })` |
| API credentials      | Cookie, Bearer JWT, or `x-api-key` (one per request)       |

## Owner

Implementation plan in `docs/eleva-v3/implementation-sprints.md`.
