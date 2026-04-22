# Eleva Care Audit Logging Strategy

## Executive Summary

This document outlines Eleva Care's database audit logging strategy for HIPAA compliance using **pgAudit** (PostgreSQL Audit Extension) provided by Neon.tech.

**Status**: Phase 1 - Initial Setup  
**Target Completion**: 4-6 weeks  
**Compliance**: HIPAA §164.312(b) - Audit Controls

---

## Architecture Overview

### Current vs. Future State

```
┌─────────────────────────────────────────────────────────────────┐
│                         CURRENT STATE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Application Layer                                               │
│  ├── Server Actions                                              │
│  │   └── Manual audit logging via lib/logAuditEvent.ts          │
│  │       └── Writes to: Eleva Audit Database (auditDb)          │
│  │           ├── Schema: drizzle/auditSchema.ts                 │
│  │           ├── Connection: drizzle/auditDb.ts                 │
│  │           └── Limited to app-level events                    │
│  │                                                               │
│  Database Layer (Neon Postgres)                                 │
│  ├── Main Database: Production schema (users, meetings, etc.)  │
│  ├── Audit Database: Custom audit log table                     │
│  └── pgAudit: ❌ NOT YET CONFIGURED                            │
│                                                                   │
│  ⚠️ GAPS:                                                         │
│  • No audit of direct SQL queries (bypasses app layer)          │
│  • No audit of schema changes (DDL)                             │
│  • No audit of permission/role changes                          │
│  • Custom audit table can be modified/deleted                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         FUTURE STATE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Application Layer                                               │
│  ├── Server Actions                                              │
│  │   └── Lightweight business event logging (optional)          │
│  │       └── Correlation IDs only (requestId, userId)           │
│  │                                                               │
│  Database Layer (Neon Postgres)                                 │
│  ├── Main Database: Production schema                            │
│  └── pgAudit: ✅ CONFIGURED & ACTIVE                            │
│      ├── Session-level auditing (all READ/WRITE/ROLE/DDL)      │
│      ├── Relation-level logging (table-by-table)                │
│      ├── Parameter redaction (no sensitive data in logs)        │
│      └── Application name correlation (requestId + userId)      │
│                                                                   │
│  Log Export & Storage (SIEM)                                    │
│  └── AWS CloudWatch / Datadog / ELK                             │
│      ├── Tamper-proof storage                                    │
│      ├── 6-year retention                                        │
│      ├── Real-time alerting                                      │
│      └── Compliance reporting                                    │
│                                                                   │
│  ✅ BENEFITS:                                                     │
│  • Complete audit trail (all database operations)               │
│  • Tamper-resistant (external SIEM)                             │
│  • HIPAA-compliant retention                                     │
│  • Real-time threat detection                                    │
│  • Reduced maintenance (Neon-managed)                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phased Implementation Plan

### Phase 1: Enable pgAudit (Current Phase) ⏳

**Timeline**: Week 1-4  
**Status**: In Progress  
**Owner**: DevOps + Compliance Team

**Tasks**:

1. ✅ HIPAA support enabled at Neon organization level
2. ⏳ Request pgAudit configuration from Neon support
3. ⏳ Verify pgAudit settings
4. ⏳ Configure log export to SIEM
5. ⏳ Set up 6-year retention policy
6. ⏳ Configure critical alerts
7. ⏳ 2-week burn-in period with monitoring

**Deliverables**:

- ✅ pgAudit enabled and configured
- ✅ Complete audit trail for all database operations
- ✅ Logs exported to SIEM with 6-year retention
- ✅ Alert system operational

**Success Criteria**:

- 100% PHI access logged
- < 5% performance impact
- 0 missing audit entries
- All alerts tested and working

---

### Phase 2: Application Correlation (Next) 📋

**Timeline**: Week 5-6  
**Status**: Planned  
**Owner**: Backend Team

**Tasks**:

1. Add `application_name` to database connections
2. Thread `requestId` and `userId` into connection string
3. Update connection pooling logic
4. Test correlation between app logs and DB audit logs
5. Update monitoring dashboards

**Technical Implementation**:

```typescript
// drizzle/db.ts
import { ENV_CONFIG } from '@/config/env';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

