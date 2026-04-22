# Third-Party Service Legal Documentation Updates

> **Status**: ⚠️ PENDING - Update when migration complete
> **Created**: December 2025
> **Priority**: 🔴 HIGH - Required for compliance
> **Trigger**: Complete after Clerk → WorkOS migration is finished

---

## Overview

This document tracks required updates to legal documents following:

1. **Authentication Migration**: Clerk → WorkOS
2. **New Service Addition**: MUX (video streaming)
3. **New Service Addition**: Sentry (error monitoring)
4. **New Service Addition**: BetterStack (uptime monitoring, logging, heartbeats)
5. **Explicit Documentation**: Google (Calendar API for scheduling integration)

All legal documents referencing third-party data processors must be updated to maintain GDPR/LGPD compliance accuracy.

---

## New Third-Party Services

### WorkOS (Replacing Clerk)

| Field              | Details                                        |
| ------------------ | ---------------------------------------------- |
| **Service**        | Authentication, SSO, User Management           |
| **Purpose**        | Identity verification, session management, MFA |
| **Data Processed** | Auth metadata, profile data, session tokens    |
| **Compliance**     | SOC 2 Type II, GDPR compliant                  |
| **DPA**            | Available at https://workos.com/legal/dpa      |
| **Data Region**    | EU hosting options available                   |
| **Safeguards**     | DPA, SCCs (if applicable), encryption          |

### MUX (New Addition)

| Field              | Details                                                           |
| ------------------ | ----------------------------------------------------------------- |
| **Service**        | Video streaming, encoding, storage, analytics                     |
| **Purpose**        | Video content delivery and quality monitoring                     |
| **Data Processed** | Video metadata, viewer analytics (no PII stored)                  |
| **Compliance**     | GDPR, CCPA, VPPA compliant, Data Privacy Framework certified      |
| **DPA**            | Available at https://mux.com/dpa/                                 |
| **Data Region**    | EU ingest location (Germany), post-processed data to US           |
| **Safeguards**     | DPA, DPF certification, anonymized viewer IDs                     |
| **Privacy Notes**  | Does not store PII, IP truncation available, EU processing option |

### Sentry (New Addition)

| Field              | Details                                                        |
| ------------------ | -------------------------------------------------------------- |
| **Service**        | Error monitoring, performance tracking, session replay         |
| **Purpose**        | Application debugging, error tracking, performance monitoring  |
| **Data Processed** | Error logs, stack traces, performance metrics, session replays |
| **Compliance**     | GDPR compliant                                                 |
| **DPA**            | Available at https://sentry.io/legal/dpa/                      |
| **Data Region**    | EU data storage option available                               |
| **Safeguards**     | DPA, SCCs, data scrubbing, PII masking options                 |
| **Privacy Notes**  | Configurable data masking, text/media blocking in replays      |

### BetterStack (New Addition)

| Field              | Details                                                       |
| ------------------ | ------------------------------------------------------------- |
| **Service**        | Uptime monitoring, logging, incident management, heartbeats   |
| **Purpose**        | Infrastructure monitoring, log aggregation, alerting          |
| **Data Processed** | Server logs, uptime metrics, heartbeat signals, incident data |
| **Compliance**     | SOC 2 Type 2, GDPR compliant, ISO 27001 data centers          |
| **DPA**            | Available at https://betterstack.com/dpa                      |
| **Data Region**    | Data region selection available                               |
| **Safeguards**     | DPA, SCCs (if applicable), sensitive data filtering           |
| **Privacy Notes**  | Configurable log filtering, sensitive information redaction   |

### Google (Calendar API - Explicit Documentation)

| Field              | Details                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| **Service**        | Google Calendar API (scheduling/booking integration)                        |
| **Purpose**        | Calendar synchronization for expert availability and booking management     |
| **Data Processed** | Calendar events, availability data, booking metadata                        |
| **Compliance**     | GDPR compliant, ISO 27001, SOC 2/3                                          |
| **DPA**            | Available at https://cloud.google.com/terms/data-processing-addendum        |
| **Data Region**    | EU data residency available via Google Cloud regions                        |
| **Safeguards**     | DPA, SCCs, OAuth 2.0 consent, minimal scope access                          |
| **Privacy Notes**  | User-initiated OAuth consent required, limited to calendar read/write scope |

