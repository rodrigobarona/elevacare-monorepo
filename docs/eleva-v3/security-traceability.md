# Eleva.care v3 Security Traceability

Status: Living (skeleton — Phase 1). Phase 13 adds `check-security-traceability` that fails
CI when a row has no enforcing test or CI job.

| Control                                          | Introducing phase   | Enforcing test / CI                                                                               | Evidence                            |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| RLS policy-class taxonomy (7 classes)            | 1                   | `rls-classes.test.ts` (Phase 1.2 Neon-branch job)                                                 | `schema-and-migration-rules.md`     |
| Tenant isolation (`withOrgContext`)              | 1 (docs) / existing | `rls-isolation` / `policies.test.ts`                                                              | ADR-003                             |
| Secret scanning                                  | 1.2                 | `gitleaks` job + husky pre-commit                                                                 | `.gitleaks.toml`                    |
| Better Auth session / CSRF / origin check        | 2.2                 | `api-auth.test.ts` + `csrf.test.ts` (six cases); D-13 threat model                                | ADR-017, D-13                       |
| Duplicate session-cookie rejection               | 2.2                 | `requireApiAuth` `SESSION_COOKIE_AMBIGUOUS` test + Set-Cookie clear                               | D-13                                |
| E2E email-verify bypass fail-closed              | 2.2                 | `e2e-env.test.ts`; production request → 404                                                       | environment-matrix.md               |
| Vendor SDK boundaries                            | 0 / 1               | ESLint `boundaries` + CodeRabbit path_instructions                                                | `AGENTS.md`                         |
| `withAudit` on mutations                         | existing / 2+       | `packages/audit` tests; `check:api-first-actions`                                                 | ADR / audit-wiring                  |
| Envelope encryption / no KEK in logs             | 3 / 10              | encryption known-vector tests; Sentry redaction                                                   | ADR-020                             |
| Crypto-shred (`shredOrgKeys` / `orgKeyShredder`) | 10 / launch         | `shredOrgKeys` integration test (ciphertext unreadable after DEK delete; legal-hold blocks shred) | ADR-020, compliance-data-governance |
| Public route BotID + rate limit                  | existing / 4        | route-guard checker (Phase 4)                                                                     | api-first-agentic                   |
| Booking slot exclusion constraint                | 4                   | concurrency test with and without Redis lock                                                      | Phase 4                             |
| Clinical access model                            | 10 / 11             | D-11 tests                                                                                        | D-11                                |
| Admin step-up + dual control                     | 12                  | `admin-actions.ts` table-driven tests                                                             | Phase 12                            |
| Security traceability completeness               | 13                  | `check-security-traceability`                                                                     | this file                           |

Rows are appended by the phase that introduces the control. Do not leave `Enforcing test / CI`
empty after that phase merges.