export function createDbConnection(context?: {
  userId?: string;
  requestId?: string;
  action?: string;
}) {
  // Build application_name for pgAudit correlation
  const appName = [
    'eleva',
    ENV_CONFIG.NODE_ENV,
    context?.userId || 'anonymous',
    context?.requestId || 'no-request-id',
    context?.action || 'unknown',
  ].join(':');

  // Add application_name to connection string
  const url = new URL(ENV_CONFIG.DATABASE_URL);
  url.searchParams.set('application_name', appName);

  const sql = neon(url.toString());
  return drizzle(sql, { schema });
}
```

**Deliverables**:

- Application logs correlated with DB audit logs
- Enhanced forensics capabilities
- Better incident investigation

---

### Phase 3: Evaluate Eleva Audit Table (Optional) 🔄

**Timeline**: Week 7-8  
**Status**: Planned  
**Owner**: Architecture Team

**Tasks**:

1. Compare coverage: pgAudit vs. Eleva Audit table
2. Identify unique value in custom audit table
3. Decide: Keep, Modify, or Retire
4. If retire: Plan migration and cleanup

**Decision Tree**:

```
Does Eleva Audit table provide value beyond pgAudit?
│
├─ NO → Retire Eleva Audit table
│   ├─ Export historical audit data
│   ├─ Remove auditDb connection
│   ├─ Remove lib/logAuditEvent.ts
│   ├─ Remove audit calls from server actions
│   └─ Drop audit schema and database
│
└─ YES → Keep for business-level events
    ├─ Trim to business events only (not DB operations)
    ├─ Add correlation fields (requestId, userId)
    ├─ Store minimal data (no PHI)
    └─ Document dual-layer audit model
```

**Likely Outcome**: Retire custom audit table  
**Rationale**: pgAudit provides superior coverage and compliance

---

### Phase 4: Optimization (If Needed) ⚡

**Timeline**: Week 9-10  
**Status**: Conditional  
**Owner**: Performance Team

**Triggers**:

- Log volume > 10GB/day
- Performance degradation > 5%
- Storage costs excessive
- Too much noise in logs

**Optimization Options**:

1. **Object-Level Auditing**: Focus on PHI tables only
2. **Sampling**: Audit % of READ operations (not recommended for HIPAA)
3. **Table Exclusions**: Exclude high-volume, non-PHI tables
4. **Log Compression**: Enable SIEM-side compression

**Implementation** (if needed):

```sql
-- Create audit role for object-level auditing
CREATE ROLE eleva_auditor NOLOGIN;
GRANT eleva_auditor TO neondb_owner;

-- Grant permissions on PHI tables only
GRANT SELECT, UPDATE, INSERT, DELETE ON records TO eleva_auditor;
GRANT SELECT, UPDATE, INSERT, DELETE ON meetings TO eleva_auditor;
GRANT SELECT, UPDATE, INSERT, DELETE ON users TO eleva_auditor;
GRANT SELECT, UPDATE, INSERT, DELETE ON profiles TO eleva_auditor;

