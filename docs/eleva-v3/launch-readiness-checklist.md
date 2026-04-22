# Eleva.care v3 Launch Readiness Checklist

Status: Living

## Purpose

This document is the final pre-launch checklist for Eleva.care v3.

It is meant to be used before:

- staging sign-off
- production launch
- major relaunches
- high-risk feature rollouts

## How To Use This Checklist

This is not only an engineering checklist.
It is a cross-functional launch checklist covering:

- product readiness
- technical readiness
- operational readiness
- support readiness
- compliance and risk readiness

Each item should have:

- an owner
- a status
- a verification note where useful

## Product Readiness

- [ ] Public website and marketplace copy is approved.
- [ ] Expert onboarding flow is approved.
- [ ] Patient onboarding and activation flow is approved.
- [ ] Core booking flow is verified end to end.
- [ ] Payment, pack, and subscription flows are verified for launch scope.
- [ ] Session, notes, report, and follow-up experience is aligned with launch scope.
- [ ] Mobile diary integration is either included and verified or clearly deferred.

## Architecture And Implementation Readiness

- [ ] All launch-critical handbook docs are current.
- [ ] Required ADRs for launch decisions are written and accepted.
- [ ] App/package boundaries are implemented consistently with the handbook.
- [ ] No launch-critical feature depends on undocumented assumptions.
- [ ] Known risks and deferrals are explicitly documented.

## Environment And Infrastructure Readiness

- [ ] Staging and production environments are configured correctly.
- [ ] Required environment variables are documented and present.
- [ ] Webhook endpoints are configured per environment.
- [ ] Calendar, payment, video, and email integrations are validated in the correct environment.
- [ ] Health checks and uptime monitors are configured.

## Data And Compliance Readiness

- [ ] Consent and visibility rules are implemented for sensitive data.
- [ ] Sensitive artifacts have documented retention and deletion behavior.
- [ ] Transcript, diary, report, and document visibility has been reviewed.
- [ ] Audit logging exists for high-risk actions.
- [ ] Export/deletion expectations are documented for launch scope.
- [ ] Public platform framing and compliance-sensitive copy has been reviewed.

## Security Readiness

- [ ] The `security-hardening-checklist.md` items relevant to launch are complete.
- [ ] Sensitive secrets are managed correctly.
- [ ] Admin/operator permissions follow least privilege.
- [ ] Webhook verification is enabled.
- [ ] Idempotency is in place for critical booking/payment/workflow paths.

## Observability Readiness

- [ ] Sentry is configured and verified.
- [ ] BetterStack logging and uptime checks are configured and verified.
- [ ] Launch-critical journeys are observable with correlation ids or equivalent tracing context.
- [ ] Alerts exist for high-risk failures.
- [ ] Runbooks exist for likely launch incidents.

## Testing Readiness

- [ ] Launch-critical automated tests pass.
- [ ] Manual QA has been run on the core flows.
- [ ] Browser/device coverage is acceptable for launch scope.
- [ ] Payment, scheduling, and reminder flows have been verified with realistic test cases.
- [ ] Failure and recovery paths have been tested where practical.

## Support And Operations Readiness

- [ ] Admin/operator playbooks are written.
- [ ] Integration runbooks are written.
- [ ] Ownership is defined for launch-day issues.
- [ ] Escalation path is documented.
- [ ] Internal support team knows what is in scope versus deferred.

## Rollout Readiness

- [ ] Launch order and rollout steps are defined.
- [ ] Rollback plan exists for launch-critical failures.
- [ ] High-risk integrations can be disabled or degraded safely where possible.
- [ ] Communication plan exists for launch and incident updates.

## Final Sign-Off

Recommended sign-off roles:

- product owner
- engineering lead
- design lead where relevant
- operations/support owner
- compliance/security reviewer where relevant

## Related Docs

- [`security-hardening-checklist.md`](./security-hardening-checklist.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
- [`integration-runbooks.md`](./integration-runbooks.md)
- [`admin-operator-playbooks.md`](./admin-operator-playbooks.md)