> **Note**: Google SSO is already mentioned in the existing DPA. This addition explicitly documents the Google Calendar API integration used for scheduling features, which accesses user calendar data beyond authentication.

---

## Files Requiring Updates

### 1. Data Processing Agreement (DPA) - 4 Languages

Update the subprocessor table and identity/SSO section in each file:

- [ ] `src/content/trust/dpa/en.mdx`
- [ ] `src/content/trust/dpa/es.mdx`
- [ ] `src/content/trust/dpa/pt.mdx`
- [ ] `src/content/trust/dpa/pt-BR.mdx`

#### Changes Required

**Section 2 (When we are Controller)** - Replace:

```diff
- Identity/SSO: Clerk (EU options), Google SSO
+ Identity/SSO: WorkOS (EU options), Google SSO
```

**Section 12 (Subprocessors table)** - Replace Clerk row:

```diff
- | Clerk    | Identity/SSO                | Auth and profile metadata                        | EU options                 | DPA, SCCs (if applicable)                                |
+ | WorkOS   | Identity/SSO                | Auth and profile metadata                        | EU options                 | DPA, SCCs (if applicable)                                |
```

**Section 12 (Subprocessors table)** - Add new rows:

```markdown
| MUX | Video streaming | Video metadata, viewer analytics | EU (Germany) / US | DPA, DPF certification |
| Sentry | Error monitoring | Error logs, performance data | EU option available | DPA, SCCs (if applicable) |
| BetterStack | Uptime/logging | Server logs, uptime metrics, heartbeats | Data region selectable | SOC 2 Type 2, DPA, ISO 27001 |
| Google | Calendar API | Calendar events, availability, bookings | EU regions available | DPA, SCCs, OAuth consent |
```

### 2. Privacy Policy - 4 Languages

Update the processor list in Section 4 (Sharing):

- [ ] `src/content/privacy/en.mdx`
- [ ] `src/content/privacy/es.mdx`
- [ ] `src/content/privacy/pt.mdx`
- [ ] `src/content/privacy/pt-BR.mdx`

#### Changes Required

**Section 4 (Sharing)** - Update processor list:

```diff
- With processors who help us run the service (e.g., Stripe, Clerk, Vercel, Neon, Novu, PostHog, Resend, Upstash).
+ With processors who help us run the service (e.g., Stripe, WorkOS, Google, Vercel, Neon, Novu, PostHog, Resend, Upstash, MUX, Sentry, BetterStack).
```

### 3. Legal Compliance Summary

- [ ] `_docs/06-legal/compliance/01-legal-compliance-summary.md`

#### Changes Required

**Vendor Compliance Status table** - Replace Clerk row and add new vendors:

```diff
- | **Clerk Inc.**   | Authentication        | ✅ Executed                 | ✅ EU Option      | ✅ Yes | ✅ YES         |
+ | **WorkOS Inc.**  | Authentication        | ⚠️ Required                 | ✅ EU Option      | ✅ Yes | ✅ YES         |
+ | **Google**       | Calendar API          | ⚠️ Required                 | ✅ EU Regions     | ✅ Yes | ✅ YES         |
+ | **MUX Inc.**     | Video Streaming       | ⚠️ Required                 | ✅ EU Option      | ✅ Yes | ✅ YES         |
+ | **Sentry Inc.**  | Error Monitoring      | ⚠️ Required                 | ✅ EU Option      | ✅ Yes | ✅ YES         |
+ | **BetterStack**  | Uptime/Logging        | ⚠️ Required                 | ✅ Selectable     | ✅ Yes | ✅ YES         |
```

### 4. Legal README

- [ ] `_docs/06-legal/README.md`

#### Changes Required

**Service Providers section** - Update provider list:

```diff
- - **Clerk.com** (Auth): ✅ DPA Available
+ - **WorkOS** (Auth): ✅ DPA Available
+ - **Google** (Calendar API): ✅ DPA Available
+ - **MUX** (Video): ✅ DPA Available
+ - **Sentry** (Error Monitoring): ✅ DPA Available
+ - **BetterStack** (Uptime/Logging): ✅ DPA Available
```