-- Configure pgAudit to use object-level auditing
ALTER SYSTEM SET pgaudit.role TO 'eleva_auditor';
ALTER SYSTEM SET pgaudit.log TO 'ddl, role';  -- Keep DDL and ROLE at session level
```

---

## PHI Tables Classification

### 🔴 Tier 1: Critical PHI (Highest Risk)

| Table      | Contains                                    | Access Frequency        | Audit Priority |
| ---------- | ------------------------------------------- | ----------------------- | -------------- |
| `records`  | Medical records, diagnoses, treatment notes | Low (practitioner only) | **CRITICAL**   |
| `meetings` | Appointment details, patient notes          | Medium                  | **CRITICAL**   |

### 🟡 Tier 2: Personal Information

| Table      | Contains                             | Access Frequency | Audit Priority |
| ---------- | ------------------------------------ | ---------------- | -------------- |
| `users`    | Email, name, authentication data     | High             | **HIGH**       |
| `profiles` | Practitioner profiles, personal info | High             | **HIGH**       |

### 🟢 Tier 3: Financial/Booking Data

| Table               | Contains                | Access Frequency | Audit Priority |
| ------------------- | ----------------------- | ---------------- | -------------- |
| `payment_transfers` | Payment information     | Low              | **MEDIUM**     |
| `slot_reservations` | Booking data with email | High             | **MEDIUM**     |
| `events`            | Service definitions     | Medium           | **LOW**        |

### ⚪ Tier 4: Configuration (Non-PHI)

| Table                 | Contains                       | Access Frequency | Audit Priority |
| --------------------- | ------------------------------ | ---------------- | -------------- |
| `schedules`           | Availability (no patient data) | Medium           | **LOW**        |
| `scheduling_settings` | System configuration           | Low              | **LOW**        |
| `categories`          | Service categories             | Low              | **LOW**        |

---

## HIPAA Compliance Mapping

### Required Audit Controls (§164.312(b))

| Requirement              | Implementation                        | Status     |
| ------------------------ | ------------------------------------- | ---------- |
| **Access Logging**       | pgAudit captures all READ operations  | ⏳ Phase 1 |
| **Modification Logging** | pgAudit captures all WRITE operations | ⏳ Phase 1 |
| **User Attribution**     | Application name includes userId      | 📋 Phase 2 |
| **Timestamp Accuracy**   | Neon provides UTC timestamps          | ✅ Done    |
| **Tamper Resistance**    | Logs exported to external SIEM        | ⏳ Phase 1 |
| **Long-term Retention**  | 6-year retention in SIEM              | ⏳ Phase 1 |
| **Regular Review**       | Monthly audit log review process      | 📋 Phase 1 |
| **Incident Response**    | Alerts for suspicious activity        | ⏳ Phase 1 |

### Additional HIPAA Requirements

| Requirement               | Implementation                    | Status  |
| ------------------------- | --------------------------------- | ------- |
| **Encryption at Rest**    | Neon default (AES-256)            | ✅ Done |
| **Encryption in Transit** | TLS 1.2+ required                 | ✅ Done |
| **Access Controls**       | Row-level security (RLS) policies | ✅ Done |
| **Authentication**        | Clerk.com with MFA                | ✅ Done |
| **Authorization**         | Role-based access control         | ✅ Done |
| **Data Minimization**     | Collect only necessary PHI        | ✅ Done |
| **De-identification**     | Encryption for stored records     | ✅ Done |

---

## Alert Configuration

### 🚨 Critical (Immediate Response)

```yaml
alert_rules:
  - name: 'Role Permission Changes'
    filter: 'AUDIT.*SESSION.*ROLE'
    severity: CRITICAL
    notification: PagerDuty
    response_time: < 15 minutes

  - name: 'DDL on PHI Tables'
    filter: 'AUDIT.*(DROP|ALTER|TRUNCATE).*(records|meetings|users|profiles)'
    severity: CRITICAL
    notification: PagerDuty
    response_time: < 15 minutes

  - name: 'Failed PHI Access'
    filter: 'ERROR.*permission denied.*(records|meetings|users|profiles)'
    severity: CRITICAL
    notification: PagerDuty
    response_time: < 30 minutes
```

### ⚠️ Warning (Daily Review)

```yaml
- name: 'Bulk DELETE Operations'
  filter: 'AUDIT.*DELETE.*rows > 100'
  severity: WARNING
  notification: Email
  response_time: < 24 hours

- name: 'Off-Hours PHI Access'
  filter: 'AUDIT.*READ.*(records|meetings) AND time:(00:00-06:00 OR Saturday OR Sunday)'
  severity: WARNING
  notification: Slack
  response_time: < 24 hours

- name: 'Multiple Failed Logins'
  filter: 'ERROR.*authentication failed.*count > 5 within 1 hour'
  severity: WARNING
  notification: Slack
  response_time: < 24 hours
```

### ℹ️ Informational (Weekly Review)

```yaml
- name: 'High Volume Queries'
  filter: 'AUDIT.*READ.*rows > 10000'
  severity: INFO
  notification: Dashboard
  response_time: Weekly review

- name: 'New User Registrations'
  filter: 'AUDIT.*INSERT.*users'
  severity: INFO
  notification: Dashboard
  response_time: Weekly review
```

---

## Cost Analysis

### Current State (Custom Audit Table)

```
Database Storage (Audit table):  $XX/month
Developer Maintenance:           X hours/month
Compliance Risk:                 HIGH (gaps in coverage)
```

### Future State (pgAudit + SIEM)

```
Neon HIPAA Tier:                 $XXX/month (already paying)
pgAudit:                         $0 (included in HIPAA tier)
SIEM Storage (CloudWatch):       ~$50-100/month (10GB/day @ 7 years)
Developer Maintenance:           < 1 hour/month
Compliance Risk:                 LOW (complete coverage)

Total Additional Cost:           ~$50-100/month
Maintenance Savings:             X hours/month
Compliance Improvement:          HIGH → LOW risk
```

**ROI**: Reduced compliance risk + reduced maintenance = Strong positive ROI

---

## Monitoring & Reporting

### Daily Monitoring

- [ ] Check for critical alerts
- [ ] Verify log export pipeline operational
- [ ] Review failed authentication attempts
- [ ] Check for permission denied errors

### Weekly Reporting

- [ ] Audit log volume trends
- [ ] Top tables accessed
- [ ] Top users by query count
- [ ] Off-hours access summary

### Monthly Compliance Review

- [ ] Sample 1% of audit logs for accuracy
- [ ] Review alert false-positive rate
- [ ] Update audit procedures if needed
- [ ] Train team on any new patterns

### Quarterly Security Review

- [ ] Full audit trail review
- [ ] Access control review
- [ ] Incident response drill
- [ ] Update BAA if needed

### Annual Compliance Audit

- [ ] Full HIPAA audit with external auditor
- [ ] Provide audit log evidence
- [ ] Update security policies
- [ ] Renew BAAs

---

## Documentation & Training

### Required Documentation

1. **Audit Log Access Procedures** (`./audit-log-access.md`)
2. **Incident Response Plan** (`./incident-response.md`)
3. **Alert Runbooks** (`./alert-runbooks.md`)
4. **Quarterly Review Process** (`./quarterly-review.md`)

### Training Requirements

| Role            | Training Topic           | Frequency           |
| --------------- | ------------------------ | ------------------- |
| All Engineers   | HIPAA Basics             | Annual              |
| Backend Team    | pgAudit & Audit Logs     | Initial + Annual    |
| DevOps Team     | SIEM & Alerting          | Initial + Quarterly |
| Compliance Team | Audit Review & Reporting | Initial + Quarterly |
| Security Team   | Incident Response        | Initial + Quarterly |

---

## Success Criteria

### Phase 1 Complete When:

- [x] pgAudit enabled and configured
- [x] All PHI access logged (100% coverage)
- [x] Logs exported to SIEM
- [x] 6-year retention configured
- [x] Critical alerts operational
- [x] < 5% performance impact
- [x] 2-week burn-in successful
- [x] Team trained on new system

### Overall Success When:

- [x] HIPAA audit passed with zero findings
- [x] Complete audit trail for all PHI access
- [x] Incident response < 15 min for critical alerts
- [x] Zero audit log gaps or tampering
- [x] Reduced maintenance effort
- [x] Positive ROI demonstrated

---

## Risk Assessment

### Before pgAudit (Current State)

| Risk                    | Likelihood | Impact   | Mitigation           |
| ----------------------- | ---------- | -------- | -------------------- |
| Unaudited PHI access    | **HIGH**   | CRITICAL | ⏳ Implement pgAudit |
| Schema changes unlogged | **MEDIUM** | HIGH     | ⏳ Implement pgAudit |
| Audit log tampering     | **MEDIUM** | CRITICAL | ⏳ External SIEM     |
| HIPAA non-compliance    | **HIGH**   | CRITICAL | ⏳ Implement pgAudit |

**Overall Risk**: 🔴 **HIGH**

### After pgAudit (Target State)

| Risk                    | Likelihood | Impact   | Mitigation                 |
| ----------------------- | ---------- | -------- | -------------------------- |
| Unaudited PHI access    | **LOW**    | CRITICAL | ✅ pgAudit session logging |
| Schema changes unlogged | **LOW**    | HIGH     | ✅ pgAudit DDL logging     |
| Audit log tampering     | **LOW**    | CRITICAL | ✅ External SIEM           |
| HIPAA non-compliance    | **LOW**    | CRITICAL | ✅ Complete audit trail    |

**Overall Risk**: 🟢 **LOW**

---

## References & Resources

### Internal Documentation

- [Phase 1 Setup Guide](./pgaudit-phase-1-setup.md)
- [Quick Start Checklist](./pgaudit-quick-start.md)
- [Database Schema](../../drizzle/schema.ts)
- [Environment Config](../../config/env.ts)

### External Resources

- [Neon HIPAA Documentation](https://neon.tech/docs/security/hipaa)
- [pgAudit Official Docs](https://github.com/pgaudit/pgaudit)
- [Neon Blog: pgAudit](https://neon.tech/blog/pgaudit-postgres-logging)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

### Support Contacts

| Contact Type       | Email/Link        | Response Time |
| ------------------ | ----------------- | ------------- |
| Neon Support       | support@neon.tech | 24-48 hours   |
| Eleva DevOps       | [internal]        | Immediate     |
| Compliance Officer | [internal]        | Same day      |
| Security Team      | [internal]        | Immediate     |

---

**Document Owner**: [Your Name]  
**Last Updated**: {{ date }}  
**Next Review**: After Phase 1 completion  
**Classification**: Internal - Compliance Team