---

## DPA Execution Checklist

Before updating legal documents, ensure DPAs are executed with each vendor:

- [ ] **WorkOS DPA**: Review and execute at https://workos.com/legal/dpa
- [ ] **Google DPA**: Review and execute at https://cloud.google.com/terms/data-processing-addendum
- [ ] **MUX DPA**: Review and execute at https://mux.com/dpa/
- [ ] **Sentry DPA**: Review and execute at https://sentry.io/legal/dpa/
- [ ] **BetterStack DPA**: Review and execute at https://betterstack.com/dpa

---

## Compliance Verification

### EU Data Residency Confirmation

| Vendor      | EU Hosting   | Configuration Required                     |
| ----------- | ------------ | ------------------------------------------ |
| WorkOS      | ✅ Available | Verify EU region selected in dashboard     |
| Google      | ✅ Available | Use EU Cloud regions for Calendar API      |
| MUX         | ✅ Available | Configure EU ingest endpoint (Germany)     |
| Sentry      | ✅ Available | Select EU data storage in project settings |
| BetterStack | ✅ Available | Select data region in source/team settings |

### GDPR Article 28 Requirements

All processors must have:

- [x] Written contract (DPA)
- [x] Security measures documented
- [x] Subprocessor notification procedures
- [x] Data deletion procedures
- [x] Audit rights (where applicable)

---

## Update Process

### Pre-Update Steps

1. [ ] Confirm Clerk → WorkOS migration is complete
2. [ ] Execute DPAs with WorkOS, Google, MUX, Sentry, and BetterStack
3. [ ] Verify EU data residency configuration for each service
4. [ ] Get legal review approval for document changes

### Update Steps

1. [ ] Update all 4 DPA language versions
2. [ ] Update all 4 Privacy Policy language versions
3. [ ] Update Legal Compliance Summary
4. [ ] Update Legal README
5. [ ] Update `effective_date` in all modified documents

### Post-Update Steps

1. [ ] Legal review of all changes
2. [ ] Deploy updated documents
3. [ ] Announce changes to users (30-day notice if material)
4. [ ] Update `DPA_CONFIG` version in `src/config/legal-agreements.ts` if needed
5. [ ] Mark this document as COMPLETED

---

## Version History

| Date     | Change                                                 | Author |
| -------- | ------------------------------------------------------ | ------ |
| Dec 2025 | Initial creation - tracking document                   | System |
| Dec 2025 | Added BetterStack (uptime/logging) to tracked services | System |
| Dec 2025 | Added Google Calendar API to tracked services          | System |

---

## References

### Vendor Documentation

- **WorkOS**: https://workos.com/docs
- **WorkOS DPA**: https://workos.com/legal/dpa
- **WorkOS Security**: https://workos.com/security
- **MUX**: https://www.mux.com/docs
- **MUX DPA**: https://mux.com/dpa/
- **MUX Privacy**: https://www.mux.com/docs/guides/ensure-data-privacy-compliance
- **Sentry**: https://docs.sentry.io
- **Sentry DPA**: https://sentry.io/legal/dpa/
- **Sentry Privacy**: https://docs.sentry.io/security-legal-pii/
- **BetterStack**: https://betterstack.com/docs
- **BetterStack DPA**: https://betterstack.com/dpa
- **BetterStack Security**: https://betterstack.com/security (SOC 2 Type 2, ISO 27001)
- **Google Cloud**: https://cloud.google.com/apis
- **Google DPA**: https://cloud.google.com/terms/data-processing-addendum
- **Google Security**: https://cloud.google.com/security (ISO 27001, SOC 2/3)

### Internal Documentation

- Legal Compliance Summary: `_docs/06-legal/compliance/01-legal-compliance-summary.md`
- GDPR DPIA Template: `_docs/06-legal/compliance/02-gdpr-dpia-template.md`
- Translation Guide: `_docs/06-legal/guides/01-translation-guide.md`

---

**⚠️ IMPORTANT**: Do not update live legal documents until:

1. Migration is complete (Clerk → WorkOS)
2. DPAs are executed with all new vendors (WorkOS, Google, MUX, Sentry, BetterStack)
3. Legal review is obtained
4. 30-day notice period observed (if material changes)
